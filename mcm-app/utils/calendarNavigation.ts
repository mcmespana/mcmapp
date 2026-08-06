// utils/calendarNavigation.ts
//
// Fecha pendiente de abrir en el Calendario (p.ej. al tocar una tarjeta de
// "Próximos eventos" en la Home).
//
// ¿Por qué un store y no un route param? Porque el Calendario se alcanza por
// varias vías (tab propio, o pantalla `Calendario` dentro del stack de "Más")
// y cada una entrega los params por un canal distinto: la ruta de expo-router
// en un caso, los params de React Navigation en el otro, y ninguno de los dos
// llega al `CalendarScreen` cuando está envuelto en su propio stack interno.
// Un store one-shot funciona igual en las tres plataformas y por cualquier vía.
//
// Igual que los otros stores de navegación pendiente, la fecha CADUCA: si nadie
// la consume (porque la navegación no llegó a ocurrir), se descarta en vez de
// saltar en la siguiente visita al calendario.

interface PendingDate {
  date: string;
  at: number;
}

const PENDING_TTL_MS = 15000;

let pending: PendingDate | null = null;
const listeners = new Set<() => void>();

/** Guarda la fecha (`YYYY-MM-DD`) a la que debe saltar el calendario. */
export const setPendingCalendarDate = (date: string): void => {
  pending = { date, at: Date.now() };
  [...listeners].forEach((listener) => listener());
};

/** Descarta la fecha pendiente. */
export const clearPendingCalendarDate = (): void => {
  pending = null;
};

/** Lee y limpia la fecha pendiente (one-shot). Null si no hay o si caducó. */
export const takePendingCalendarDate = (): string | null => {
  const current = pending;
  pending = null;
  if (!current) return null;
  if (Date.now() - current.at > PENDING_TTL_MS) return null;
  return current.date;
};

/**
 * Avisa cuando alguien guarda una fecha pendiente, para el caso en que la
 * pantalla del calendario ya esté montada y con foco (entonces su
 * `useFocusEffect` no se vuelve a ejecutar).
 */
export const subscribePendingCalendarDate = (
  listener: () => void,
): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
