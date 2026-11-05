/**
 * Del «lo que ha oído el detector en este trozo de audio» a «lo que pinta el
 * afinador». Lógica pura y con el reloj inyectado, para poder probarla frame a
 * frame (`__tests__/tunerPitchTracker.test.ts`).
 *
 * La salida cruda de un detector de tono tiembla, salta a la octava cuando la
 * cuerda se apaga y se inventa notas con el ruido de la sala. Lo que hace que
 * un afinador se sienta «bueno» está casi todo aquí, no en el detector:
 *
 *  1. **Puerta**: sin volumen o sin claridad suficiente, el frame no cuenta.
 *     La última lectura se mantiene un rato (la cuerda se está apagando) y
 *     luego se vuelve a «escuchando».
 *  2. **Octavas**: un salto de ±12 semitonos justos respecto a lo que ya
 *     sonaba es un armónico, no otra nota; se corrige.
 *  3. **Mediana** de los últimos frames: quita los picos sueltos.
 *  4. **Media exponencial**: quita el temblor. Un cambio grande de nota que se
 *     confirma en dos frames reinicia la media (no se arrastra de una cuerda
 *     a otra).
 *  5. **Histéresis** en la cuerda objetivo y en el «afinado»: sin ella, en la
 *     frontera, el estado parpadea.
 *
 * Inspirado en lo que cuentan Tuneo (github.com/DonBraulio/tuneo) y
 * react-native-tuner-engine, adaptado a nuestro caso: solo guitarra, solo
 * afinación estándar.
 */
import {
  GUITAR_MIDI_RANGE,
  STANDARD_TUNING,
  centsFrom,
  frequencyToMidi,
  midiToFrequency,
  nearestString,
  type GuitarString,
} from './notes';

export interface PitchFrame {
  /** Hz que da el detector (0 si no ha encontrado nada). */
  frequency: number;
  /** 0–1: cómo de clara es la nota (por debajo, es ruido). */
  clarity: number;
  /** Volumen del trozo en dBFS (0 = máximo, −∞ = silencio). */
  rmsDb: number;
  /** Instante del frame, en ms. */
  time: number;
}

export interface TunerReading {
  /** `idle`: no suena nada (o hace rato que dejó de sonar). */
  status: 'idle' | 'pitch';
  /** MIDI suavizado (fraccionario). */
  midi: number;
  frequency: number;
  /** Índice en la afinación de la cuerda a la que se está afinando. */
  stringIndex: number;
  targetMidi: number;
  /** Cents respecto a la cuerda objetivo (positivo = alto). */
  cents: number;
  /** Afinada y aguantando: se enciende el «bloqueo». */
  inTune: boolean;
}

export const TRACKER_DEFAULTS = {
  /** Claridad mínima (McLeod): por debajo es ruido o un acorde. */
  minClarity: 0.88,
  /** Puerta de volumen. Un móvil a un metro de una acústica da −35 / −25. */
  gateDb: -52,
  /** Cuánto se aguanta la última lectura tras dejar de oír la cuerda. */
  releaseMs: 900,
  /** Frames para la mediana. */
  medianSize: 5,
  /** Peso de lo nuevo en la media exponencial (0–1). */
  emaAlpha: 0.3,
  /** A partir de cuántos semitonos un cambio es «otra nota» y no temblor. */
  jumpSemitones: 0.8,
  /** Frames seguidos que tiene que durar la otra cuerda para cambiar a ella. */
  stringSwitchFrames: 3,
  /** Entra en «afinada» dentro de ±este margen… */
  inTuneCents: 5,
  /** …si aguanta este tiempo… */
  inTuneHoldMs: 350,
  /** …y sale si se va más allá de este otro (histéresis). */
  outOfTuneCents: 9,
} as const;

export type TrackerOptions = Partial<
  Record<keyof typeof TRACKER_DEFAULTS, number>
> & {
  tuning?: readonly GuitarString[];
};

/**
 * Semitonos a partir de los que una nota es, sin duda, de otra cuerda (entre
 * cuerdas vecinas hay 4 o 5: la frontera está a 2–2,5).
 */
const CLEARLY_OTHER_STRING = 3;

