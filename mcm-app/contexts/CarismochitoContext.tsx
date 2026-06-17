import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  /**
   * `true` sólo tras una activación recién hecha (cuenta atrás completada),
   * para mostrar la celebración (confeti + badge). En la restauración al
   * reabrir la app es `false`: el modo entra en silencio, sin estorbar.
   */
  freshlyActivated: boolean;
  /** Sacudidas acumuladas mientras se "carga" el modo (estado idle). */
  chargeCount: number;
  /** Sacudidas necesarias para arrancar el countdown. */
  shakesNeeded: number;
  /** Acción asociada a "agitar el móvil": activa, cancela o desactiva según estado. */
  toggleByShake: () => void;
  /** Cancela la cuenta atrás (botón "Cancelar"). */
  cancelCountdown: () => void;
  /** Desactiva el modo (tocando el badge flotante o agitando). */
  deactivate: () => void;
}

const COUNTDOWN_SECONDS = 3;
const SHAKES_NEEDED = 5;
const CHARGE_RESET_MS = 2500;
/** Clave de persistencia: recuerda si el modo quedó activo al cerrar la app. */
const STORAGE_KEY = '@carismochito_active';

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
  const [freshlyActivated, setFreshlyActivated] = useState(false);
  const [chargeCount, setChargeCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chargeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chargeRef = useRef(0);
  // Espejo del estado para decidir en `toggleByShake` sin setState anidado.
  const stateRef = useRef<CarismochitoState>(state);
  stateRef.current = state;

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const resetCharge = useCallback(() => {
    if (chargeTimerRef.current) clearTimeout(chargeTimerRef.current);
    chargeRef.current = 0;
    setChargeCount(0);
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
        setFreshlyActivated(true);
        // Recolorea la capa heroui en verde + golpe háptico de celebración.
        setCarismochitoTheme(true);
        // Recordar el modo activo para mantenerlo al reabrir la app.
        AsyncStorage.setItem(STORAGE_KEY, '1').catch(() => {});
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
    resetCharge();
    setCountdown(COUNTDOWN_SECONDS);
    setState('idle');
    setFreshlyActivated(false);
    setCarismochitoTheme(false);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    h.carismoOff();
  }, [stopTimer, resetCharge]);

  const toggleByShake = useCallback(() => {
    const prev = stateRef.current;

    if (prev === 'idle') {
      // Vibrar en cada sacudida individual.
      h.shake();
      chargeRef.current += 1;
      setChargeCount(chargeRef.current);

      // Reiniciar el temporizador de reset de carga.
      if (chargeTimerRef.current) clearTimeout(chargeTimerRef.current);
      chargeTimerRef.current = setTimeout(() => {
        chargeRef.current = 0;
        setChargeCount(0);
      }, CHARGE_RESET_MS);

      if (chargeRef.current >= SHAKES_NEEDED) {
        resetCharge();
        startCountdown();
      }
    } else if (prev === 'countingDown') {
      h.shake();
      cancelCountdown();
    } else {
      // active → desactivar
      deactivate();
    }
  }, [startCountdown, cancelCountdown, deactivate, resetCharge]);

  // Al arrancar: si el modo quedó activo en una sesión anterior, restaurarlo
  // directamente (sin cuenta atrás ni háptica) para que persista al reabrir.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === '1') {
          setState('active');
          setCarismochitoTheme(true);
        }
      })
      .catch(() => {});
  }, []);

  // Limpieza: parar timers (NO restauramos el tema aquí para no apagar el
  // modo al desmontar; la persistencia se encarga de mantenerlo).
  useEffect(
    () => () => {
      stopTimer();
      if (chargeTimerRef.current) clearTimeout(chargeTimerRef.current);
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
        freshlyActivated,
        chargeCount,
        shakesNeeded: SHAKES_NEEDED,
        toggleByShake,
        cancelCountdown,
        deactivate,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
