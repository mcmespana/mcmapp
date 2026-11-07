/**
 * El detector real (pitchy) con señales sintéticas: senos puros y una «cuerda»
 * con armónicos que se apaga, que es lo que de verdad le llega del micrófono.
 * Si alguien cambia la ventana, el detector o la puerta y el Mi grave deja de
 * reconocerse (o salta a la octava), esto se pone en rojo.
 */
import { FrameAnalyzer, rmsDb } from '@/utils/tuner/detectPitch';
import { PitchTracker } from '@/utils/tuner/pitchTracker';
import { STANDARD_TUNING, midiToFrequency } from '@/utils/tuner/notes';

const SR = 48000;

/** Cuerda: fundamental + armónicos que pesan más que ella, con decaimiento. */
function pluck(hz: number, n: number, offset = 0, amp = 0.3): Float32Array {
  const out = new Float32Array(n);
  const harmonics = [1, 1.4, 0.9, 0.6, 0.4, 0.25];
  for (let i = 0; i < n; i++) {
    const t = (offset + i) / SR;
    const env = Math.exp(-t * 0.8);
    let v = 0;
    harmonics.forEach((a, k) => {
      v += a * Math.sin(2 * Math.PI * hz * (k + 1) * t);
    });
    out[i] = (amp * env * v) / 3;
  }
  return out;
}

function sine(hz: number, n: number, amp = 0.3): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++)
    out[i] = amp * Math.sin((2 * Math.PI * hz * i) / SR);
  return out;
}

const centsOff = (got: number, want: number) => 1200 * Math.log2(got / want);

describe('FrameAnalyzer', () => {
  it('reconoce las seis cuerdas al aire con armónicos (±3 cents)', () => {
    for (const s of STANDARD_TUNING) {
      const hz = midiToFrequency(s.midi);
      const a = new FrameAnalyzer();
      expect(a.feed(pluck(hz, 4096))).toBe(true);
      const f = a.analyze(SR, 0);
      expect(f.clarity).toBeGreaterThan(0.9);
      expect(Math.abs(centsOff(f.frequency, hz))).toBeLessThan(3);
    }
  });

  it('mide una cuerda 20 cents baja', () => {
    const hz = midiToFrequency(45) * Math.pow(2, -20 / 1200);
    const a = new FrameAnalyzer();
    a.feed(sine(hz, 4096));
    const f = a.analyze(SR, 0);
    expect(centsOff(f.frequency, midiToFrequency(45))).toBeCloseTo(-20, 0);
  });

  it('el silencio no tiene nota', () => {
    const a = new FrameAnalyzer();
    a.feed(new Float32Array(4096));
    const f = a.analyze(SR, 0);
    expect(f.clarity).toBe(0);
    expect(f.rmsDb).toBe(-Infinity);
  });

  it('va llenando la ventana con trozos pequeños', () => {
    const a = new FrameAnalyzer(4096);
    const full = sine(196, 4096);
    expect(a.feed(full.subarray(0, 2048))).toBe(false);
    expect(a.feed(full.subarray(2048))).toBe(true);
    expect(Math.abs(centsOff(a.analyze(SR, 0).frequency, 196))).toBeLessThan(2);
  });

  it('rmsDb de un seno a media escala ≈ −9 dB', () => {
    expect(rmsDb(sine(440, 4800, 0.5))).toBeCloseTo(-9.03, 1);
  });
});

describe('cadena completa: Mi grave que se apaga', () => {
  it('se queda en la 6.ª, afinada, sin saltar a la octava', () => {
    const a = new FrameAnalyzer();
    const t = new PitchTracker();
    const hz = midiToFrequency(40);
    const chunk = 2048;
    let reading = t.current;
    for (let k = 0; k < 40; k++) {
      // Dos segundos de cuerda, a trozos como llegan del micrófono.
      if (!a.feed(pluck(hz, chunk, k * chunk))) continue;
      reading = t.push(a.analyze(SR, (k * chunk * 1000) / SR));
      if (reading.status === 'pitch') {
        expect(reading.stringIndex).toBe(0);
      }
    }
    expect(reading.status).toBe('pitch');
    expect(reading.inTune).toBe(true);
    expect(Math.abs(reading.cents)).toBeLessThan(3);
  });
});
