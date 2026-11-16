/**
 * El metrónomo encendido: tempo, compás y el pulso que suena ahora.
 *
 * - Suena solo con la pantalla delante: al cerrar la hoja o ir a segundo
 *   plano, se para (no hay audio en segundo plano en la app).
 * - El tempo y el compás se recuerdan entre sesiones.
 * - Cambiar el tempo mientras suena se oye en el pulso siguiente, sin cortar.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router/react-navigation';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import {
  startMetronome,
  type MetronomeSession,
} from '@/services/metronome/engine';
import {
  DEFAULT_BEATS,
  DEFAULT_BPM,
  clampBpm,
  isBeatsPerBar,
  tapTempo,
  type BeatsPerBar,
} from '@/utils/metronome';
import { logger } from '@/utils/logger';

const STORAGE_KEY = '@metronome';

export interface Metronome {
  bpm: number;
  beatsPerBar: BeatsPerBar;
  playing: boolean;
  /** Pulso que acaba de sonar (−1 parado). */
  beat: number;
  /** Sube en cada pulso: para animar en el hilo de UI sin repintar. */
  pulse: SharedValue<number>;
  /** No se pudo abrir el audio (navegador sin sonido, p. ej.). */
  failed: boolean;
  setBpm: (bpm: number) => void;
  setBeatsPerBar: (beats: BeatsPerBar) => void;
  toggle: () => void;
  /** Un toque de «marcar el tempo». */
  tap: () => void;
}

export function useMetronome(): Metronome {
  const [bpm, setBpmState] = useState(DEFAULT_BPM);
  const [beatsPerBar, setBeatsState] = useState<BeatsPerBar>(DEFAULT_BEATS);
  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState(-1);
  const [failed, setFailed] = useState(false);
  const pulse = useSharedValue(0);

  // El motor lee siempre lo último sin reiniciarse.
  const bpmRef = useRef(bpm);
  const beatsRef = useRef<number>(beatsPerBar);
  const sessionRef = useRef<MetronomeSession | null>(null);
  const startingRef = useRef(false);
  const tapsRef = useRef<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        const saved = JSON.parse(raw) as { bpm?: number; beats?: number };
        if (typeof saved.bpm === 'number') {
          const v = clampBpm(saved.bpm);
          bpmRef.current = v;
          setBpmState(v);
        }
        if (isBeatsPerBar(saved.beats)) {
          beatsRef.current = saved.beats;
          setBeatsState(saved.beats);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(() => {
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ bpm: bpmRef.current, beats: beatsRef.current }),
    ).catch(() => {});
  }, []);

  const setBpm = useCallback(
    (next: number) => {
      const v = clampBpm(next);
      bpmRef.current = v;
      setBpmState(v);
      persist();
    },
    [persist],
  );

  const setBeatsPerBar = useCallback(
    (next: BeatsPerBar) => {
      beatsRef.current = next;
      setBeatsState(next);
      persist();
    },
    [persist],
  );

  const stop = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setPlaying(false);
    setBeat(-1);
  }, []);

  const start = useCallback(async () => {
    if (sessionRef.current || startingRef.current) return;
    startingRef.current = true;
    try {
      const session = await startMetronome({
        getBpm: () => bpmRef.current,
        getBeatsPerBar: () => beatsRef.current,
        onBeat: (index) => {
          setBeat(index);
          pulse.set(pulse.get() + 1);
        },
      });
      sessionRef.current = session;
      setFailed(false);
      setPlaying(true);
    } catch (e) {
      logger.warn('metronome: start failed', e);
      setFailed(true);
    } finally {
      startingRef.current = false;
    }
  }, [pulse]);

  const toggle = useCallback(() => {
    if (sessionRef.current) stop();
    else void start();
  }, [start, stop]);

  const tap = useCallback(() => {
    const next = tapTempo(tapsRef.current, Date.now());
    tapsRef.current = next.taps;
    if (next.bpm !== null) setBpm(next.bpm);
  }, [setBpm]);

  // Al salir de la pantalla (o cerrar la hoja), silencio.
  useFocusEffect(useCallback(() => stop, [stop]));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') stop();
    });
    return () => sub.remove();
  }, [stop]);

  return {
    bpm,
    beatsPerBar,
    playing,
    beat,
    pulse,
    failed,
    setBpm,
    setBeatsPerBar,
    toggle,
    tap,
  };
}
