/**
 * Título de la pestaña del navegador (web).
 *
 * expo-router desactiva el título automático de React Navigation
 * (`documentTitle: { enabled: false }` en su `ExpoRoot`), así que sin esto la
 * pestaña se quedaba con el `<title>` estático del HTML —o con la URL— y no
 * se distinguía «MCM» de otra pestaña, ni en el historial ni en marcadores.
 *
 * Dos capas, para que el orden de los efectos no importe:
 *  - **base**: la pone el layout raíz según la ruta (`titleForPath`).
 *  - **detalle**: la pone una pantalla concreta mientras está enfocada (el
 *    detalle de canción con su título) y la quita al perder el foco.
 * Gana el detalle si lo hay. Fuera de la web no se toca nada.
 */
import { Platform } from 'react-native';
import { TABS_CONFIG } from '@/constants/tabsCatalog';

/** Nombre de la app en la pestaña. El mismo que el `<title>` de `+html.tsx`. */
export const APP_TITLE = 'MCM España';

/** Rutas de primer nivel que no son pestañas, con su nombre legible. */
const EXTRA_ROUTES: Record<string, string> = {
  notifications: 'Notificaciones',
  wordle: 'Wordle',
  playlist: 'Cantoral',
  coro: 'Cantoral',
  cancion: 'Cantoral',
  encuesta: 'Encuesta',
  'evaluacion-app': 'Valora la app',
  carismochito: 'Colección',
  onboarding: 'Bienvenida',
};

/** «Etiqueta · MCM» según el primer segmento de la ruta; la raíz, el nombre. */
export function titleForPath(pathname: string): string {
  const segment = pathname.split('?')[0].split('/').filter(Boolean)[0];
  if (!segment) return APP_TITLE;
  const tab = TABS_CONFIG.find((t) => t.name === segment);
  const label = tab?.label ?? EXTRA_ROUTES[segment];
  return label ? `${label} · MCM` : APP_TITLE;
}

/** Título de una canción abierta: «Alzad las manos · Cantoral». */
export function songDocumentTitle(title: string | undefined): string | null {
  const clean = (title ?? '').trim();
  return clean ? `${clean} · Cantoral` : null;
}

let base = APP_TITLE;
let detail: string | null = null;

function apply() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const next = detail ?? base;
  if (document.title !== next) document.title = next;
}

/** Título de la pantalla según la ruta (lo llama el layout raíz). */
export function setBaseDocumentTitle(title: string): void {
  base = title;
  apply();
}

/**
 * Título de una pantalla concreta mientras está enfocada. Devuelve la función
 * que lo quita (solo si sigue siendo el suyo).
 */
export function setDetailDocumentTitle(title: string): () => void {
  detail = title;
  apply();
  return () => {
    if (detail === title) {
      detail = null;
      apply();
    }
  };
}
