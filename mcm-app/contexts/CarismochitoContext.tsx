import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

export type CarismochitoState = 'idle' | 'countingDown' | 'active';

interface CarismochitoContextValue {
  state: CarismochitoState;
  /** Segundos restantes durante la cuenta atrás (5 → 0). */
  countdown: number;
  isActive: boolean;
  /** Acción asociada a "agitar el móvil": activa, cancela o desactiva según estado. */
  toggleByShake: () => void;
  /** Cancela la cuenta atrás (botón "Cancelar"). */
  cancelCountdown: () => void;
  /** Desactiva el modo (tocando el badge flotante). */
  deactivate: () => void;
}

const COUNTDOWN_SECONDS = 5;

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
    intervalRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          stopTimer();
          setState('active');
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }, [stopTimer]);

  const cancelCountdown = useCallback(() => {
    stopTimer();
    setCountdown(COUNTDOWN_SECONDS);
    setState('idle');
  }, [stopTimer]);

  const deactivate = useCallback(() => {
    stopTimer();
    setCountdown(COUNTDOWN_SECONDS);
    setState('idle');
  }, [stopTimer]);

  const toggleByShake = useCallback(() => {
    setState((prev) => {
      if (prev === 'idle') {
        startCountdown();
        return 'countingDown';
      }
      if (prev === 'countingDown') {
        cancelCountdown();
        return 'idle';
      }
      // active → desactivar
      deactivate();
      return 'idle';
    });
  }, [startCountdown, cancelCountdown, deactivate]);

  useEffect(() => () => stopTimer(), [stopTimer]);

  return (
    <Ctx.Provider
      value={{
        state,
        countdown,
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
