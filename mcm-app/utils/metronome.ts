/**
 * Metrónomo: la parte que se puede probar sin altavoz.
 *
 * El sonido (`services/metronome/engine.ts`) se programa por adelantado sobre
 * el reloj del audio; aquí están las cuentas — qué pulsos caen en la próxima
 * ventana, el tempo que sale de marcarlo con el dedo y los topes.
 */

export const MIN_BPM = 40;
export const MAX_BPM = 220;
export const DEFAULT_BPM = 90;

/** Pulsos por compás que se ofrecen. `1` es «sin acento». */
export const BEATS_OPTIONS = [1, 2, 3, 4, 6] as const;
export type BeatsPerBar = (typeof BEATS_OPTIONS)[number];
export const DEFAULT_BEATS: BeatsPerBar = 4;

export function clampBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return DEFAULT_BPM;
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
}

export function isBeatsPerBar(n: unknown): n is BeatsPerBar {
  return (BEATS_OPTIONS as readonly unknown[]).includes(n);
}

/** Segundos entre dos pulsos. */
export function beatInterval(bpm: number): number {
  return 60 / clampBpm(bpm);
}

export interface ScheduledBeat {
  /** Momento del pulso en el reloj del audio (segundos). */
  time: number;
  /** Posición dentro del compás, desde 0. */
  index: number;
  /** El primero del compás suena distinto (si hay más de un pulso). */
  accent: boolean;
}

export interface BeatCursor {
  /** Cuándo cae el siguiente pulso sin programar. */
  nextTime: number;
  /** Su posición en el compás. */
  nextIndex: number;
}

/**
 * Los pulsos que caen antes de `until`, y el cursor para la siguiente vuelta.
 * Se llama cada pocos milisegundos con una ventana corta: así un cambio de
 * tempo se oye en el pulso siguiente y un tirón del hilo de JS no descoloca
 * el ritmo (los pulsos ya programados los lleva el audio).
 */
export function beatsUntil(
  cursor: BeatCursor,
  until: number,
  bpm: number,
  beatsPerBar: number,
): { beats: ScheduledBeat[]; cursor: BeatCursor } {
  const step = beatInterval(bpm);
  const bar = Math.max(1, Math.floor(beatsPerBar));
  const beats: ScheduledBeat[] = [];
  let { nextTime, nextIndex } = cursor;
  nextIndex = ((nextIndex % bar) + bar) % bar;
  // Tope de seguridad: una ventana nunca trae más que unos pocos pulsos.
  while (nextTime < until && beats.length < 16) {
    beats.push({
      time: nextTime,
      index: nextIndex,
      accent: bar > 1 && nextIndex === 0,
    });
    nextTime += step;
    nextIndex = (nextIndex + 1) % bar;
  }
  return { beats, cursor: { nextTime, nextIndex } };
}

/** Más de esto entre dos toques y se empieza a contar de nuevo. */
export const TAP_RESET_MS = 2000;
const TAP_MEMORY = 6;

/**
 * Marcar el tempo con el dedo. Devuelve los toques que siguen contando y, con
 * dos o más, el tempo: la media de los últimos intervalos, que perdona un
 * toque algo adelantado sin quedarse pegada al principio.
 */
export function tapTempo(
  taps: readonly number[],
  now: number,
): { taps: number[]; bpm: number | null } {
  const last = taps[taps.length - 1];
  const kept =
    last !== undefined && now - last <= TAP_RESET_MS && now > last
      ? [...taps, now].slice(-TAP_MEMORY)
      : [now];
  if (kept.length < 2) return { taps: kept, bpm: null };
  const span = kept[kept.length - 1] - kept[0];
  const avg = span / (kept.length - 1);
  return { taps: kept, bpm: clampBpm(60000 / avg) };
}

// ── Al cerrar la hoja con el metrónomo sonando ──────────────────────────────

/**
 * Qué hacer al cerrar la hoja con el metrónomo sonando: preguntar (por
 * defecto), dejarlo siempre sonando o pararlo siempre («No volver a
 * preguntar»). Se guarda junto al tempo en `@metronome`.
 */
export type KeepOnClose = 'ask' | 'keep' | 'stop';

export function isKeepOnClose(v: unknown): v is KeepOnClose {
  return v === 'ask' || v === 'keep' || v === 'stop';
}

/** Lo que pasa al cerrar la hoja. Parado, nada que decidir. */
export function onSheetClose(
  playing: boolean,
  pref: KeepOnClose,
): 'nothing' | 'ask' | 'keep' | 'stop' {
  if (!playing) return 'nothing';
  return pref;
}
