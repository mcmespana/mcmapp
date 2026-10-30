import { useCallback } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect, useNavigation } from 'expo-router/react-navigation';
import {
  setDetailDocumentTitle,
  songDocumentTitle,
} from '@/utils/documentTitle';
import { songWebPath } from '@/utils/songIndex';

/**
 * ¿Es una URL del cantoral? expo-router serializa el stack interno a su
 * manera: `/cancionero/SongDetail?filename=…&content=<la letra entera>` —
 * una URL kilométrica que además da 404 al recargar, porque esa ruta no
 * existe en el export estático.
 */
function isCantoralPath(pathname: string): boolean {
  return (
    pathname === '/cancionero' ||
    pathname.startsWith('/cancionero/') ||
    pathname === '/cancion'
  );
}

/**
 * Pases para escribir la URL de la canción. El router de expo-router apunta
 * cada cambio del stack en el historial de forma ASÍNCRONA (y al volver de la
 * pantalla completa espera a un `history.go`), así que la URL de la canción
 * se escribe después de él: un pase inmediato y otro de seguridad.
 */
const URL_PASSES_MS = [0, 300];

/**
 * Web: refleja la canción abierta fuera de la app.
 *
 *  - **Título de la pestaña**: «Alzad las manos · Cantoral» mientras el
 *    detalle está enfocado (encima del título por ruta del layout raíz).
 *  - **URL**: `/cancion?f=<fichero>`, el enlace que abre esa canción
 *    (`app/cancion.tsx`). Así F5 vuelve a la canción en vez de a Categorías y
 *    copiar la barra de direcciones sirve para pasarla.
 *
 * La URL se cambia con `replaceState` conservando el `history.state` del
 * router, sin añadir entradas: «Atrás» del navegador sigue llevando a donde
 * llevaba. Solo se escribe encima de la URL del propio cantoral, y solo con
 * el detalle enfocado, para no pisar otra pantalla a la que ya se haya ido.
 *
 * No-op en nativo.
 */
export function useSongWebLocation(
  filename: string | undefined,
  title: string | undefined,
): void {
  const navigation = useNavigation();
  const docTitle = songDocumentTitle(title);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'web' || typeof window === 'undefined') return;
      const clearTitle = docTitle ? setDetailDocumentTitle(docTitle) : null;
      const timers = filename
        ? URL_PASSES_MS.map((ms) =>
            setTimeout(() => {
              if (!navigation.isFocused()) return;
              const { pathname, search } = window.location;
              const target = songWebPath(filename);
              if (pathname + search === target) return;
              if (!isCantoralPath(pathname)) return;
              try {
                window.history.replaceState(window.history.state, '', target);
              } catch {
                // Navegador que no deja tocar el historial: sin URL y ya.
              }
            }, ms),
          )
        : [];
      return () => {
        timers.forEach(clearTimeout);
        clearTitle?.();
      };
    }, [navigation, filename, docTitle]),
  );
}
