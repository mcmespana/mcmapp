// services/comunica/localFiles.ts
//
// Las copias que dejan los selectores (cámara, galería, archivos) en la caché
// de la app (plan 09). Un certificado de delitos sexuales no se deja por ahí:
// se borra la copia en cuanto sube, si se descarta y al salir del área. Solo
// se toca lo que está DENTRO de la caché de la app; nunca el original.
//
// Es el único fichero del área que carga `expo-file-system`; en web, su
// `.web.ts` no hace nada (el navegador no deja copias).

import { Directory, File, Paths } from 'expo-file-system';
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

// ── Abrir un archivo con la sesión (plan 13; el abridor del plan 16) ──────

/** Donde se dejan los archivos abiertos: se vacía al abrir otro y al salir. */
const openDir = () => new Directory(Paths.cache, 'comunica', 'open');

/** Un nombre de archivo sin barras ni rarezas. */
const safeName = (name: string) =>
  name.replace(/[^\w.\- ]+/gu, '_').slice(0, 80) || 'documento';

/**
 * Baja el archivo (con las cabeceras de sesión) a la caché y lo abre con la
 * vista previa del sistema (Quick Look en iOS; la app que toque en Android).
 * Una URL `data:` (el servidor falso) se escribe tal cual.
 */
export async function openRemoteFile(
  source: { uri: string; headers?: Record<string, string> },
  fileName: string,
  mimeType: string,
): Promise<void> {
  clearOpenedFiles();
  const dir = openDir();
  dir.create({ intermediates: true, idempotent: true });
  const target = new File(dir, safeName(fileName));
  const data = /^data:[^;,]*;base64,(.*)$/.exec(source.uri);
  if (data) {
    target.create({ overwrite: true });
    await target.write(data[1], { encoding: 'base64' });
  } else {
    await File.downloadFileAsync(source.uri, target, {
      headers: source.headers,
      idempotent: true,
    });
  }
  await target.preview({ title: fileName, mimeType });
}

/** Borra lo abierto (al abrir otro y al salir del área). */
export function clearOpenedFiles(): void {
  try {
    const dir = openDir();
    if (dir.exists) dir.delete();
  } catch (e) {
    logger.warn('[comunica] no se han podido borrar los archivos abiertos', e);
  }
}
