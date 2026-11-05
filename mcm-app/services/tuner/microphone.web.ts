/**
 * Micrófono del afinador en web: `getUserMedia` + Web Audio.
 *
 * Se lee la forma de onda con un `AnalyserNode` en cada fotograma
 * (`requestAnimationFrame`): no hace falta un AudioWorklet para ~20 análisis
 * por segundo, y así no hay que servir un fichero aparte. Se piden las
 * señales SIN procesar (sin cancelación de eco, sin supresión de ruido ni
 * control de ganancia): esos filtros están pensados para la voz y se comen
 * justo la nota que queremos medir.
 */
import { ANALYSIS_WINDOW } from '@/utils/tuner/detectPitch';
import type { MicPermission, MicSession, StartMicOptions } from './types';

type AudioContextCtor = typeof AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export function isMicrophoneSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    !!audioContextCtor()
  );
}

/**
 * En web el permiso se pide al abrir el micrófono (no hay otra forma
 * fiable): aquí solo se consulta si ya se denegó, para no abrir el diálogo
 * del navegador sin que la persona haya tocado nada.
 */
export async function getMicrophonePermission(): Promise<MicPermission> {
  try {
    const status = await navigator.permissions?.query({
      name: 'microphone' as PermissionName,
    });
    if (status?.state === 'denied') return 'denied';
    if (status?.state === 'granted') return 'granted';
  } catch {
    // Safari antiguo no conoce `microphone` en la Permissions API.
  }
  return 'undetermined';
}

export async function requestMicrophonePermission(): Promise<MicPermission> {
  // Se resuelve al abrir el stream en `startMicrophone`.
  return getMicrophonePermission();
}

export async function startMicrophone({
  onFrame,
  frameSize,
}: StartMicOptions): Promise<MicSession> {
  const Ctor = audioContextCtor();
  if (!Ctor || !navigator.mediaDevices?.getUserMedia) {
    throw Object.assign(new Error('unsupported'), { code: 'unsupported' });
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
  } catch (e) {
    const name = (e as { name?: string })?.name;
    const denied = name === 'NotAllowedError' || name === 'SecurityError';
    throw Object.assign(new Error(denied ? 'denied' : 'unavailable'), {
      code: denied ? 'denied' : 'unavailable',
    });
  }

  const ctx = new Ctor();
  if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  // `fftSize` es cuántas muestras devuelve el analizador en cada lectura: la
  // ventana ENTERA de análisis, no un trozo. Cada lectura es una foto de lo
  // último que ha sonado y se solapa con la anterior (hay ~60 por segundo):
  // si se pidieran trozos y se fueran encadenando, la ventana quedaría hecha
  // de pedazos repetidos y el periodo saldría mal (pasó: el La 110 se leía a
  // +21 cents). Con la ventana completa, `FrameAnalyzer.feed` la sustituye.
  analyser.fftSize = Math.max(frameSize, ANALYSIS_WINDOW);
  analyser.smoothingTimeConstant = 0;
  source.connect(analyser);
  const buffer = new Float32Array(analyser.fftSize);

  let raf = 0;
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    analyser.getFloatTimeDomainData(buffer);
    onFrame(buffer, ctx.sampleRate);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    sampleRate: ctx.sampleRate,
    stop() {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close().catch(() => {});
    },
  };
}
