/** Contrato común del micrófono del afinador (nativo y web). */

export type MicPermission = 'granted' | 'denied' | 'undetermined';

export interface StartMicOptions {
  /**
   * Recibe audio mono en float (−1…1). En nativo son trozos NUEVOS y
   * consecutivos, que `FrameAnalyzer.feed` va encadenando; en web cada entrega
   * es la ventana de análisis completa (una foto que se solapa con la
   * anterior), y `feed` la sustituye entera. Nunca entregues fotos solapadas
   * más cortas que la ventana: encadenadas, falsean el tono.
   */
  onFrame: (samples: Float32Array, sampleRate: number) => void;
  /** Muestras por trozo que se piden. */
  frameSize: number;
}

export interface MicSession {
  sampleRate: number;
  stop(): void;
}

/** Errores de `startMicrophone`, en `error.code`. */
export type MicErrorCode = 'denied' | 'unavailable' | 'unsupported';
