// Subir un título o certificado (plan 09, reglas 8-10): elegir, comprobar
// (PDF, JPG o PNG, 4 MB) ANTES de subir, y subir en el acto, directo y con
// conexión (`services/comunica/uploads.ts`: nunca por la cola, el archivo no
// se queda en el móvil). Al subir, la ficha se marca «Ya subido» al momento y
// se relee.

import { useCallback, useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type {
  FileFieldUpload,
  FileSource,
} from '@/components/comunica/comun/form/FileField';
import type {
  DocumentKind,
  MonitorProfile,
} from '@/services/comunica/contract';
import { deleteLocalCopy, localFileSize } from '@/services/comunica/localFiles';
import {
  getUpload,
  retryUpload,
  startUpload,
  subscribeUploads,
} from '@/services/comunica/uploads';
import { h } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import {
  FILE_PROBLEM_TEXT,
  fileProblem,
  fileSizeText,
  uploadNameAndType,
} from '@/utils/comunica/monitorProfile';
import { areaKey } from './useAreaQuery';
import { MONITOR_PROFILE_KEY } from './useMonitorProfile';
import { pickFile, PickerPermissionError } from './pickFile';

const FLAG: Record<DocumentKind, keyof MonitorProfile['files']> = {
  sex_offence_certificate: 'sexOffenceCertificate',
  mat: 'mat',
  dat: 'dat',
  other_training: 'otherTraining',
};

export function useDocumentUpload(kind: DocumentKind) {
  const qc = useQueryClient();
  const entry = useSyncExternalStore(subscribeUploads, () => getUpload(kind));
  const [problem, setProblem] = useState<string | null>(null);

  const choose = useCallback(
    async (source: FileSource) => {
      setProblem(null);
      let picked;
      try {
        picked = await pickFile(source);
      } catch (e) {
        if (e instanceof PickerPermissionError) {
          setProblem(
            'Para hacer una foto, da permiso a la cámara en los Ajustes del móvil.',
          );
        } else {
          logger.warn('[comunica] el selector ha fallado', e);
          setProblem('No se ha podido abrir. Prueba otra vez.');
        }
        return;
      }
      if (!picked) return;
      const { name, mimeType } = uploadNameAndType(
        kind,
        picked.name,
        picked.mimeType,
      );
      const size = picked.size ?? localFileSize(picked.uri) ?? 0;
      const bad = fileProblem({ name, size, mimeType });
      if (bad) {
        h.error();
        setProblem(FILE_PROBLEM_TEXT[bad]);
        deleteLocalCopy(picked.uri);
        return;
      }
      const key = areaKey([...MONITOR_PROFILE_KEY]);
      void startUpload(
        kind,
        { uri: picked.uri, name, mimeType, size, blob: picked.blob },
        () => {
          h.success();
          qc.setQueryData<MonitorProfile>(key, (old) =>
            old ? { ...old, files: { ...old.files, [FLAG[kind]]: true } } : old,
          );
          void qc.invalidateQueries({ queryKey: key });
        },
      );
    },
    [kind, qc],
  );

  const upload: FileFieldUpload | null = entry
    ? {
        name: entry.file.name,
        sizeText: fileSizeText(entry.file.size),
        state: entry.phase,
        message: entry.message,
      }
    : null;

  return {
    upload,
    /** Subiendo ahora mismo: cuenta como «en camino» para el aviso. */
    uploading: entry?.phase === 'sending',
    uploaded: entry?.phase === 'applied',
    problem,
    choose,
    retry: () => void retryUpload(kind),
  };
}

/** Solo en qué está la subida de un tipo (para el aviso del certificado). */
export function useUploadPhase(kind: DocumentKind) {
  const entry = useSyncExternalStore(subscribeUploads, () => getUpload(kind));
  return entry?.phase ?? null;
}
