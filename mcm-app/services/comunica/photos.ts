// services/comunica/photos.ts
//
// Las fotos de las fichas (plan 05) viven en la caché de `expo-image`. Al
// SALIR se vacía entera: también se van las demás imágenes de la app (se
// vuelven a bajar), que es el precio de no dejar caras de menores en el
// móvil. Y con conexión se precargan las de tus grupos, en segundo plano.

import { Image } from 'expo-image';
import type { PhotoSource } from './client';
import { logger } from '@/utils/logger';

export async function clearPhotoCache(): Promise<void> {
  await Promise.all([Image.clearDiskCache(), Image.clearMemoryCache()]);
}

/** Precarga (de cuatro en cuatro las pide quien llama). */
export async function prefetchPhotos(sources: PhotoSource[]): Promise<void> {
  const remote = sources.filter((s) => /^https?:/.test(s.uri));
  if (remote.length === 0) return;
  try {
    await Image.prefetch(
      remote.map((s) => s.uri),
      { cachePolicy: 'disk', headers: remote[0].headers },
    );
  } catch (e) {
    logger.warn('[comunica] no se han podido precargar fotos', e);
  }
}
