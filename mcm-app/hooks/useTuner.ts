/**
 * El afinador encendido: micrófono → `FrameAnalyzer` (pitchy) →
 * `PitchTracker` (suavizado) → una lectura para pintar.
 *
 * - Escucha solo con la pantalla delante (foco) y la app en primer plano:
 *   al salir, al ir a segundo plano o al cerrar la hoja, se suelta el
 *   micrófono (el punto naranja/verde del sistema se apaga enseguida).
 * - Analiza ~22 veces por segundo como mucho, pase lo que pase con el ritmo
 *   al que llegan los trozos (en web llegan a 60 por segundo).
 * - Solo vuelve a pintar cuando la lectura cambia de verdad: la aguja se
 *   mueve con un muelle en el hilo de UI, no hace falta re-renderizar por
 *   cada décima de cent.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router/react-navigation';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import {
  getMicrophonePermission,
  isMicrophoneSupported,
  requestMicrophonePermission,
  startMicrophone,
} from '@/services/tuner/microphone';
import type { MicSession } from '@/services/tuner/types';
import { FrameAnalyzer } from '@/utils/tuner/detectPitch';
import {
  IDLE_READING,
  PitchTracker,
  type TunerReading,
} from '@/utils/tuner/pitchTracker';
import { logger } from '@/utils/logger';
import { h } from '@/utils/haptics';
import { STANDARD_TUNING } from '@/utils/tuner/notes';

/** Muestras por trozo pedido al micrófono (~43 ms a 48 kHz). */
const CHUNK_SIZE = 2048;
/** Separación mínima entre análisis. */
const ANALYSIS_INTERVAL_MS = 45;

export type TunerStatus =
  /** Aún no se sabe si hay permiso. */
  | 'checking'
  /** Hay que pedir el micrófono (o, en web, tocar para empezar). */
  | 'needs-permission'
  /** Denegado: solo se arregla en Ajustes. */
  | 'denied'
  /** Este navegador o dispositivo no tiene micrófono utilizable. */
  | 'unavailable'
  | 'starting'
  | 'listening';

export interface Tuner {
  status: TunerStatus;
  reading: TunerReading;
  /** Volumen 0–1 (para el «te estoy oyendo»), en el hilo de UI. */
  level: SharedValue<number>;
  /** Pide el micrófono si hace falta y empieza a escuchar. */
  start: () => void;
  /** Fija una cuerda (índice en la afinación) o vuelve a automático. */
  lockString: (index: number | null) => void;
  lockedString: number | null;
  /** Cuerdas (índices) ya afinadas en esta sesión. */
  tuned: ReadonlySet<number>;
}

/** −60 dB → 0, −10 dB → 1. */
function dbToLevel(db: number): number {
  if (!Number.isFinite(db)) return 0;
  return Math.min(1, Math.max(0, (db + 60) / 50));
}

function sameReading(a: TunerReading, b: TunerReading): boolean {
  return (
    a.status === b.status &&
    a.stringIndex === b.stringIndex &&
    a.inTune === b.inTune &&
    Math.abs(a.cents - b.cents) < 0.5
  );
}

