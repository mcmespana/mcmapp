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
  /** Desactiva el modo (tras confirmar). */
  deactivate: () => void;
  /** True mientras se muestra el onboarding/explicación del modo. */
  onboardingVisible: boolean;
  /** Abre la explicación del modo (p.ej. al tocar el badge). */
  openOnboarding: () => void;
  /** Cierra la explicación y la marca como vista (no se repite sola). */
  dismissOnboarding: () => void;
  /** True mientras se pide confirmación para salir del modo. */
  exitConfirmVisible: boolean;
  /** Confirma la salida → desactiva el modo. */
  confirmExit: () => void;
  /** Cancela la salida → permanece en el modo. */
  cancelExit: () => void;
}

const COUNTDOWN_SECONDS = 3;
const SHAKES_NEEDED = 5;
const CHARGE_RESET_MS = 2500;
/**
 * Para SALIR del modo: un par de sacudidas fuertes (sin semáforo de carga)
 * dentro de la ventana abren el diálogo de confirmación. Más exigente que
 * activar para que no se salga sin querer.
 */
const EXIT_SHAKES_NEEDED = 2;
const EXIT_WINDOW_MS = 1500;
/** Clave de persistencia: recuerda si el modo quedó activo al cerrar la app. */
const STORAGE_KEY = '@carismochito_active';
/** Clave de persistencia: el onboarding del modo ya se mostró una vez. */
const ONBOARDING_KEY = '@carismochito_onboarding_seen';

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
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  const [exitConfirmVisible, setExitConfirmVisible] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chargeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chargeRef = useRef(0);
  // Onboarding ya mostrado alguna vez (se carga de AsyncStorage al montar).
  const onboardingSeenRef = useRef(false);
  // Sacudidas acumuladas para SALIR (no se muestran como semáforo).
  const exitShakeRef = useRef(0);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Espejo del estado para decidir en `toggleByShake` sin setState anidado.
  const stateRef = useRef<CarismochitoState>(state);
  stateRef.current = state;
  // Espejo de "hay un diálogo abierto" para ignorar sacudidas mientras tanto.
  const dialogOpenRef = useRef(false);
  dialogOpenRef.current = onboardingVisible || exitConfirmVisible;

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
        // Primera vez: abrir la explicación/onboarding justo tras la cuenta
        // atrás. Las siguientes veces solo confeti + badge.
        if (!onboardingSeenRef.current) {
          setOnboardingVisible(true);
        }
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
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    exitShakeRef.current = 0;
    setExitConfirmVisible(false);
    setOnboardingVisible(false);
    setCountdown(COUNTDOWN_SECONDS);
    setState('idle');
    setFreshlyActivated(false);
    setCarismochitoTheme(false);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    h.carismoOff();
  }, [stopTimer, resetCharge]);

  const openOnboarding = useCallback(() => {
    setOnboardingVisible(true);
  }, []);

  const dismissOnboarding = useCallback(() => {
    setOnboardingVisible(false);
    onboardingSeenRef.current = true;
    AsyncStorage.setItem(ONBOARDING_KEY, '1').catch(() => {});
  }, []);

  const confirmExit = useCallback(() => {
    setExitConfirmVisible(false);
    deactivate();
  }, [deactivate]);

  const cancelExit = useCallback(() => {
    setExitConfirmVisible(false);
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    exitShakeRef.current = 0;
    h.tap();
  }, []);

  const toggleByShake = useCallback(() => {
    const prev = stateRef.current;

    // Si hay un diálogo (onboarding o confirmación de salida) abierto, las
    // sacudidas no hacen nada: se decide con los botones.
    if (dialogOpenRef.current) return;

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
      // active → acumular sacudidas fuertes para salir (sin semáforo). A las
      // EXIT_SHAKES_NEEDED dentro de la ventana, pedir confirmación.
      h.shake();
      exitShakeRef.current += 1;
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      exitTimerRef.current = setTimeout(() => {
        exitShakeRef.current = 0;
      }, EXIT_WINDOW_MS);

      if (exitShakeRef.current >= EXIT_SHAKES_NEEDED) {
        exitShakeRef.current = 0;
        setExitConfirmVisible(true);
      }
    }
  }, [startCountdown, cancelCountdown, resetCharge]);

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
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((v) => {
        onboardingSeenRef.current = v === '1';
      })
      .catch(() => {});
  }, []);

  // Limpieza: parar timers (NO restauramos el tema aquí para no apagar el
  // modo al desmontar; la persistencia se encarga de mantenerlo).
  useEffect(
    () => () => {
      stopTimer();
      if (chargeTimerRef.current) clearTimeout(chargeTimerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
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
        onboardingVisible,
        openOnboarding,
        dismissOnboarding,
        exitConfirmVisible,
        confirmExit,
        cancelExit,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
