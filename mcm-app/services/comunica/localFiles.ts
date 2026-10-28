// services/comunica/localFiles.ts
//
// Las copias que dejan los selectores (cámara, galería, archivos) en la caché
// de la app (plan 09). Un certificado de delitos sexuales no se deja por ahí:
// se borra la copia en cuanto sube, si se descarta y al salir del área. Solo
// se toca lo que está DENTRO de la caché de la app; nunca el original.
//
// Es el único fichero del área que carga `expo-file-system`; en web, su
// `.web.ts` no hace nada (el navegador no deja copias).

import { File, Paths } from 'expo-file-system';
import { logger } from '@/utils/logger';

const inCache = (uri: string) => {
  try {
    return uri.startsWith('file://') && uri.startsWith(Paths.cache.uri);
  } catch {
    return false;
  }
};

/** Borra la copia local de un archivo elegido (si es nuestra). */
export function deleteLocalCopy(uri: string): void {
  if (!inCache(uri)) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch (e) {
    logger.warn('[comunica] no se ha podido borrar una copia local', e);
  }
}

/** El tamaño de un archivo local, cuando el selector no lo da. */
export function localFileSize(uri: string): number | null {
  try {
    const f = new File(uri);
    return f.exists ? f.size : null;
  } catch {
    return null;
  }
}
