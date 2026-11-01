// hooks/comunica/useOpenFile.ts
//
// El abridor de archivos del área (plan 16 «Abrir archivos», adelantado por
// el 13): baja el archivo CON LA SESIÓN y lo abre con el visor del sistema
// (Quick Look en iOS, la app que toque en Android, una pestaña en web). Un
// archivo de evento se pide siempre con su evento (C3), por
// `eventFileSource`; nada de URLs a mano.
//
//   · Sin conexión: «Necesitas conexión para abrir el documento» (C2).
//   · Si falla la bajada: «No se ha podido descargar. Inténtalo otra vez.»
//   · `opening` dice qué se está bajando, para el progreso del botón.
//
// El 16 lo reutiliza (y añade, si hace falta, su visor `archivo.tsx`).

import { useCallback, useState, useSyncExternalStore } from 'react';
import { onlineManager } from '@tanstack/react-query';
import { useToast } from '@/contexts/AppToastContext';
import type { PhotoSource } from '@/services/comunica/client';
import { openRemoteFile } from '@/services/comunica/localFiles';
import { logger } from '@/utils/logger';

export interface OpenableFile {
  /** Para saber cuál se está abriendo (y no repetir el toque). */
  key: string;
  source: PhotoSource | null;
  fileName: string;
  mimeType: string;
}

export const OFFLINE_FILE_TEXT = 'Necesitas conexión para abrir el documento';
export const FILE_FAILED_TEXT =
  'No se ha podido descargar. Inténtalo otra vez.';

/** ¿Hay conexión? (el `onlineManager` del área, que ya escucha a la red). */
export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (fn) => onlineManager.subscribe(fn),
    () => onlineManager.isOnline(),
    () => true,
  );
}

export function useOpenFile() {
  const { toast } = useToast();
  const online = useIsOnline();
  const [opening, setOpening] = useState<string | null>(null);
  const open = useCallback(
    async (file: OpenableFile) => {
      if (opening) return;
      if (!online) {
        toast.show({ variant: 'warning', label: OFFLINE_FILE_TEXT });
        return;
      }
      if (!file.source) return;
      setOpening(file.key);
      try {
        await openRemoteFile(file.source, file.fileName, file.mimeType);
      } catch {
        // Ni el error: lleva la URL con los ids, que no van a los registros.
        logger.warn('[comunica] no se ha podido abrir un archivo');
        toast.show({ variant: 'danger', label: FILE_FAILED_TEXT });
      } finally {
        setOpening(null);
      }
    },
    [opening, online, toast],
  );
  return { open, opening };
}
