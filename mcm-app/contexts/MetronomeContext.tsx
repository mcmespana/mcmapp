/**
 * El metrónomo del cantoral, compartido por todas sus pantallas: así puede
 * seguir sonando al cerrar la hoja (para tocar una canción con él) y se
 * controla desde el botón flotante (`components/tuner/MetronomeFloating.tsx`).
 * Lo monta el layout del cantoral (`app/(tabs)/cancionero/_layout.tsx`).
 *
 * - Al cerrar la hoja sonando: pregunta si dejarlo sonando
 *   (`components/tuner/KeepMetronomePrompt.tsx`), salvo que se marcara «No
 *   volver a preguntar» (`keepOnClose`, guardado con el tempo).
 * - Al ir a segundo plano se para (no hay audio en segundo plano en la app).
 * - Mientras suena, la pantalla no se apaga.
 * - El tempo, el compás y la preferencia se recuerdan (`@metronome`).
 * - Cambiar el tempo mientras suena se oye en el pulso siguiente, sin cortar.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
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
  isKeepOnClose,
  onSheetClose,
  tapTempo,
  type BeatsPerBar,
  type KeepOnClose,
} from '@/utils/metronome';
import { logger } from '@/utils/logger';

const STORAGE_KEY = '@metronome';
const KEEP_AWAKE_TAG = 'metronome-playing';

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
  /** Qué hacer al cerrar la hoja sonando. */
  keepOnClose: KeepOnClose;
  /** ¿Está la pregunta «¿Dejarlo sonando?» en pantalla? */
  asking: boolean;
  /** ¿Está abierta la hoja del metrónomo? (el flotante se esconde) */
  panelOpen: boolean;
  setBpm: (bpm: number) => void;
  setBeatsPerBar: (beats: BeatsPerBar) => void;
  toggle: () => void;
  stop: () => void;
  /** Un toque de «marcar el tempo». */
  tap: () => void;
  setKeepOnClose: (pref: KeepOnClose) => void;
  setPanelOpen: (open: boolean) => void;
  /** La hoja se ha cerrado: sigue, para o pregunta según la preferencia. */
  sheetClosed: () => void;
  /** Respuesta a la pregunta. `remember` = «No volver a preguntar». */
  answer: (keep: boolean, remember: boolean) => void;
}

const MetronomeContext = createContext<Metronome | null>(null);

export function MetronomeProvider({ children }: { children: React.ReactNode }) {
  const [bpm, setBpmState] = useState(DEFAULT_BPM);
  const [beatsPerBar, setBeatsState] = useState<BeatsPerBar>(DEFAULT_BEATS);
  const [keepOnClose, setKeepState] = useState<KeepOnClose>('ask');
  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState(-1);
  const [failed, setFailed] = useState(false);
  const [asking, setAsking] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const pulse = useSharedValue(0);

  // El motor lee siempre lo último sin reiniciarse.
  const bpmRef = useRef(bpm);
  const beatsRef = useRef<number>(beatsPerBar);
  const keepRef = useRef<KeepOnClose>('ask');
  const sessionRef = useRef<MetronomeSession | null>(null);
  const startingRef = useRef(false);
  const tapsRef = useRef<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        const saved = JSON.parse(raw) as {
          bpm?: number;
          beats?: number;
          keep?: unknown;
        };
        if (typeof saved.bpm === 'number') {
          const v = clampBpm(saved.bpm);
          bpmRef.current = v;
          setBpmState(v);
        }
        if (isBeatsPerBar(saved.beats)) {
          beatsRef.current = saved.beats;
          setBeatsState(saved.beats);
        }
        if (isKeepOnClose(saved.keep)) {
          keepRef.current = saved.keep;
          setKeepState(saved.keep);
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
      JSON.stringify({
        bpm: bpmRef.current,
        beats: beatsRef.current,
        keep: keepRef.current,
      }),
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

  const setKeepOnClose = useCallback(
    (pref: KeepOnClose) => {
      keepRef.current = pref;
      setKeepState(pref);
      persist();
    },
    [persist],
  );

  const stop = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setPlaying(false);
    setBeat(-1);
    setAsking(false);
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

  const sheetClosed = useCallback(() => {
    const action = onSheetClose(!!sessionRef.current, keepRef.current);
    if (action === 'stop') stop();
    else if (action === 'ask') setAsking(true);
  }, [stop]);

  const answer = useCallback(
    (keep: boolean, remember: boolean) => {
      if (remember) setKeepOnClose(keep ? 'keep' : 'stop');
      setAsking(false);
      if (!keep) stop();
    },
    [setKeepOnClose, stop],
  );

  // A segundo plano, silencio.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') stop();
    });
    return () => sub.remove();
  }, [stop]);

  // Sonando, la pantalla no se apaga (se toca con el móvil en el atril).
  useEffect(() => {
    if (!playing) return;
    const granted = activateKeepAwakeAsync(KEEP_AWAKE_TAG).then(
      () => true,
      () => false,
    );
    return () => {
      void granted.then((ok) => {
        if (ok) deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
      });
    };
  }, [playing]);

  // Al desmontar el cantoral, nada sonando por detrás.
  useEffect(() => () => sessionRef.current?.stop(), []);

  const value = useMemo<Metronome>(
    () => ({
      bpm,
      beatsPerBar,
      playing,
      beat,
      pulse,
      failed,
      keepOnClose,
      asking,
      panelOpen,
      setBpm,
      setBeatsPerBar,
      toggle,
      stop,
      tap,
      setKeepOnClose,
      setPanelOpen,
      sheetClosed,
      answer,
    }),
    [
      bpm,
      beatsPerBar,
      playing,
      beat,
      pulse,
      failed,
      keepOnClose,
      asking,
      panelOpen,
      setBpm,
      setBeatsPerBar,
      toggle,
      stop,
      tap,
      setKeepOnClose,
      sheetClosed,
      answer,
    ],
  );

  return (
    <MetronomeContext.Provider value={value}>
      {children}
    </MetronomeContext.Provider>
  );
}

export function useMetronome(): Metronome {
  const ctx = useContext(MetronomeContext);
  if (!ctx) {
    throw new Error('useMetronome necesita un <MetronomeProvider> encima');
  }
  return ctx;
}
