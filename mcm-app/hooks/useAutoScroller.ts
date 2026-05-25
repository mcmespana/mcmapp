import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Controlador de auto-scroll para el modo pantalla completa del cantoral.
 *
 * Diseño:
 * - Tiempo real (px/segundo), no por frame: misma velocidad a 60Hz, 90Hz o 120Hz.
 * - Niveles discretos persistidos: el usuario recupera "su" velocidad la próxima vez.
 * - Acumulación sub-píxel: incluso a velocidades muy bajas el movimiento es continuo.
 * - Para WebView nativa, el bucle vive DENTRO de la WebView (cero overhead del puente);
 *   React Native solo envía la velocidad objetivo cuando cambia.
 * - Para web, el bucle vive en el lado React con `requestAnimationFrame`.
 * - Auto-pausa cuando el usuario interactúa manualmente con el contenido o al llegar
 *   al final del documento.
 */

export interface AutoScrollSpeed {
  /** Etiqueta legible para mostrar en UI. */
  label: string;
  /** Velocidad objetivo en píxeles por segundo. */
  pxPerSec: number;
}

// Curva calibrada para acompañar el ritmo de una canción cantada en directo.
// El paso de 3 → 4 es notable pero no brusco; el 1 es deliberadamente "ambiental".
export const AUTO_SCROLL_SPEEDS: AutoScrollSpeed[] = [
  { label: 'Muy lento', pxPerSec: 8 },
  { label: 'Lento', pxPerSec: 22 },
  { label: 'Normal', pxPerSec: 45 },
  { label: 'Rápido', pxPerSec: 85 },
  { label: 'Muy rápido', pxPerSec: 150 },
];

const DEFAULT_SPEED_INDEX = 2; // 'Normal'
const STORAGE_KEY = '@mcm_song_autoscroll_speed_index';

/**
 * JS inyectado en la WebView nativa. Se ejecuta una sola vez por carga y expone
 * `window.__mcmScroll(pxPerSec)`. El bucle es time-based (delta-T entre frames),
 * acumula sub-píxeles y se auto-detiene al llegar al final del documento o ante
 * interacción manual del usuario, posteando un mensaje al lado React.
 */
export const AUTO_SCROLL_CONTROLLER_JS = `(function(){
  if (window.__mcmScrollInstalled) return; window.__mcmScrollInstalled = true;
  var target = 0;
  var current = 0;
  var lastT = 0;
  var raf = null;
  var RAMP = 600;
  var scrollEl = document.scrollingElement || document.documentElement;
  function post(type){ try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: type })); } catch(e){} }
  function atBottom(){
    return scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 2;
  }
  function step(t){
    if (!lastT) lastT = t;
    var dt = Math.min((t - lastT) / 1000, 0.05);
    lastT = t;
    if (current < target) current = Math.min(target, current + RAMP * dt);
    else if (current > target) current = Math.max(target, current - RAMP * dt);
    if (current > 0) {
      scrollEl.scrollTop += current * dt;
      if (atBottom()) { target = 0; current = 0; raf = null; lastT = 0; post('scroll-end'); return; }
      raf = requestAnimationFrame(step);
    } else if (target <= 0) {
      raf = null; lastT = 0;
    } else {
      raf = requestAnimationFrame(step);
    }
  }
  window.__mcmScroll = function(v){
    target = +v || 0;
    if (target > 0 && !raf) { lastT = 0; raf = requestAnimationFrame(step); }
  };
  var onUserScroll = function(){
    if (target > 0) { target = 0; current = 0; post('user-paused'); }
  };
  ['touchstart','wheel','mousedown','keydown'].forEach(function(evt){
    window.addEventListener(evt, onUserScroll, { passive: true, capture: true });
  });
})(); true;`;

interface UseAutoScrollerParams {
  /** Ref a la WebView nativa (iOS/Android). */
  webViewRef?: React.RefObject<WebView | null>;
  /** Ref al contenedor scrollable en web. */
  webContainerRef?: React.MutableRefObject<HTMLDivElement | null>;
  /** Si la pantalla aún no está lista (e.g. esperando contenido), pausamos. */
  enabled?: boolean;
}

export interface AutoScrollerApi {
  isPlaying: boolean;
  speedIndex: number;
  speed: AutoScrollSpeed;
  setSpeedIndex: (i: number) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  /** Conectar al `onLoadEnd` de la WebView. */
  handleWebViewLoad: () => void;
  /** Conectar al `onMessage` de la WebView. */
  handleWebViewMessage: (event: { nativeEvent: { data: string } }) => void;
}

