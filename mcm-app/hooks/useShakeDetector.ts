import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Detecta cuándo el usuario agita el dispositivo midiendo picos del
 * acelerómetro. Se considera "shake" cuando se acumulan varios picos
 * por encima del umbral dentro de una ventana corta.
 *
 * Usa `expo-sensors` cargado de forma perezosa (con `require`, no `import()`
 * dinámico) para no romper el bundle en plataformas donde no esté disponible
 * (web, simuladores sin sensores) — mismo patrón que `getGoogleSignin` en
 * `utils/platformAuth.native.ts`: a Metro (sin code splitting) solo le
 * importa CUÁNDO se evalúa el módulo, así que un `require` dentro del efecto
 * consigue lo mismo que el `import()` dinámico. La diferencia es que, bajo
 * Jest, el `import()` dinámico no se transforma bien a CommonJS y nunca
 * resolvía a un mock — con `require` sí es testeable.
 */
export interface UseShakeDetectorOptions {
  /** Aceleración mínima (en g) para contar como pico. 2.0 = sacudida media. */
  threshold?: number;
  /** Cuántos picos en `windowMs` para disparar `onShake`. */
  peaksRequired?: number;
  /** Ventana de tiempo para acumular picos (ms). */
  windowMs?: number;
  /** Tiempo mínimo entre detecciones (ms) para evitar repeticiones. */
  cooldownMs?: number;
  /** Si `false`, no se suscribe al acelerómetro. */
  enabled?: boolean;
}

export function useShakeDetector(
  onShake: () => void,
  options: UseShakeDetectorOptions = {},
) {
  const {
    threshold = 1.9,
    peaksRequired = 3,
    windowMs = 700,
    cooldownMs = 1200,
    enabled = true,
  } = options;

  const callbackRef = useRef(onShake);
  callbackRef.current = onShake;

  useEffect(() => {
    if (!enabled) return;
    if (Platform.OS === 'web') return; // expo-sensors poco fiable en web

    let subscription: { remove: () => void } | null = null;

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Accelerometer } = require('expo-sensors') as
        typeof import('expo-sensors');
      Accelerometer.setUpdateInterval(80);
      const peaks: number[] = [];
      let lastFireAt = 0;
      subscription = Accelerometer.addListener(
        ({ x, y, z }: { x: number; y: number; z: number }) => {
          const magnitude = Math.sqrt(x * x + y * y + z * z);
          const now = Date.now();
          // Limpia picos fuera de la ventana.
          while (peaks.length && now - peaks[0] > windowMs) peaks.shift();
          if (magnitude >= threshold) {
            peaks.push(now);
            if (
              peaks.length >= peaksRequired &&
              now - lastFireAt >= cooldownMs
            ) {
              lastFireAt = now;
              peaks.length = 0;
              callbackRef.current();
            }
          }
        },
      );
    } catch {
      // expo-sensors no disponible — feature degrada en silencio.
    }

    return () => {
      subscription?.remove();
    };
  }, [enabled, threshold, peaksRequired, windowMs, cooldownMs]);
}
