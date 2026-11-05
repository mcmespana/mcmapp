/**
 * Un trozo de audio → `PitchFrame`. Sin estado entre llamadas salvo el
 * detector, que se reutiliza (crearlo cuesta: prepara la FFT).
 *
 * El detector es `pitchy` (github.com/ianprime0509/pitchy, MIT): JavaScript
 * puro, método de McLeod (MPM), pensado justo para afinadores en tiempo real.
 * Da la frecuencia y una «claridad» 0–1 que es la que nos dice si lo que ha
 * oído es una nota o ruido. Corre en el hilo de JS: con ventanas de 4096
 * muestras y ~20 análisis por segundo le sobra con la FFT que trae.
 */
import { PitchDetector } from 'pitchy';
import type { PitchFrame } from './pitchTracker';

/**
 * Muestras por análisis. A 48 kHz son 85 ms: caben ~7 periodos del Mi grave
 * (82 Hz), que es lo que necesita MPM para no confundirse de octava abajo.
 */
export const ANALYSIS_WINDOW = 4096;

/** Volumen (RMS) en dBFS. Silencio digital → −∞. */
export function rmsDb(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  const rms = Math.sqrt(sum / Math.max(1, samples.length));
  return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
}

export class FrameAnalyzer {
  private readonly detector: PitchDetector<Float32Array>;
  private readonly window: Float32Array;
  private filled = 0;

  constructor(readonly windowSize: number = ANALYSIS_WINDOW) {
    this.detector = PitchDetector.forFloat32Array(windowSize);
    // Por debajo de esto, pitchy devuelve claridad 0 sin buscar nada: es
    // silencio de sala. La puerta «de verdad» (−52 dB) está en el tracker;
    // esta solo ahorra trabajo.
    this.detector.minVolumeDecibels = -60;
    this.window = new Float32Array(windowSize);
  }

  /**
   * Mete muestras nuevas en la ventana deslizante. Devuelve `true` cuando la
   * ventana está llena (ya se puede analizar).
   */
  feed(chunk: Float32Array): boolean {
    const n = this.window.length;
    if (chunk.length >= n) {
      this.window.set(chunk.subarray(chunk.length - n));
      this.filled = n;
      return true;
    }
    // Desplaza lo que hay a la izquierda y copia lo nuevo al final.
    this.window.copyWithin(0, chunk.length);
    this.window.set(chunk, n - chunk.length);
    this.filled = Math.min(n, this.filled + chunk.length);
    return this.filled === n;
  }

  analyze(sampleRate: number, time: number): PitchFrame {
    const db = rmsDb(this.window);
    const [frequency, clarity] = this.detector.findPitch(
      this.window,
      sampleRate,
    );
    return {
      frequency: Number.isFinite(frequency) ? frequency : 0,
      clarity: Number.isFinite(clarity) ? clarity : 0,
      rmsDb: db,
      time,
    };
  }

  reset(): void {
    this.window.fill(0);
    this.filled = 0;
  }
}