export function useTuner(): Tuner {
  const trackerRef = useRef<PitchTracker | null>(null);
  const analyzerRef = useRef<FrameAnalyzer | null>(null);
  const sessionRef = useRef<MicSession | null>(null);
  const lastAnalysisRef = useRef(0);
  const focusedRef = useRef(false);
  const startingRef = useRef(false);

  const [status, setStatus] = useState<TunerStatus>('checking');
  const [reading, setReading] = useState<TunerReading>(IDLE_READING);
  const [lockedString, setLockedString] = useState<number | null>(null);
  // Cuerdas que ya se han afinado mientras el afinador está abierto.
  const [tuned, setTuned] = useState<ReadonlySet<number>>(() => new Set());
  const tunedRef = useRef<ReadonlySet<number>>(tuned);
  const wasInTuneRef = useRef(false);
  const level = useSharedValue(0);

  const tracker = () => (trackerRef.current ??= new PitchTracker());
  const analyzer = () => (analyzerRef.current ??= new FrameAnalyzer());

  const stop = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    analyzerRef.current?.reset();
    trackerRef.current?.reset();
    level.set(0);
    wasInTuneRef.current = false;
    setReading(IDLE_READING);
  }, [level]);

  const onFrame = useCallback(
    (samples: Float32Array, sampleRate: number) => {
      const a = analyzer();
      if (!a.feed(samples)) return;
      const now = Date.now();
      if (now - lastAnalysisRef.current < ANALYSIS_INTERVAL_MS) return;
      lastAnalysisRef.current = now;
      const frame = a.analyze(sampleRate, now);
      level.set(dbToLevel(frame.rmsDb));
      const next = tracker().push(frame);
      setReading((prev) => (sameReading(prev, next) ? prev : next));

      // El «bloqueo»: se nota en la mano al entrar en afinada, y la cuerda
      // queda marcada. Con las seis, la vibración de «hecho».
      const locked = next.status === 'pitch' && next.inTune;
      if (locked && !wasInTuneRef.current) {
        h.success();
        if (!tunedRef.current.has(next.stringIndex)) {
          const all = new Set(tunedRef.current);
          all.add(next.stringIndex);
          tunedRef.current = all;
          setTuned(all);
          if (all.size === STANDARD_TUNING.length) h.formSuccess();
        }
      }
      wasInTuneRef.current = locked;
    },
    [level],
  );

  const open = useCallback(async () => {
    if (sessionRef.current || startingRef.current) return;
    startingRef.current = true;
    setStatus('starting');
    try {
      const session = await startMicrophone({ onFrame, frameSize: CHUNK_SIZE });
      // Se ha cerrado la hoja mientras se abría el micrófono.
      if (!focusedRef.current) {
        session.stop();
        return;
      }
      sessionRef.current = session;
      setStatus('listening');
    } catch (e) {
      const code = (e as { code?: string })?.code;
      logger.warn('tuner: no se ha podido abrir el micrófono', e);
      setStatus(code === 'denied' ? 'denied' : 'unavailable');
    } finally {
      startingRef.current = false;
    }
  }, [onFrame]);

  const start = useCallback(() => {
    void (async () => {
      if (!isMicrophoneSupported()) {
        setStatus('unavailable');
        return;
      }
      const current = await getMicrophonePermission();
      if (current === 'denied') {
        setStatus('denied');
        return;
      }
      if (current !== 'granted') {
        const asked = await requestMicrophonePermission();
        // En web el permiso lo pide el propio `getUserMedia`: se sigue.
        if (asked === 'denied') {
          setStatus('denied');
          return;
        }
      }
      await open();
    })();
  }, [open]);

  // Al entrar: si ya hay permiso, a escuchar sin tocar nada. Si no, se
  // enseña el porqué antes de que salga el diálogo del sistema.
  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      let cancelled = false;
      void (async () => {
        if (!isMicrophoneSupported()) {
          setStatus('unavailable');
          return;
        }
        const p = await getMicrophonePermission();
        if (cancelled) return;
        if (p === 'granted') await open();
        else setStatus(p === 'denied' ? 'denied' : 'needs-permission');
      })();
      return () => {
        cancelled = true;
        focusedRef.current = false;
        stop();
      };
    }, [open, stop]),
  );

  // Segundo plano: se suelta el micrófono; al volver, se retoma.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (!focusedRef.current) return;
      if (state === 'active') {
        if (!sessionRef.current) {
          void getMicrophonePermission().then((p) => {
            if (p === 'granted' && focusedRef.current) void open();
          });
        }
      } else if (state === 'background') {
        stop();
        setStatus((s) => (s === 'listening' ? 'starting' : s));
      }
    });
    return () => sub.remove();
  }, [open, stop]);

  const lockString = useCallback((index: number | null) => {
    tracker().setLockedString(index);
    setLockedString(index);
  }, []);

  return { status, reading, level, start, lockString, lockedString, tuned };
}
