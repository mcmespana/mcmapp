/**
 * Lanza `print()` en una ventana recién escrita (el PDF de la playlist en
 * web) cuando de verdad está lista: hoja de estilos cargada (evento `load`) y
 * fuentes descargadas (`document.fonts.ready`), con un tope por si algo no
 * llega nunca.
 *
 * Antes se imprimía a los 600 ms fijos: con red lenta o Google Fonts
 * bloqueado, el PDF salía con la letra de reserva y los saltos de página
 * calculados para Inter dejaban de cuadrar.
 *
 * Ojo con el orden al usarla: `document.open()` borra los listeners de la
 * ventana, así que hay que llamarla DESPUÉS de `open()`/`write()` y ANTES de
 * `close()` (que es lo que dispara `load`). Si ya estaba cargada, no espera.
 */

type PrintableWindow = {
  document: {
    readyState?: string;
    fonts?: { ready?: Promise<unknown> };
  };
  addEventListener?: (type: 'load', cb: () => void) => void;
  focus?: () => void;
  print: () => void;
};

/** Tope de espera antes de imprimir igualmente. */
export const PRINT_READY_TIMEOUT_MS = 3000;

export function printWhenReady(
  w: PrintableWindow,
  timeoutMs = PRINT_READY_TIMEOUT_MS,
): Promise<void> {
  const loaded = new Promise<void>((resolve) => {
    if (w.document.readyState === 'complete' || !w.addEventListener) {
      resolve();
      return;
    }
    w.addEventListener('load', () => resolve());
  });
  const ready = loaded.then(() => w.document.fonts?.ready);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cap = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  return Promise.race([ready, cap])
    .catch(() => undefined)
    .then(() => {
      if (timer) clearTimeout(timer);
      try {
        w.focus?.();
        w.print();
      } catch {
        // Ventana cerrada antes de tiempo: no hay nada que imprimir.
      }
    });
}
