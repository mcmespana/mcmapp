import { useCallback, useEffect, useRef } from 'react';

interface RepeatPressOptions {
  /** Cuánto hay que mantener pulsado antes de que empiece a repetir. */
  delayMs?: number;
  /** Cada cuánto repite una vez que ha empezado. */
  intervalMs?: number;
}

/**
 * Un botón de «más/menos» con pulsación mantenida: un toque da UN paso y, si se
 * mantiene, repite hasta que se suelta o se llega a un tope.
 *
 * `step` hace un paso y devuelve `false` cuando ya no se puede avanzar más (un
 * tope). Es quien lo pasa quien avisa del tope con `h.limit()`; aquí solo se
 * deja de repetir, así el aviso suena una vez y no en cada tic.
 *
 * Devuelve las props para un `Pressable`/`PressableFeedback`: `onPress` (el
 * toque corto; RN no lo dispara si la pulsación llegó a ser larga),
 * `onLongPress` (arranca la repetición), `onPressOut` (la para) y
 * `delayLongPress`. Se para también al desmontar.
 */
export function useRepeatPress(
  step: () => boolean,
  { delayMs = 350, intervalMs = 110 }: RepeatPressOptions = {},
) {
  // `step` suele cerrar sobre estado: el intervalo llama SIEMPRE a la última.
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  });

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => stop, [stop]);

  const onPress = useCallback(() => {
    stepRef.current();
  }, []);

  const onLongPress = useCallback(() => {
    stop();
    // El primer paso largo es inmediato; si ya no se puede avanzar, no hay
    // nada que repetir.
    if (!stepRef.current()) return;
    timer.current = setInterval(() => {
      if (!stepRef.current()) stop();
    }, intervalMs);
  }, [stop, intervalMs]);

  return { onPress, onLongPress, onPressOut: stop, delayLongPress: delayMs };
}
