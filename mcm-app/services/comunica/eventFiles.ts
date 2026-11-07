// services/comunica/eventFiles.ts
//
// Abrir un archivo con sesión (planes 13 y 16): se baja a `cacheDirectory/comunica/open/` con la cabecera de sesión y se enseña (visor propio o hoja de
// compartir del sistema); la copia se BORRA al cerrar el visor, al volver la app a primer plano, al abrir Documentos y siempre al salir. Es el único fichero
// del área, junto con `localFiles.ts`, que carga `expo-file-system` (el nombre es de cuando solo abría los archivos de un evento).

import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { PhotoSource } from './client';
import { mimeOf, safeFileName } from '@/utils/comunica/files';
import { logger } from '@/utils/logger';

export type OpenFileResult = 'opened' | 'offline' | 'failed';
export type DownloadResult =
  | { ok: true; uri: string; fileName: string }
  | { ok: false; reason: 'offline' | 'failed' };

const OPEN_DIR = 'comunica/open';
const openDir = () => new Directory(Paths.cache, OPEN_DIR);

/** Sin red, la descarga no llega a empezar. */
const isOffline = (e: unknown) =>
  /network|offline|internet|connect/i.test(String((e as Error)?.message ?? e));

/** Baja un archivo con sesión a la caché de la app. Nunca registra la URL ni el nombre. */
export async function downloadToCache(
  source: PhotoSource,
  fileName: string,
): Promise<DownloadResult> {
  try {
    const dir = openDir();
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const name = safeFileName(fileName);
    const target = new File(dir, `${Date.now()}-${name}`);
    const copy = await File.downloadFileAsync(source.uri, target, {
      headers: source.headers,
    });
    return { ok: true, uri: copy.uri, fileName: name };
  } catch (e) {
    if (isOffline(e)) return { ok: false, reason: 'offline' };
    logger.warn('[comunica] bajar un archivo');
    return { ok: false, reason: 'failed' };
  }
}

/** Borra lo que se bajó para abrir (al cerrar el visor, al volver la app, al abrir Documentos y al salir). */
export async function clearOpenCopies(): Promise<void> {
  try {
    const dir = openDir();
    if (dir.exists) dir.delete();
  } catch {
    /* ya no está */
  }
}

/** La hoja de compartir del sistema para una copia local. */
export async function shareLocalFile(
  uri: string,
  fileName: string,
): Promise<boolean> {
  try {
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(uri, {
      mimeType: mimeOf(fileName),
      dialogTitle: fileName,
    });
    return true;
  } catch {
    return false;
  }
}

/** Abrir un archivo de un evento (plan 13): se baja, se enseña en la hoja de compartir y la copia se borra. */
export async function openEventFile(
  source: PhotoSource,
  title: string,
): Promise<OpenFileResult> {
  const r = await downloadToCache(source, `${title}.pdf`);
  if (!r.ok) return r.reason;
  try {
    return (await shareLocalFile(r.uri, `${title}.pdf`)) ? 'opened' : 'failed';
  } finally {
    await clearOpenCopies();
  }
}
