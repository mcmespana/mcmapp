// hooks/comunica/useOpenFile.ts
//
// El abridor de archivos del área (plan 16, reglas C1-C3), compartido con los
// archivos de un evento (plan 13). Quien llama da CÓMO se baja (una función
// del cliente: la ruta de documentos, o la del evento para los de un evento,
// nunca al revés); aquí se decide cómo se abre:
//
//   · Imagen → el visor `comunica/archivo` (expo-image).
//   · PDF → el visor (WebView) en iOS; en web, pestaña nueva; en Android,
//     «Abrir con…» del sistema (o la hoja de compartir).
//   · Lo demás → la hoja del sistema.
//
// Sin conexión no se abre. Mientras baja, `busyKey` y `progress` (el botón lo
// enseña); si falla, un toast.

import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useToast } from '@/contexts/AppToastContext';
import {
  isComunicaApiError,
  type DownloadedFile,
} from '@/services/comunica/client';
import { openWithSystem, shareOpenFile } from '@/services/comunica/openFiles';
import { openModeOf } from '@/utils/comunica/files';
import { logger } from '@/utils/logger';
import { useOnline } from './useDocuments';

export const OPEN_FILE_TEXT = {
  offline: 'Necesitas conexión para abrir el documento',
  failed: 'No se ha podido descargar. Inténtalo otra vez.',
  gone: 'Este documento ya no está disponible',
  noFile: 'Este documento no tiene archivo',
} as const;

export type FileDownload = (
  onProgress: (fraction: number) => void,
) => Promise<DownloadedFile>;

/** El texto de un fallo al bajar. */
export function openErrorText(e: unknown): string {
  if (isComunicaApiError(e)) {
    if (e.code === 'forbidden') return OPEN_FILE_TEXT.gone;
    if (e.code === 'not_found') return OPEN_FILE_TEXT.noFile;
  }
  return OPEN_FILE_TEXT.failed;
}

export function useOpenFile() {
  const router = useRouter();
  const { toast } = useToast();
  const online = useOnline();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const fetchFile = useCallback(
    async (key: string, download: FileDownload) => {
      if (!online) {
        toast.show({ label: OPEN_FILE_TEXT.offline, variant: 'warning' });
        return null;
      }
      setBusyKey(key);
      setProgress(0);
      try {
        return await download(setProgress);
      } catch (e) {
        if (!isComunicaApiError(e)) logger.warn('[comunica] al bajar', e);
        toast.show({ label: openErrorText(e), variant: 'danger' });
        return null;
      } finally {
        setBusyKey(null);
      }
    },
    [online, toast],
  );

  /** Bajar y abrir (C1). */
  const open = useCallback(
    async (key: string, download: FileDownload) => {
      const file = await fetchFile(key, download);
      if (!file) return;
      const mode = openModeOf(file.mimeType, Platform.OS);
      if (mode === 'image' || mode === 'pdf') {
        router.push({
          pathname: '/comunica/archivo',
          params: {
            uri: file.localUri,
            name: file.fileName,
            mime: file.mimeType,
          },
        } as never);
        return;
      }
      await openWithSystem(file).catch(() =>
        toast.show({ label: OPEN_FILE_TEXT.failed, variant: 'danger' }),
      );
    },
    [fetchFile, router, toast],
  );

  /** Bajar y compartir (la ficha). */
  const share = useCallback(
    async (key: string, download: FileDownload) => {
      const file = await fetchFile(key, download);
      if (file) await shareOpenFile(file).catch(() => {});
    },
    [fetchFile],
  );

  return { open, share, busyKey, progress, online };
}
