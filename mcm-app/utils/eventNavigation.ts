// utils/eventNavigation.ts
// Pending-navigation store para deep-link dentro del stack del tab de evento
// (p.ej. el banner "Evalúa la actividad" de la Home, que abre la pantalla
// `Evaluacion` dentro del tab del evento activo).
//
// Uso:
//   1. El emisor guarda la pantalla destino (+ params) y navega al tab del
//      evento (`router.navigate('/visitapapa')`).
//   2. El tab del evento lee y limpia el destino al recibir foco, y navega a
//      esa pantalla dentro de su stack nativo.
//
// Es deliberadamente genérico (string) porque el stack de evento se reutiliza
// para varios eventos (Jubileo, Visita Papa, …).
//
// Como en `masNavigation`, el destino CADUCA: si la navegación al tab no llega
// a ocurrir (tab oculto, ruta inexistente…), se descarta en vez de quedarse
// esperando y saltar en la siguiente visita al evento.

interface PendingEventNavigation {
  screen: string;
  params?: Record<string, unknown>;
}

interface StoredEventNavigation extends PendingEventNavigation {
  at: number;
}

const PENDING_TTL_MS = 15000;

let pending: StoredEventNavigation | null = null;

/** Guarda la pantalla (y params) a la que navegar dentro del stack de evento. */
export const setPendingEventScreen = (
  screen: string,
  params?: Record<string, unknown>,
): void => {
  pending = { screen, params, at: Date.now() };
};

/** Descarta el destino pendiente (p.ej. al navegar a otro sitio distinto). */
export const clearPendingEventScreen = (): void => {
  pending = null;
};

/** Lee y limpia el destino pendiente (one-shot). Null si no hay o si caducó. */
export const takePendingEventScreen = (): PendingEventNavigation | null => {
  const current = pending;
  pending = null;
  if (!current) return null;
  if (Date.now() - current.at > PENDING_TTL_MS) return null;
  return { screen: current.screen, params: current.params };
};
