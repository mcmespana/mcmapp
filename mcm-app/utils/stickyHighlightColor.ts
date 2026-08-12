import {
  HIGHLIGHT_COLOR_KEYS,
  type HighlightColorKey,
} from '@/utils/highlightRanges';

/**
 * Color "de turno" para subrayar sin elegir.
 *
 * Cuando se subraya desde el menú nativo del sistema no hay ocasión de elegir
 * color: el gesto es "selecciono → Subrayar" y ahí se acaba. Pedir el color
 * después obliga a un toque más justo cuando la persona ya daba la frase por
 * marcada. Así que se elige uno al azar y se MANTIENE un rato: subrayar tres
 * frases seguidas las deja del mismo color (que es lo que uno espera al
 * subrayar un texto), y de un día para otro cambia solo.
 *
 * La barra de colores sigue saliendo con el color puesto marcado, así que
 * cambiarlo es un toque — pero solo si apetece.
 */
const STICKY_MS = 8 * 60 * 1000;

let current: { color: HighlightColorKey; at: number } | null = null;

/** Elige uno al azar, evitando repetir el anterior si hay más de uno. */
function randomColor(previous?: HighlightColorKey): HighlightColorKey {
  const pool =
    previous && HIGHLIGHT_COLOR_KEYS.length > 1
      ? HIGHLIGHT_COLOR_KEYS.filter((k) => k !== previous)
      : HIGHLIGHT_COLOR_KEYS;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Color con el que subrayar ahora mismo. El mismo durante `STICKY_MS` desde que
 * se eligió; pasado ese rato, otro al azar.
 *
 * `now` se puede inyectar en tests.
 */
export function pickStickyHighlightColor(
  now: number = Date.now(),
): HighlightColorKey {
  if (current && now - current.at < STICKY_MS) {
    return current.color;
  }
  current = { color: randomColor(current?.color), at: now };
  return current.color;
}

/** Solo para tests: olvida el color de turno. */
export function resetStickyHighlightColor(): void {
  current = null;
}
