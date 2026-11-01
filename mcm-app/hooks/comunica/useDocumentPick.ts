// hooks/comunica/useDocumentPick.ts
//
// Elegir el archivo de un documento de familia (plan 16, regla 6): hacer una
// foto, la galería o un archivo (`pickFile` del plan 09), y comprobarlo ANTES
// de enviar (extensión de la lista, más de 0 bytes, 4 MB). Lo elegido no se
// sube aquí: se sube con «Subir documento» o «Guardar». La copia del selector
// se borra al cambiarla, al salir de la pantalla sin subir y al acabar.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FileSource } from '@/components/comunica/comun/form/FileField';
import type { UploadFile } from '@/services/comunica/client';
import { deleteLocalCopy, localFileSize } from '@/services/comunica/localFiles';
import {
  DOCUMENT_FILE_PROBLEM_TEXT,
  documentFileProblem,
  documentUploadName,
} from '@/utils/comunica/files';
import { fileSizeText } from '@/utils/comunica/monitorProfile';
import { h } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { pickFile, PickerPermissionError } from './pickFile';

/** La pista de la hoja de elegir (formatos y tamaño). */
export const DOCUMENT_SHEET_HINT =
  'PDF, imágenes, Word, Excel u OpenDocument de hasta 4 MB.';

export function useDocumentPick() {
  const [file, setFile] = useState<UploadFile | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // La copia se queda mientras alguien la va a subir (`take`).
  const taken = useRef(false);
  const current = useRef<UploadFile | null>(null);
  current.current = file;

  useEffect(
    () => () => {
      if (current.current && !taken.current) {
        deleteLocalCopy(current.current.uri);
      }
    },
    [],
  );

  const choose = useCallback(async (source: FileSource) => {
    setProblem(null);
    let picked;
    try {
      picked = await pickFile(source, ['*/*']);
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
    const { name, mimeType } = documentUploadName(picked.name, picked.mimeType);
    const size = picked.size ?? localFileSize(picked.uri) ?? 0;
    const bad = documentFileProblem({ name, size });
    if (bad) {
      h.error();
      setProblem(DOCUMENT_FILE_PROBLEM_TEXT[bad]);
      deleteLocalCopy(picked.uri);
      return;
    }
    setFile((prev) => {
      if (prev && prev.uri !== picked.uri) deleteLocalCopy(prev.uri);
      return { uri: picked.uri, name, mimeType, size, blob: picked.blob };
    });
  }, []);

  return {
    file,
    problem,
    choose,
    selected: file
      ? { name: file.name, sizeText: fileSizeText(file.size) }
      : null,
    /** Quien sube se queda con la copia (y la borra al acabar). */
    take: () => {
      taken.current = true;
      return file;
    },
    clear: () => {
      if (file) deleteLocalCopy(file.uri);
      setFile(null);
    },
  };
}
