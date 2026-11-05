/**
 * Notas y cuerdas del afinador. Lógica pura: ni audio ni React.
 *
 * Todo se hace en «MIDI fraccionario» (69 = La 440): es la escala en la que
 * un semitono mide 1 y un cent 0,01, así que la distancia entre dos notas es
 * una resta, y el suavizado (`pitchTracker.ts`) promedia en una escala que el
 * oído percibe lineal — promediar hercios a secas tira hacia los agudos.
 */
import type { Notation } from '@/utils/chordNotation';

/** La de referencia. Fijo a propósito: el afinador no tiene ajustes. */
export const A4_HZ = 440;
const A4_MIDI = 69;

const NAMES_EN = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const;
// En el cantoral los acordes en español van en mayúsculas («LA»); aquí la
// nota se pinta enorme y sola, y en mayúsculas grita: «La», «Sol#».
const NAMES_ES = [
  'Do',
  'Do#',
  'Re',
  'Re#',
  'Mi',
  'Fa',
  'Fa#',
  'Sol',
  'Sol#',
  'La',
  'La#',
  'Si',
] as const;

export function frequencyToMidi(hz: number): number {
  return A4_MIDI + 12 * Math.log2(hz / A4_HZ);
}

export function midiToFrequency(midi: number): number {
  return A4_HZ * Math.pow(2, (midi - A4_MIDI) / 12);
}

/** Nombre de una nota MIDI entera, sin octava. */
export function noteName(midi: number, notation: Notation): string {
  const pc = ((Math.round(midi) % 12) + 12) % 12;
  return notation === 'ES' ? NAMES_ES[pc] : NAMES_EN[pc];
}

/** Octava científica (La 440 = A4, el Mi grave de la guitarra = E2). */
export function noteOctave(midi: number): number {
  return Math.floor(Math.round(midi) / 12) - 1;
}

/** Cents de `midi` respecto a `targetMidi` (positivo = alto). */
export function centsFrom(midi: number, targetMidi: number): number {
  return (midi - targetMidi) * 100;
}

export interface GuitarString {
  /** 6 = la más grave, 1 = la más aguda, como se cuentan en la guitarra. */
  number: 1 | 2 | 3 | 4 | 5 | 6;
  midi: number;
}

/** Afinación estándar, de grave a aguda: Mi La Re Sol Si Mi. */
export const STANDARD_TUNING: readonly GuitarString[] = [
  { number: 6, midi: 40 }, // E2 · 82,41 Hz
  { number: 5, midi: 45 }, // A2 · 110 Hz
  { number: 4, midi: 50 }, // D3 · 146,83 Hz
  { number: 3, midi: 55 }, // G3 · 196 Hz
  { number: 2, midi: 59 }, // B3 · 246,94 Hz
  { number: 1, midi: 64 }, // E4 · 329,63 Hz
];

/**
 * La cuerda que (probablemente) se está tocando: la más cercana en semitonos.
 * Una cuerda muy destemplada sigue cayendo en la suya, porque entre dos
 * cuerdas vecinas hay 4 o 5 semitonos y la frontera está a medio camino.
 */
export function nearestString(
  midi: number,
  tuning: readonly GuitarString[] = STANDARD_TUNING,
): number {
  let best = 0;
  let bestDist = Infinity;
  tuning.forEach((s, i) => {
    const d = Math.abs(midi - s.midi);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

/**
 * ¿Es razonable que esta nota salga de una guitarra afinando? Fuera de aquí
 * casi siempre es un armónico, un golpe o la voz de alguien al lado. Desde un
 * Re grave (Drop D, 73 Hz) hasta el Mi agudo con margen para pasarse.
 */
export const GUITAR_MIDI_RANGE = { min: 36, max: 72 } as const;
