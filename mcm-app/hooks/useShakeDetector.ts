import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Detecta cuándo el usuario agita el dispositivo midiendo picos del
 * acelerómetro. Se considera "shake" cuando se acumulan varios picos
 * por encima del umbral dentro de una ventana corta.
 *
 * Usa `expo-sensors` cargado dinámicamente para no romper el bundle en
 * plataformas donde no esté disponible (web, simuladores sin sensores).
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
    let cancelled = false;

    // Carga perezosa para que la app arranque aunque el módulo nativo no esté.
    // @ts-ignore expo-sensors optional native dependency
    import('expo-sensors')
      .then(({ Accelerometer }: { Accelerometer: any }) => {
        if (cancelled) return;
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
      })
      .catch(() => {
        // expo-sensors no disponible — feature degrada en silencio.
      });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled, threshold, peaksRequired, windowMs, cooldownMs]);
}
