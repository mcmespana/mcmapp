/**
 * Micrófono del afinador en iOS y Android: `react-native-audio-api`
 * (Software Mansion, los de Reanimated y Gesture Handler). Su `AudioRecorder`
 * entrega el audio en crudo (float, −1…1) mientras graba, sin escribir ningún
 * fichero: no se guarda nada y nada sale del teléfono.
 *
 * La sesión de audio de iOS va en modo `measurement`: sin el procesado que el
 * sistema aplica a la voz (control de ganancia, ecualización), que es justo lo
 * que deforma una nota sostenida. Con `allowHaptics`, porque iOS apaga la
 * vibración mientras graba y el «afinada» se nota en la mano.
 *
 * La versión web vive en `microphone.web.ts`; el contrato, en `types.ts`.
 */
import { AudioManager, AudioRecorder } from 'react-native-audio-api';
import { logger } from '@/utils/logger';
import type { MicPermission, MicSession, StartMicOptions } from './types';

function toPermission(status: string): MicPermission {
  if (status === 'Granted') return 'granted';
  if (status === 'Denied') return 'denied';
  return 'undetermined';
}

export function isMicrophoneSupported(): boolean {
  return true;
}

export async function getMicrophonePermission(): Promise<MicPermission> {
  try {
    return toPermission(await AudioManager.checkRecordingPermissions());
  } catch (e) {
    logger.warn('tuner: check mic permission failed', e);
    return 'undetermined';
  }
}

export async function requestMicrophonePermission(): Promise<MicPermission> {
  try {
    return toPermission(await AudioManager.requestRecordingPermissions());
  } catch (e) {
    logger.warn('tuner: request mic permission failed', e);
    return 'denied';
  }
}

export async function startMicrophone({
  onFrame,
  frameSize,
}: StartMicOptions): Promise<MicSession> {
  AudioManager.setSystemOptions({
    ios: {
      category: 'record',
      mode: 'measurement',
      allowHaptics: true,
      notifyOthersOnDeactivation: true,
    },
  });

  const recorder = new AudioRecorder();
  let sampleRate = 48000;
  try {
    sampleRate = AudioManager.getDevicePreferredSampleRate() || sampleRate;
  } catch {
    // Si el sistema no lo dice, el propio buffer trae el suyo.
  }

  recorder.onAudioReady(
    { sampleRate, bufferLength: frameSize, channelCount: 1 },
    (event) => {
      onFrame(event.buffer.getChannelData(0), event.buffer.sampleRate);
    },
  );
  recorder.onError((err) => logger.warn('tuner: recorder error', err));

  const result = await recorder.start();
  if (result.status !== 'success') {
    recorder.clearOnAudioReady();
    throw Object.assign(new Error('unavailable'), { code: 'unavailable' });
  }

  let stopped = false;
  return {
    sampleRate,
    stop() {
      if (stopped) return;
      stopped = true;
      recorder.clearOnAudioReady();
      recorder.clearOnError();
      void recorder
        .stop()
        .then(() => AudioManager.setAudioSessionActivity(false))
        .catch((e) => logger.warn('tuner: stop failed', e));
    },
  };
}
