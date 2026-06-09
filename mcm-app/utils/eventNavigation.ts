// utils/eventNavigation.ts
// Pending-navigation store para deep-link dentro del stack del tab de evento
// (p.ej. el banner "Evalúa la actividad" de la Home, que abre la pantalla
// `Evaluacion` dentro del tab del evento activo).
//
// Uso:
//   1. El emisor guarda la pantalla destino (+ params) y navega al tab del
//      evento (`router.push('/visitapapa')`).
//   2. El tab del evento lee y limpia el destino al recibir foco, y navega a
//      esa pantalla dentro de su stack nativo.
//
// Es deliberadamente genérico (string) porque el stack de evento se reutiliza
// para varios eventos (Jubileo, Visita Papa, …).

interface PendingEventNavigation {
  screen: string;
  params?: Record<string, unknown>;
}

let pending: PendingEventNavigation | null = null;

/** Guarda la pantalla (y params) a la que navegar dentro del stack de evento. */
export const setPendingEventScreen = (
  screen: string,
  params?: Record<string, unknown>,
): void => {
  pending = { screen, params };
};

/** Lee y limpia el destino pendiente (one-shot). Null si no hay nada. */
export const takePendingEventScreen = (): PendingEventNavigation | null => {
  const current = pending;
  pending = null;
  return current;
};
