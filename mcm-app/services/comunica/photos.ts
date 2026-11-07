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

/**
 * Precarga (de cuatro en cuatro las pide quien llama). Las cabeceras van con
 * cada foto según su `PhotoSource`: las que no llevan sesión (otro dominio) se
 * piden aparte y sin ella.
 */
export async function prefetchPhotos(sources: PhotoSource[]): Promise<void> {
  const remote = sources.filter((s) => /^https?:/.test(s.uri));
  const withAuth = remote.filter((s) => s.headers);
  const plain = remote.filter((s) => !s.headers);
  try {
    if (withAuth.length > 0) {
      await Image.prefetch(
        withAuth.map((s) => s.uri),
        { cachePolicy: 'disk', headers: withAuth[0].headers },
      );
    }
    if (plain.length > 0) {
      await Image.prefetch(
        plain.map((s) => s.uri),
        { cachePolicy: 'disk' },
      );
    }
  } catch (e) {
    logger.warn('[comunica] no se han podido precargar fotos', e);
  }
}
