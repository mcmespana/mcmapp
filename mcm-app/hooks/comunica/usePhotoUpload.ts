// La foto de perfil (plan 12): elegir (cámara o galería, con el recorte cuadrado del selector), comprobar (JPG o PNG, 4 MB) ANTES de subir, y subir
// en el acto, directo y con conexión (`services/comunica/photoUploads.ts`: nunca por la cola, la foto no se queda en el móvil).
//
//   · Si la foto se pasa de 4 MB, se avisa y la SIGUIENTE vez que se elija se pide al selector menos calidad (`photoQuality`): es lo único que se
//     puede ajustar si falla `expo-image-manipulator` (que ya la reduce a 800×800 y la pasa a JPEG). Al subir bien, se vuelve a la calidad de partida.
//   · Al subir, la `photoUrl` nueva (versionada, con `?v=`) sustituye a la de la caché de esa persona al momento; no se vuelve a pedir nada.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { PersonDetails } from '@/services/comunica/contract';
import { deleteLocalCopy, localFileSize } from '@/services/comunica/localFiles';
import {
  dismissPhotoUpload,
  getPhotoUpload,
  retryPhotoUpload,
  startPhotoUpload,
  subscribePhotoUploads,
} from '@/services/comunica/photoUploads';
import { h } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import {
  PHOTO_PROBLEM_TEXT,
  photoFileName,
  photoProblem,
  photoQuality,
  photoTooBigText,
  photoTypeOf,
} from '@/utils/comunica/photo';
import { areaKey } from './useAreaQuery';
import { pickPhoto, PickerPermissionError } from './pickFile';
import { detailsKey } from './usePersonDetails';

export type PhotoSource = 'camera' | 'library';

export function usePhotoUpload(pid: string) {
  const qc = useQueryClient();
  const entry = useSyncExternalStore(subscribePhotoUploads, () =>
    getPhotoUpload(pid),
  );
  const [problem, setProblem] = useState<string | null>(null);
  // Cuántas veces seguidas se ha pasado de 4 MB: cada una baja un escalón la calidad que se pide.
  const attempt = useRef(0);

  // Al entrar y al salir de la pantalla: lo que no está subiendo (una subida ya hecha, un fallo) se olvida y se borra su copia. Lo que está en
  // vuelo acaba solo.
  useEffect(() => {
    dismissPhotoUpload(pid);
    return () => dismissPhotoUpload(pid);
  }, [pid]);

  const choose = useCallback(
    async (source: PhotoSource) => {
      setProblem(null);
      let picked;
      try {
        picked = await pickPhoto(source, photoQuality(attempt.current));
      } catch (e) {
        if (e instanceof PickerPermissionError) {
          setProblem(
            'Para hacer una foto, da permiso a la cámara en los Ajustes del móvil.',
          );
        } else {
          logger.warn('[comunica] el selector de fotos ha fallado', e);
          setProblem('No se ha podido abrir. Prueba otra vez.');
        }
        return;
      }
      if (!picked) return;
      const type = photoTypeOf(picked.mimeType, picked.name ?? picked.uri);
      const size = picked.size ?? localFileSize(picked.uri) ?? 0;
      const bad = photoProblem({ size, type });
      if (bad) {
        h.error();
        setProblem(
          bad === 'too_big'
            ? photoTooBigText(type, attempt.current)
            : PHOTO_PROBLEM_TEXT[bad],
        );
        if (bad === 'too_big') attempt.current += 1;
        deleteLocalCopy(picked.uri);
        return;
      }
      void startPhotoUpload(
        pid,
        {
          uri: picked.uri,
          name: photoFileName(type!),
          mimeType: type!,
          size,
          blob: picked.blob,
        },
        (photoUrl) => {
          attempt.current = 0;
          h.success();
          // La URL nueva sustituye a la de la caché de esta persona. Antes se para una lectura en vuelo: traería la foto de antes y la pisaría.
          const key = areaKey([...detailsKey(pid)]);
          void qc
            .cancelQueries({ queryKey: key })
            .then(() =>
              qc.setQueryData<PersonDetails>(key, (old) =>
                old ? { ...old, photoUrl } : old,
              ),
            );
        },
      );
    },
    [pid, qc],
  );

  return {
    entry,
    problem,
    /** Subiendo ahora mismo. */
    uploading: entry?.phase === 'sending',
    choose,
    retry: () => void retryPhotoUpload(pid),
  };
}
