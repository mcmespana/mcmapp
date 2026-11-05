import {
  PitchTracker,
  TRACKER_DEFAULTS,
  type PitchFrame,
} from '@/utils/tuner/pitchTracker';
import {
  STANDARD_TUNING,
  frequencyToMidi,
  midiToFrequency,
  nearestString,
  noteName,
  noteOctave,
} from '@/utils/tuner/notes';

const FRAME_MS = 45;

/** Una tira de frames con la misma nota (Hz), limpia y con volumen. */
function frames(
  hz: number | ((i: number) => number),
  count: number,
  start = 0,
  extra: Partial<PitchFrame> = {},
): PitchFrame[] {
  return Array.from({ length: count }, (_, i) => ({
    frequency: typeof hz === 'function' ? hz(i) : hz,
    clarity: 0.97,
    rmsDb: -30,
    time: start + i * FRAME_MS,
    ...extra,
  }));
}

function run(tracker: PitchTracker, list: PitchFrame[]) {
  return list.map((f) => tracker.push(f)).at(-1)!;
}

const cents = (hz: number, c: number) => hz * Math.pow(2, c / 1200);

describe('notas', () => {
  it('La 440 es MIDI 69 y vuelve a 440', () => {
    expect(frequencyToMidi(440)).toBeCloseTo(69, 6);
    expect(midiToFrequency(69)).toBeCloseTo(440, 6);
  });

  it('las cuerdas al aire caen en su nota y octava', () => {
    const names = STANDARD_TUNING.map((s) => noteName(s.midi, 'EN'));
    expect(names).toEqual(['E', 'A', 'D', 'G', 'B', 'E']);
    expect(STANDARD_TUNING.map((s) => noteOctave(s.midi))).toEqual([
      2, 2, 3, 3, 3, 4,
    ]);
    expect(noteName(55, 'ES')).toBe('Sol');
    expect(noteName(61, 'ES')).toBe('Do#');
  });

  it('una cuerda destemplada sigue siendo la suya', () => {
    // Re (D3 = 50) bajado casi dos semitonos sigue siendo la 4.ª, no la 5.ª.
    expect(nearestString(48.2)).toBe(2);
    expect(nearestString(40)).toBe(0);
    expect(nearestString(63.4)).toBe(5);
  });
});

describe('PitchTracker', () => {
  it('sin sonido no hay lectura', () => {
    const t = new PitchTracker();
    const r = run(t, frames(0, 5, 0, { clarity: 0, rmsDb: -90 }));
    expect(r.status).toBe('idle');
  });

  it('una nota limpia da su cuerda y los cents', () => {
    const t = new PitchTracker();
    const r = run(t, frames(cents(110, -20), 20));
    expect(r.status).toBe('pitch');
    expect(r.stringIndex).toBe(1); // La
    expect(r.cents).toBeCloseTo(-20, 0);
  });

  it('ignora el ruido: claridad o volumen bajos no cuentan', () => {
    const t = new PitchTracker();
    run(t, frames(cents(196, 10), 15));
    const before = t.current.cents;
    run(t, frames(523, 6, 15 * FRAME_MS, { clarity: 0.4 }));
    run(t, frames(523, 6, 21 * FRAME_MS, { rmsDb: -80 }));
    expect(t.current.stringIndex).toBe(3);
    expect(t.current.cents).toBeCloseTo(before, 6);
  });

  it('aguanta la última lectura mientras la cuerda se apaga y luego suelta', () => {
    const t = new PitchTracker();
    run(t, frames(146.83, 12));
    const silenceStart = 12 * FRAME_MS;
    const quiet = (ms: number) =>
      t.push({ frequency: 0, clarity: 0, rmsDb: -90, time: silenceStart + ms });
    expect(quiet(200).status).toBe('pitch');
    expect(quiet(TRACKER_DEFAULTS.releaseMs + 200).status).toBe('idle');
  });

  it('corrige los saltos de octava (armónicos)', () => {
    const t = new PitchTracker();
    run(t, frames(82.41, 12));
    // El detector se va a la octava en un par de frames sueltos.
    const r = run(t, frames(164.82, 3, 12 * FRAME_MS));
    expect(r.stringIndex).toBe(0);
    expect(Math.abs(r.cents)).toBeLessThan(2);
  });

  it('un pico suelto no mueve la aguja', () => {
    const t = new PitchTracker();
    run(t, frames(246.94, 12));
    const steady = t.current.cents;
    // Un frame a medio tono y vuelta a la nota.
    t.push({
      frequency: 261.6,
      clarity: 0.95,
      rmsDb: -30,
      time: 12 * FRAME_MS,
    });
    const r = run(t, frames(246.94, 2, 13 * FRAME_MS));
    expect(r.cents).toBeCloseTo(steady, 0);
    expect(r.stringIndex).toBe(4);
  });

  it('suaviza el temblor: ±8 cents alternos se quedan cerca de 0', () => {
    const t = new PitchTracker();
    const r = run(
      t,
      frames((i) => cents(329.63, i % 2 ? 8 : -8), 30),
    );
    expect(Math.abs(r.cents)).toBeLessThan(4);
  });

  it('cambia de cuerda cuando se toca otra (y no a la primera)', () => {
    const t = new PitchTracker();
    run(t, frames(110, 12));
    const r = run(t, frames(146.83, 8, 12 * FRAME_MS));
    expect(r.stringIndex).toBe(2);
    expect(Math.abs(r.cents)).toBeLessThan(2);
  });

  it('«afinada» solo tras aguantar, y con histéresis para salir', () => {
    const t = new PitchTracker();
    // Primer frame dentro del margen: aún no.
    expect(t.push(frames(cents(196, 2), 1)[0]).inTune).toBe(false);
    let r = run(t, frames(cents(196, 2), 12, FRAME_MS));
    expect(r.inTune).toBe(true);
    // Se va a 7 cents: dentro de la histéresis, sigue afinada.
    r = run(t, frames(cents(196, 7), 25, 13 * FRAME_MS));
    expect(r.cents).toBeGreaterThan(5);
    expect(r.inTune).toBe(true);
    // A 20 cents ya no.
    r = run(t, frames(cents(196, 20), 30, 38 * FRAME_MS));
    expect(r.inTune).toBe(false);
  });

  it('con una cuerda fijada mide contra ella aunque suene otra', () => {
    const t = new PitchTracker();
    t.setLockedString(0); // Mi grave
    const r = run(t, frames(87.31, 15)); // Fa: un semitono alto
    expect(r.stringIndex).toBe(0);
    expect(r.cents).toBeCloseTo(100, 0);
    t.setLockedString(null);
    const auto = run(t, frames(110, 15, 15 * FRAME_MS));
    expect(auto.stringIndex).toBe(1);
  });
});

describe('PitchTracker · cambio de cuerda', () => {
  it('al pasar a otra cuerda nunca enseña la nota nueva medida contra la vieja', () => {
    const t = new PitchTracker();
    run(t, frames(110, 12));
    const seen = frames(196, 10, 12 * FRAME_MS).map((f) => t.push(f));
    for (const r of seen) expect(Math.abs(r.cents)).toBeLessThan(60);
    expect(seen.at(-1)!.stringIndex).toBe(3);
  });
});
