/**
 * Guardarraíl del micrófono web del afinador.
 *
 * En web el `AnalyserNode` no da trozos consecutivos: da una FOTO de lo último
 * que ha sonado, unas 60 por segundo, que se solapan entre sí. Si la foto es
 * más corta que la ventana de análisis, `FrameAnalyzer.feed` las encadena como
 * si fueran audio seguido y la ventana queda hecha de pedazos repetidos: el
 * tono sale mal (pasó: el La 110 se leía a +21 cents, el Mi grave a −29).
 * Esto comprueba que cada entrega en web es la ventana entera, y que con fotos
 * solapadas así el tono sale exacto.
 */
import { startMicrophone } from '@/services/tuner/microphone.web';
import { ANALYSIS_WINDOW, FrameAnalyzer } from '@/utils/tuner/detectPitch';

const SR = 44100;

function installFakeWebAudio(hz: number) {
  let t0 = 0;
  const analyser = {
    fftSize: 2048,
    smoothingTimeConstant: 0.8,
    getFloatTimeDomainData(out: Float32Array) {
      // Las últimas `out.length` muestras de un seno continuo; cada lectura
      // avanza ~16 ms (un fotograma), así que se solapa con la anterior.
      for (let i = 0; i < out.length; i++) {
        out[i] = 0.3 * Math.sin((2 * Math.PI * hz * (t0 + i)) / SR);
      }
      t0 += Math.round(SR / 60);
    },
  };
  class FakeCtx {
    sampleRate = SR;
    state = 'running';
    createMediaStreamSource() {
      return { connect: () => {}, disconnect: () => {} };
    }
    createAnalyser() {
      return analyser;
    }
    resume() {
      return Promise.resolve();
    }
    close() {
      return Promise.resolve();
    }
  }
  const frames: (() => void)[] = [];
  Object.assign(globalThis, {
    AudioContext: FakeCtx,
    requestAnimationFrame: (cb: () => void) => frames.push(cb),
    cancelAnimationFrame: () => {},
  });
  (globalThis as { window?: unknown }).window = globalThis;
  // En Node 20 no existe `navigator` global (Node 21+ sí): se crea si falta.
  if (typeof globalThis.navigator !== 'object' || !globalThis.navigator) {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {},
    });
  }
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: async () => ({ getTracks: () => [{ stop: () => {} }] }),
    },
  });
  return {
    analyser,
    runFrames: (n: number) => {
      for (let i = 0; i < n; i++) frames.shift()?.();
    },
  };
}

it('cada entrega es la ventana de análisis completa y el tono sale exacto', async () => {
  const fake = installFakeWebAudio(110);
  const a = new FrameAnalyzer();
  const lengths: number[] = [];
  let last = { frequency: 0, clarity: 0 };
  const session = await startMicrophone({
    frameSize: 2048,
    onFrame: (samples, sr) => {
      lengths.push(samples.length);
      if (a.feed(samples)) last = a.analyze(sr, 0);
    },
  });
  fake.runFrames(12);
  session.stop();

  expect(fake.analyser.fftSize).toBeGreaterThanOrEqual(ANALYSIS_WINDOW);
  expect(lengths.every((n) => n >= ANALYSIS_WINDOW)).toBe(true);
  expect(Math.abs(1200 * Math.log2(last.frequency / 110))).toBeLessThan(1);
});
