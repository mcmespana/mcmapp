/**
 * El sonido del metrónomo, en iOS, Android y web con el mismo código:
 * `react-native-audio-api` es Web Audio en nativo y en web reexporta el del
 * navegador.
 *
 * No hay ninguna grabación: cada pulso se sintetiza. Es un «toc» de madera —
 * una nota corta que cae de tono muy rápido, con un parcial agudo que da el
 * golpe y se apaga antes—, más agudo en el primero del compás. Suena limpio a
 * cualquier tempo y no pesa nada en la app.
 *
 * El ritmo lo lleva el reloj del audio, no el de JS: un temporizador corto va
 * programando los pulsos de la próxima décima de segundo (`beatsUntil`), así
 * que un tirón de la interfaz no mueve el compás.
 */
import { Platform } from 'react-native';
import { AudioContext, AudioManager } from 'react-native-audio-api';
import { logger } from '@/utils/logger';
import { beatsUntil, type BeatCursor } from '@/utils/metronome';

/** Cada cuánto se mira si hay pulsos que programar. */
const TICK_MS = 25;
/** Hasta cuánto por delante se programa (segundos). */
const LOOKAHEAD_S = 0.12;
/** Margen antes del primer pulso, para que no nazca cortado. */
const START_DELAY_S = 0.06;

/** Do6 y Sol6: una quinta entre el pulso y el acento. */
const BEAT_HZ = 1046.5;
const ACCENT_HZ = 1568;

export interface MetronomeOptions {
  getBpm: () => number;
  getBeatsPerBar: () => number;
  /** Llega cuando el pulso SUENA (no cuando se programa). */
  onBeat: (index: number, accent: boolean) => void;
}

export interface MetronomeSession {
  stop: () => void;
}

function click(ctx: AudioContext, time: number, accent: boolean) {
  const base = accent ? ACCENT_HZ : BEAT_HZ;
  const peak = accent ? 0.5 : 0.36;

  // Cuerpo: seno que cae una quinta en 40 ms.
  const body = ctx.createOscillator();
  const bodyGain = ctx.createGain();
  body.type = 'sine';
  body.frequency.setValueAtTime(base, time);
  body.frequency.exponentialRampToValueAtTime(base * 0.67, time + 0.04);
  bodyGain.gain.setValueAtTime(0.0001, time);
  bodyGain.gain.exponentialRampToValueAtTime(peak, time + 0.002);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.09);
  body.connect(bodyGain);
  bodyGain.connect(ctx.destination);
  body.start(time);
  body.stop(time + 0.1);

  // Golpe: un parcial agudo y brevísimo, que es lo que lo hace «madera».
  const tap = ctx.createOscillator();
  const tapGain = ctx.createGain();
  tap.type = 'triangle';
  tap.frequency.setValueAtTime(base * 2.76, time);
  tapGain.gain.setValueAtTime(0.0001, time);
  tapGain.gain.exponentialRampToValueAtTime(peak * 0.35, time + 0.001);
  tapGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.025);
  tap.connect(tapGain);
  tapGain.connect(ctx.destination);
  tap.start(time);
  tap.stop(time + 0.03);
}

export async function startMetronome(
  opts: MetronomeOptions,
): Promise<MetronomeSession> {
  if (Platform.OS === 'ios') {
    // `playback`: suena aunque el móvil esté en silencio, que es como se
    // lleva en misa y en un ensayo.
    AudioManager.setSystemOptions({
      ios: {
        category: 'playback',
        allowHaptics: true,
        notifyOthersOnDeactivation: true,
      },
    });
  }

  const ctx = new AudioContext();
  if (ctx.state === 'suspended') await ctx.resume();

  let cursor: BeatCursor = {
    nextTime: ctx.currentTime + START_DELAY_S,
    nextIndex: 0,
  };
  let stopped = false;
  const pending = new Set<ReturnType<typeof setTimeout>>();

  const tick = () => {
    if (stopped) return;
    const now = ctx.currentTime;
    // Si el hilo se durmió (pestaña en segundo plano), no se recupera lo
    // perdido de golpe: se sigue desde ahora.
    if (cursor.nextTime < now) {
      cursor = { ...cursor, nextTime: now + 0.02 };
    }
    const next = beatsUntil(
      cursor,
      now + LOOKAHEAD_S,
      opts.getBpm(),
      opts.getBeatsPerBar(),
    );
    cursor = next.cursor;
    for (const beat of next.beats) {
      click(ctx, beat.time, beat.accent);
      const id = setTimeout(
        () => {
          pending.delete(id);
          if (!stopped) opts.onBeat(beat.index, beat.accent);
        },
        Math.max(0, (beat.time - now) * 1000),
      );
      pending.add(id);
    }
  };

  tick();
  const timer = setInterval(tick, TICK_MS);

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      pending.forEach(clearTimeout);
      pending.clear();
      void ctx
        .close()
        .then(() => {
          if (Platform.OS !== 'web') {
            return AudioManager.setAudioSessionActivity(false);
          }
        })
        .catch((e) => logger.warn('metronome: stop failed', e));
    },
  };
}
