// En web no hay dónde bajar una copia con sesión: el abridor de archivos dice que no se pudo (el PDF se abre desde el móvil).

import type { PhotoSource } from './client';

export type OpenFileResult = 'opened' | 'offline' | 'failed';

export async function openEventFile(
  _source: PhotoSource,
  _title: string,
): Promise<OpenFileResult> {
  return 'failed';
}
