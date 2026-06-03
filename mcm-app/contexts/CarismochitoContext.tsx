import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { setCarismochitoTheme } from '@/utils/heroUIRuntimeTheme';
import { h } from '@/utils/haptics';

export type CarismochitoState = 'idle' | 'countingDown' | 'active';

interface CarismochitoContextValue {
  state: CarismochitoState;
  /** Segundos restantes durante la cuenta atrás. */
  countdown: number;
  /** Duración total de la cuenta atrás (para animar el anillo de progreso). */
  countdownSeconds: number;
  isActive: boolean;
  /** Acción asociada a "agitar el móvil": activa, cancela o desactiva según estado. */
  toggleByShake: () => void;
  /** Cancela la cuenta atrás (botón "Cancelar"). */
  cancelCountdown: () => void;
  /** Desactiva el modo (tocando el badge flotante o agitando). */
  deactivate: () => void;
}

const COUNTDOWN_SECONDS = 3;

const Ctx = createContext<CarismochitoContextValue | null>(null);

export function useCarismochito() {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error(
      'useCarismochito debe usarse dentro de CarismochitoProvider',
    );
  }
  return v;
}

export function CarismochitoProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<CarismochitoState>('idle');
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Espejo del estado para decidir en `toggleByShake` sin setState anidado.
  const stateRef = useRef<CarismochitoState>(state);
  stateRef.current = state;

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startCountdown = useCallback(() => {
    stopTimer();
    setCountdown(COUNTDOWN_SECONDS);
    setState('countingDown');
    let remaining = COUNTDOWN_SECONDS;
    intervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        stopTimer();
        setCountdown(0);
        setState('active');
        // Recolorea la capa heroui en verde + golpe háptico de celebración.
        setCarismochitoTheme(true);
        h.carismoOn();
      } else {
        setCountdown(remaining);
        h.tap();
      }
    }, 1000);
  }, [stopTimer]);

  const cancelCountdown = useCallback(() => {
    stopTimer();
    setCountdown(COUNTDOWN_SECONDS);
    setState('idle');
    h.carismoOff();
  }, [stopTimer]);

  const deactivate = useCallback(() => {
    stopTimer();
    setCountdown(COUNTDOWN_SECONDS);
    setState('idle');
    setCarismochitoTheme(false);
    h.carismoOff();
  }, [stopTimer]);

  const toggleByShake = useCallback(() => {
    // Cada agitado confirmado da respuesta háptica, decida lo que decida.
    h.shake();
    const prev = stateRef.current;
    if (prev === 'idle') {
      startCountdown();
    } else if (prev === 'countingDown') {
      cancelCountdown();
    } else {
      // active → desactivar
      deactivate();
    }
  }, [startCountdown, cancelCountdown, deactivate]);

  // Limpieza: parar timer y restaurar el tema si se desmonta en activo.
  useEffect(
    () => () => {
      stopTimer();
      setCarismochitoTheme(false);
    },
    [stopTimer],
  );

  return (
    <Ctx.Provider
      value={{
        state,
        countdown,
        countdownSeconds: COUNTDOWN_SECONDS,
        isActive: state === 'active',
        toggleByShake,
        cancelCountdown,
        deactivate,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
