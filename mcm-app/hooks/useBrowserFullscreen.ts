/**
 * Pantalla completa DEL NAVEGADOR (Fullscreen API) para el modo presentación
 * en web: la de la app solo esconde su propia interfaz, y con un portátil
 * conectado a un proyector seguían a la vista la barra de direcciones y las
 * pestañas.
 *
 * Es opcional: se activa con `toggle` (botón o tecla F), que tiene que salir
 * de un gesto del usuario. Si se sale por fuera —Esc, que el navegador se
 * queda sin enviarlo a la página, o su propio botón— se llama a `onExit`: así
 * un solo Esc sigue cerrando la presentación. Salir con `toggle` no cierra.
 * Al desmontar, si sigue activa, se sale.
 *
 * En nativo, o en un navegador sin la API (Safari de iPhone), `supported` es
 * false y no hace nada.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

/** Lo que se usa del `document` (inyectable para los tests). */
export interface FullscreenDocument {
  fullscreenEnabled?: boolean;
  fullscreenElement?: unknown;
  documentElement: { requestFullscreen?: () => Promise<void> };
  exitFullscreen?: () => Promise<void>;
  addEventListener: (type: 'fullscreenchange', cb: () => void) => void;
  removeEventListener: (type: 'fullscreenchange', cb: () => void) => void;
}

function webDocument(): FullscreenDocument | null {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
  return document as unknown as FullscreenDocument;
}

export function useBrowserFullscreen(
  onExit: () => void,
  doc: FullscreenDocument | null = webDocument(),
) {
  const supported =
    !!doc &&
    doc.fullscreenEnabled !== false &&
    typeof doc.documentElement.requestFullscreen === 'function';
  const [active, setActive] = useState(false);
  // Salida pedida por nosotros (toggle): esa no cierra la presentación.
  const leaving = useRef(false);
  const onExitRef = useRef(onExit);
  useEffect(() => {
    onExitRef.current = onExit;
  });

  useEffect(() => {
    if (!supported || !doc) return;
    const onChange = () => {
      const on = !!doc.fullscreenElement;
      setActive(on);
      if (on) return;
      if (leaving.current) leaving.current = false;
      else onExitRef.current();
    };
    doc.addEventListener('fullscreenchange', onChange);
    return () => {
      doc.removeEventListener('fullscreenchange', onChange);
      if (doc.fullscreenElement) doc.exitFullscreen?.().catch(() => {});
    };
  }, [supported, doc]);

  const toggle = useCallback(() => {
    if (!supported || !doc) return;
    if (doc.fullscreenElement) {
      leaving.current = true;
      doc.exitFullscreen?.().catch(() => {
        leaving.current = false;
      });
      return;
    }
    doc.documentElement.requestFullscreen?.().catch(() => {});
  }, [supported, doc]);

  return { supported, active, toggle };
}
