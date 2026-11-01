// services/comunica/eventFiles.ts
//
// Abrir un archivo de un evento (plan 13; es el abridor que el plan 16 reutiliza): se baja con la sesión a la caché de la app y se enseña en la hoja
// de compartir del sistema (que en iOS y Android abre el visor de PDF). La copia se borra al terminar. Es el único fichero del área, junto con
// `localFiles.ts`, que carga `expo-file-system`.

import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { PhotoSource } from './client';
import { logger } from '@/utils/logger';

export type OpenFileResult = 'opened' | 'offline' | 'failed';

const safeName = (s: string) =>
  s.replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(0, 60);

export async function openEventFile(
  source: PhotoSource,
  title: string,
): Promise<OpenFileResult> {
  let copy: File | null = null;
  try {
    const dir = new Directory(Paths.cache, 'comunica-eventos');
    if (!dir.exists) dir.create();
    const target = new File(dir, `${Date.now()}-${safeName(title)}.pdf`);
    copy = await File.downloadFileAsync(source.uri, target, {
      headers: source.headers,
    });
    if (!(await Sharing.isAvailableAsync())) return 'failed';
    await Sharing.shareAsync(copy.uri, {
      mimeType: 'application/pdf',
      dialogTitle: title,
    });
    return 'opened';
  } catch (e) {
    const message = String((e as Error)?.message ?? e);
    // Sin red, la descarga no llega a empezar.
    if (/network|offline|internet|connect/i.test(message)) return 'offline';
    logger.warn('[comunica] abrir un archivo del evento');
    return 'failed';
  } finally {
    try {
      if (copy?.exists) copy.delete();
    } catch {
      /* ya no está */
    }
  }
}
