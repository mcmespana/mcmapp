/**
 * Petición de «abre el compositor de Compartiendo» desde fuera de la pantalla.
 *
 * El «+» del grupo de acciones flotante (`EventActionButtons`) lo pinta el
 * LAYOUT del stack, no la pantalla. Hasta noviembre de 2026 abría el
 * formulario navegando otra vez a la misma ruta con un `openFormNonce` nuevo:
 * `router.push` apilaba OTRA copia de la pantalla, esa copia nacía con el
 * nonce ya puesto (así que nunca lo veía «cambiar») y el formulario no se
 * abría. Cada toque, una pantalla más encima, idéntica: el bucle.
 *
 * Ahora el layout no navega: avisa. Escucha solo la pantalla de Compartiendo
 * que está ENFOCADA (se suscribe con `useFocusEffect`), porque un `Modal` de RN
 * se pinta encima de todo aunque su pantalla esté en otra pestaña.
 * Lo vigila `__tests__/reflexionesComposerRequests.test.ts`.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

/** Pide abrir el compositor. `false` si no hay ninguna pantalla escuchando. */
export function requestReflexionComposer(): boolean {
  if (listeners.size === 0) return false;
  listeners.forEach((l) => l());
  return true;
}

/** Escucha las peticiones. Devuelve la función para dejar de escuchar. */
export function onReflexionComposerRequest(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
