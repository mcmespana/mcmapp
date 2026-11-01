// En web no hay dónde bajar una copia con sesión: el abridor de archivos dice que no se pudo (se abre desde el móvil).

import type { PhotoSource } from './client';

export type OpenFileResult = 'opened' | 'offline' | 'failed';
export type DownloadResult =
  | { ok: true; uri: string; fileName: string }
  | { ok: false; reason: 'offline' | 'failed' };

export async function downloadToCache(
  _source: PhotoSource,
  _fileName: string,
): Promise<DownloadResult> {
  return { ok: false, reason: 'failed' };
}
export async function clearOpenCopies(): Promise<void> {}
export async function shareLocalFile(
  _uri: string,
  _fileName: string,
): Promise<boolean> {
  return false;
}
export async function openEventFile(
  _source: PhotoSource,
  _title: string,
): Promise<OpenFileResult> {
  return 'failed';
}
