import { useEffect } from 'react';
import { Platform } from 'react-native';
import { usePathname } from 'expo-router';
import { setBaseDocumentTitle, titleForPath } from '@/utils/documentTitle';

/**
 * Pone el título de la pestaña del navegador según la ruta («Cantoral · MCM»).
 * Se engancha una sola vez en el layout raíz, como `useScreenTracking`. Las
 * pantallas que quieran algo más concreto (el detalle de canción) lo ponen
 * encima con `setDetailDocumentTitle`. No-op fuera de la web.
 */
export function useDocumentTitle(): void {
  const pathname = usePathname();
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    setBaseDocumentTitle(titleForPath(pathname));
  }, [pathname]);
}