/** Lectura «no suena nada». */
export const IDLE_READING: TunerReading = {
  status: 'idle',
  midi: 0,
  frequency: 0,
  stringIndex: -1,
  targetMidi: 0,
  cents: 0,
  inTune: false,
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export class PitchTracker {
  private readonly opts: Record<keyof typeof TRACKER_DEFAULTS, number>;
  private readonly tuning: readonly GuitarString[];
  private history: number[] = [];
  private smoothed: number | null = null;
  private pendingJump: number | null = null;
  private lastValidAt = -Infinity;
  private stringIndex = -1;
  private stringCandidate = -1;
  private stringCandidateFrames = 0;
  private inTune = false;
  private inTuneSince: number | null = null;
  private lockedString: number | null = null;
  private reading: TunerReading = IDLE_READING;

  constructor(options: TrackerOptions = {}) {
    const { tuning, ...rest } = options;
    this.opts = { ...TRACKER_DEFAULTS, ...rest };
    this.tuning = tuning ?? STANDARD_TUNING;
  }

  /**
   * Fija la cuerda objetivo (el usuario la ha tocado en la fila de cuerdas) o
   * vuelve al modo automático con `null`.
   */
  setLockedString(index: number | null): void {
    this.lockedString =
      index !== null && index >= 0 && index < this.tuning.length ? index : null;
    if (this.lockedString !== null) this.stringIndex = this.lockedString;
    this.inTune = false;
    this.inTuneSince = null;
  }

  reset(): void {
    this.history = [];
    this.smoothed = null;
    this.pendingJump = null;
    this.lastValidAt = -Infinity;
    this.stringCandidate = -1;
    this.stringCandidateFrames = 0;
    this.inTune = false;
    this.inTuneSince = null;
    this.stringIndex = this.lockedString ?? -1;
    this.reading = IDLE_READING;
  }

  get current(): TunerReading {
    return this.reading;
  }

  push(frame: PitchFrame): TunerReading {
    const o = this.opts;
    let midi =
      frame.frequency > 0 ? frequencyToMidi(frame.frequency) : Number.NaN;
    const valid =
      Number.isFinite(midi) &&
      frame.clarity >= o.minClarity &&
      frame.rmsDb >= o.gateDb &&
      midi >= GUITAR_MIDI_RANGE.min &&
      midi <= GUITAR_MIDI_RANGE.max;

    if (!valid) {
      // Se apaga la cuerda: se mantiene lo último un rato, sin «afinada»
      // nueva (no se puede ganar el bloqueo con una nota que ya no suena).
      if (frame.time - this.lastValidAt > o.releaseMs) {
        this.reset();
      } else {
        this.inTuneSince = null;
      }
      return this.reading;
    }

    this.lastValidAt = frame.time;

    // Armónicos: la octava justa de lo que ya sonaba es la misma nota.
    if (this.smoothed !== null) {
      if (Math.abs(midi - 12 - this.smoothed) < 0.5) midi -= 12;
      else if (Math.abs(midi + 12 - this.smoothed) < 0.5) midi += 12;
    }

    // Un salto grande tiene que confirmarse en dos frames seguidos; si se
    // confirma, empezamos de cero en la nota nueva.
    let jumped = false;
    if (
      this.smoothed !== null &&
      Math.abs(midi - this.smoothed) > o.jumpSemitones
    ) {
      if (
        this.pendingJump !== null &&
        Math.abs(midi - this.pendingJump) < o.jumpSemitones
      ) {
        this.pendingJump = null;
        this.history = [midi];
        this.smoothed = midi;
        jumped = true;
        this.inTune = false;
        this.inTuneSince = null;
      } else {
        this.pendingJump = midi;
        return this.reading;
      }
    } else {
      this.pendingJump = null;
      this.history.push(midi);
      if (this.history.length > o.medianSize) this.history.shift();
      const m = median(this.history);
      this.smoothed =
        this.smoothed === null
          ? m
          : this.smoothed + o.emaAlpha * (m - this.smoothed);
    }

    const smoothed = this.smoothed as number;
    this.updateString(smoothed, jumped);
    const target = this.tuning[this.stringIndex].midi;
    const cents = centsFrom(smoothed, target);
    this.updateInTune(cents, frame.time);

    this.reading = {
      status: 'pitch',
      midi: smoothed,
      frequency: midiToFrequency(smoothed),
      stringIndex: this.stringIndex,
      targetMidi: target,
      cents,
      inTune: this.inTune,
    };
    return this.reading;
  }

  private updateString(midi: number, jumped: boolean): void {
    if (this.lockedString !== null) {
      this.stringIndex = this.lockedString;
      return;
    }
    const nearest = nearestString(midi, this.tuning);
    // La espera de varios frames es para la FRONTERA entre dos cuerdas
    // (una muy destemplada, a medio camino). Si ya se ha confirmado otra nota,
    // o está claramente lejos de la cuerda de antes, se cambia ya: si no, se
    // veía un instante «La · +1013 cents» al pasar del La al Sol.
    const far =
      this.stringIndex >= 0 &&
      Math.abs(midi - this.tuning[this.stringIndex].midi) >
        CLEARLY_OTHER_STRING;
    if (this.stringIndex < 0 || jumped || far) {
      if (nearest !== this.stringIndex) {
        this.inTune = false;
        this.inTuneSince = null;
      }
      this.stringIndex = nearest;
      this.stringCandidate = -1;
      this.stringCandidateFrames = 0;
      return;
    }
    if (nearest === this.stringIndex) {
      this.stringCandidate = -1;
      this.stringCandidateFrames = 0;
      return;
    }
    if (nearest === this.stringCandidate) {
      this.stringCandidateFrames += 1;
    } else {
      this.stringCandidate = nearest;
      this.stringCandidateFrames = 1;
    }
    if (this.stringCandidateFrames >= this.opts.stringSwitchFrames) {
      this.stringIndex = nearest;
      this.stringCandidate = -1;
      this.stringCandidateFrames = 0;
      this.inTune = false;
      this.inTuneSince = null;
    }
  }

  private updateInTune(cents: number, time: number): void {
    const o = this.opts;
    const abs = Math.abs(cents);
    if (this.inTune) {
      if (abs > o.outOfTuneCents) {
        this.inTune = false;
        this.inTuneSince = null;
      }
      return;
    }
    if (abs <= o.inTuneCents) {
      if (this.inTuneSince === null) this.inTuneSince = time;
      if (time - this.inTuneSince >= o.inTuneHoldMs) this.inTune = true;
    } else {
      this.inTuneSince = null;
    }
  }
}
