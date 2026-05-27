import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Accelerometer } from 'expo-sensors';

type Options = {
  enabled?: boolean;
  threshold?: number;
  cooldownMs?: number;
};

/**
 * Detecta un "agitado" del dispositivo midiendo el cambio brusco
 * de aceleración (jerk) en los tres ejes. Funciona en iOS, Android y
 * en navegadores web modernos con permiso de DeviceMotion concedido.
 */
export function useShakeDetector(onShake: () => void, options: Options = {}) {
  const { enabled = true, threshold = 1.8, cooldownMs = 1200 } = options;
  const handlerRef = useRef(onShake);
  handlerRef.current = onShake;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let subscription: { remove: () => void } | null = null;
    let last = { x: 0, y: 0, z: 0 };
    let lastShakeAt = 0;
    let primed = false;

    const subscribe = async () => {
      try {
        const available = await Accelerometer.isAvailableAsync();
        if (cancelled || !available) return;
        if (Platform.OS === 'web') {
          await Accelerometer.requestPermissionsAsync().catch(() => {});
        }
        Accelerometer.setUpdateInterval(80);
        subscription = Accelerometer.addListener(({ x, y, z }) => {
          if (!primed) {
            last = { x, y, z };
            primed = true;
            return;
          }
          const dx = x - last.x;
          const dy = y - last.y;
          const dz = z - last.z;
          last = { x, y, z };
          const delta = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (delta < threshold) return;
          const now = Date.now();
          if (now - lastShakeAt < cooldownMs) return;
          lastShakeAt = now;
          handlerRef.current();
        });
      } catch {
        // Sensor no disponible o permiso denegado: ignorar silenciosamente.
      }
    };
    subscribe();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled, threshold, cooldownMs]);
}