export function useAutoScroller({
  webViewRef,
  webContainerRef,
  enabled = true,
}: UseAutoScrollerParams): AutoScrollerApi {
  const [speedIndex, setSpeedIndexState] =
    useState<number>(DEFAULT_SPEED_INDEX);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hidratar velocidad preferida desde AsyncStorage
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (cancelled) return;
        const n = v != null ? Number.parseInt(v, 10) : NaN;
        if (Number.isFinite(n) && n >= 0 && n < AUTO_SCROLL_SPEEDS.length) {
          setSpeedIndexState(n);
        }
        setHydrated(true);
      })
      .catch(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setSpeedIndex = useCallback((i: number) => {
    const clamped = Math.max(
      0,
      Math.min(AUTO_SCROLL_SPEEDS.length - 1, Math.round(i)),
    );
    setSpeedIndexState(clamped);
    AsyncStorage.setItem(STORAGE_KEY, String(clamped)).catch(() => {});
  }, []);

  const speed = AUTO_SCROLL_SPEEDS[speedIndex];

  // Refs siempre actualizados — evita closures obsoletos dentro del rAF
  const isPlayingRef = useRef(isPlaying);
  const pxPerSecRef = useRef(speed.pxPerSec);
  isPlayingRef.current = isPlaying;
  pxPerSecRef.current = speed.pxPerSec;

  // ── Nativo: empujar la velocidad objetivo a la WebView ──────────────────
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!hydrated) return;
    const ref = webViewRef?.current;
    if (!ref) return;
    const target = enabled && isPlaying ? speed.pxPerSec : 0;
    ref.injectJavaScript(
      `if(window.__mcmScroll)window.__mcmScroll(${target});true;`,
    );
  }, [isPlaying, speed.pxPerSec, hydrated, enabled, webViewRef]);

  // ── Web: bucle rAF time-based con acumulación sub-píxel ─────────────────
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!enabled || !isPlaying) return;
    const el = webContainerRef?.current;
    if (!el) return;

    let raf: number | null = null;
    let lastT = 0;
    let current = 0;
    const RAMP = 600;

    const step = (t: number) => {
      if (!lastT) lastT = t;
      const dt = Math.min((t - lastT) / 1000, 0.05);
      lastT = t;

      const target = pxPerSecRef.current;
      if (current < target) current = Math.min(target, current + RAMP * dt);
      else if (current > target)
        current = Math.max(target, current - RAMP * dt);

      if (current > 0) {
        el.scrollTop += current * dt;
        const atBottom =
          el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
        if (atBottom) {
          setIsPlaying(false);
          raf = null;
          return;
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    return () => {
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, [isPlaying, enabled, webContainerRef]);

  // ── Web: pausar ante interacción manual del usuario ─────────────────────
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = webContainerRef?.current;
    if (!el) return;

    const onUserInteract = () => {
      if (isPlayingRef.current) setIsPlaying(false);
    };
    el.addEventListener('wheel', onUserInteract, { passive: true });
    el.addEventListener('touchstart', onUserInteract, { passive: true });
    el.addEventListener('mousedown', onUserInteract, { passive: true });
    return () => {
      el.removeEventListener('wheel', onUserInteract);
      el.removeEventListener('touchstart', onUserInteract);
      el.removeEventListener('mousedown', onUserInteract);
    };
  }, [webContainerRef]);

  // ── Controles ───────────────────────────────────────────────────────────
  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);
  const toggle = useCallback(() => setIsPlaying((p) => !p), []);

  // ── WebView: reinyectar velocidad cuando recarga el HTML ────────────────
  const handleWebViewLoad = useCallback(() => {
    if (Platform.OS === 'web') return;
    if (!isPlayingRef.current) return;
    webViewRef?.current?.injectJavaScript(
      `if(window.__mcmScroll)window.__mcmScroll(${pxPerSecRef.current});true;`,
    );
  }, [webViewRef]);

  const handleWebViewMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg && (msg.type === 'scroll-end' || msg.type === 'user-paused')) {
          setIsPlaying(false);
        }
      } catch {
        // Ignorar mensajes que no sean JSON nuestros
      }
    },
    [],
  );

  return {
    isPlaying,
    speedIndex,
    speed,
    setSpeedIndex,
    play,
    pause,
    toggle,
    handleWebViewLoad,
    handleWebViewMessage,
  };
}
