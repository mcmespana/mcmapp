import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useCarismochito } from '@/contexts/CarismochitoContext';
import { useShakeDetector } from '@/hooks/useShakeDetector';
import CarismochitoMascot from '@/components/CarismochitoMascot';
import ChargeDots from '@/components/CarismochitoChargeDots';

/* Verdes del HUD del modo (distintos tonos). */
const G = '#1B9E4B'; // verde principal
const G_LIGHT = '#9DE86B'; // verde lima claro
const G_GLOW = '#5AE08A'; // verde brillo
const G_DARK = '#06210F'; // verde casi negro

/* Paleta festiva del confeti (verdes protagonistas + toques de marca). */
const CONFETTI_COLORS = [
  '#1B9E4B',
  '#5AE08A',
  '#9DE86B',
  '#A3BD31',
  '#7AC943',
  '#FCD200',
  '#31AADF',
  '#E15C62',
];

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/* -------------------------------------------------------------------------- */
/* Cuenta atrás con anillo de progreso                                        */
/* -------------------------------------------------------------------------- */

const RING_SIZE = 230;
const RING_STROKE = 12;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_C = 2 * Math.PI * RING_R;

function CountdownScreen({
  countdown,
  totalSeconds,
  onCancel,
}: {
  countdown: number;
  totalSeconds: number;
  onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();
  const enter = useRef(new Animated.Value(0)).current;
  const numberScale = useRef(new Animated.Value(1)).current;
  // Progreso del anillo: 0 (lleno) → 1 (vacío) de forma continua.
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(enter, {
      toValue: 1,
      tension: 90,
      friction: 10,
      useNativeDriver: true,
    }).start();
    // El anillo se vacía suavemente durante toda la cuenta atrás.
    Animated.timing(progress, {
      toValue: 1,
      duration: totalSeconds * 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [enter, progress, totalSeconds]);

  useEffect(() => {
    numberScale.setValue(0.5);
    Animated.spring(numberScale, {
      toValue: 1,
      tension: 80,
      friction: 6,
      useNativeDriver: true,
    }).start();
  }, [countdown, numberScale]);

  const enterScale = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1],
  });
  const dashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, RING_C],
  });

  return (
    <Animated.View
      style={[styles.countdownRoot, { opacity: enter }]}
      pointerEvents="auto"
    >
      <LinearGradient
        colors={['#011A0A', G_DARK, '#0C3D1C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Halo difuso detrás */}
      <View pointerEvents="none" style={styles.haloOuter}>
        <View style={styles.halo} />
      </View>

      <Animated.View
        style={[
          styles.countdownContent,
          { transform: [{ scale: enterScale }] },
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <Text style={styles.activatingLabel}>activando modo</Text>
        <Text style={styles.carismoTitle}>CARISMOCHITO</Text>

        {/* Anillo + mascota bailando + número dentro */}
        <View style={styles.ringBox}>
          <Svg
            width={RING_SIZE}
            height={RING_SIZE}
            style={StyleSheet.absoluteFill}
          >
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_R}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={RING_STROKE}
              fill="none"
            />
            <AnimatedCircle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_R}
              stroke={G_GLOW}
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${RING_C} ${RING_C}`}
              strokeDashoffset={dashoffset}
              // Empieza arriba (12 en punto).
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            />
          </Svg>

          <View style={styles.ringInner} pointerEvents="none">
            <CarismochitoMascot size={132} dance={2} />
            <Animated.Text
              style={[styles.number, { transform: [{ scale: numberScale }] }]}
            >
              {countdown}
            </Animated.Text>
          </View>
        </View>

        <Text style={styles.subtle}>
          Agita otra vez o pulsa Cancelar para cortar
        </Text>

        <Pressable
          onPress={onCancel}
          style={({ pressed }) => [
            styles.cancelBtn,
            pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
          ]}
          hitSlop={8}
        >
          <Text style={styles.cancelText}>Cancelar</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/* Confeti de celebración (estalla al activar y desaparece)                   */
/* -------------------------------------------------------------------------- */

function CelebrationConfetti() {
  // Tras el estallido inicial dejamos de renderizar el confeti: la pantalla
  // queda limpia y sólo permanece el badge + la barra verde.
  const [showing, setShowing] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowing(false), 4200);
    return () => clearTimeout(t);
  }, []);

  if (!showing) return null;

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.confettiRoot]}
    >
      <ConfettiCannon
        count={90}
        origin={{ x: -10, y: -20 }}
        explosionSpeed={420}
        fallSpeed={2800}
        fadeOut
        autoStart
        colors={CONFETTI_COLORS}
      />
      <ConfettiCannon
        count={90}
        origin={{ x: 10, y: -20 }}
        explosionSpeed={420}
        fallSpeed={2800}
        fadeOut
        autoStart
        colors={CONFETTI_COLORS}
      />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Mascota que se asoma girada 90° desde un lateral, de vez en cuando          */
/* -------------------------------------------------------------------------- */

const PEEK_SIZE = 96;
/** Cuánto del cuerpo queda dentro de la pantalla cuando asoma. */
const PEEK_REVEAL = 58;
/** Tiempo visible asomándose antes de retirarse. */
const PEEK_HOLD_MS = 2200;
/** Rango aleatorio entre asomadas (raro: un guiño de vez en cuando). */
const PEEK_MIN_GAP_MS = 45000;
const PEEK_MAX_GAP_MS = 90000;

function randomGap() {
  return PEEK_MIN_GAP_MS + Math.random() * (PEEK_MAX_GAP_MS - PEEK_MIN_GAP_MS);
}

function SidePeekMascot() {
  // 'left' | 'right' alternando; posición vertical algo aleatoria por asomada.
  const [peek, setPeek] = useState<{
    side: 'left' | 'right';
    topPct: number;
  } | null>(null);
  const slide = useRef(new Animated.Value(0)).current;
  const sideRef = useRef<'left' | 'right'>('right');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const scheduleNext = (delay: number) => {
      timerRef.current = setTimeout(() => {
        if (cancelled) return;
        // Alterna de lado y elige una altura aleatoria (entre 25% y 60%).
        sideRef.current = sideRef.current === 'right' ? 'left' : 'right';
        setPeek({
          side: sideRef.current,
          topPct: 0.25 + Math.random() * 0.35,
        });
        slide.setValue(0);
        Animated.sequence([
          Animated.spring(slide, {
            toValue: 1,
            tension: 70,
            friction: 9,
            useNativeDriver: true,
          }),
          Animated.delay(PEEK_HOLD_MS),
          Animated.timing(slide, {
            toValue: 0,
            duration: 380,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => {
          if (cancelled) return;
          setPeek(null);
          scheduleNext(randomGap());
        });
      }, delay);
    };

    // Primera asomada relativamente pronto para dar señal de vida del modo.
    scheduleNext(6000 + Math.random() * 6000);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      slide.stopAnimation();
    };
  }, [slide]);

  if (!peek) return null;

  const isRight = peek.side === 'right';
  // Oculta fuera de pantalla → asoma dejando PEEK_REVEAL px dentro.
  const hiddenX = isRight ? PEEK_SIZE : -PEEK_SIZE;
  const shownX = isRight ? PEEK_SIZE - PEEK_REVEAL : -(PEEK_SIZE - PEEK_REVEAL);
  const translateX = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [hiddenX, shownX],
  });

  return (
    <View pointerEvents="none" style={styles.peekRoot}>
      <Animated.View
        style={[
          styles.peekMascot,
          isRight ? { right: 0 } : { left: 0 },
          {
            top: `${peek.topPct * 100}%`,
            opacity: slide,
            transform: [
              { translateX },
              // Girada 90°: asoma tumbada de lado desde el borde.
              { rotate: isRight ? '-90deg' : '90deg' },
            ],
          },
        ]}
      >
        <CarismochitoMascot size={PEEK_SIZE} dance={1} />
      </Animated.View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Badge flotante                                                             */
/* -------------------------------------------------------------------------- */

/** Tiempo que el badge superior permanece visible antes de retirarse solo. */
const BADGE_VISIBLE_MS = 3800;

function FloatingBadge({ onDeactivate }: { onDeactivate: () => void }) {
  const insets = useSafeAreaInsets();
  const enter = useRef(new Animated.Value(0)).current;
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    Animated.spring(enter, {
      toValue: 1,
      tension: 80,
      friction: 9,
      useNativeDriver: true,
    }).start();

    // Se asoma para anunciar el modo y, pasados unos segundos, se desliza
    // hacia arriba y se desmonta para no estorbar (se sigue saliendo agitando).
    const t = setTimeout(() => {
      Animated.timing(enter, {
        toValue: 0,
        duration: 420,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setHidden(true));
    }, BADGE_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [enter]);

  const translateY = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [-60, 0],
  });

  if (hidden) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.badgeRoot,
        { top: insets.top + 8, opacity: enter, transform: [{ translateY }] },
      ]}
    >
      <Pressable
        onPress={onDeactivate}
        style={({ pressed }) => [
          styles.badge,
          pressed && { transform: [{ scale: 0.97 }], opacity: 0.92 },
        ]}
        hitSlop={6}
      >
        <CarismochitoMascot size={38} dance={1} />
        <View style={styles.badgeText}>
          <Text style={styles.badgeTitle}>MODO CARISMOCHITO</Text>
          <Text style={styles.badgeSubtitle}>Agita o tócame para salir</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/* Overlay principal                                                          */
/* -------------------------------------------------------------------------- */

export default function CarismochitoOverlay() {
  const {
    state,
    countdown,
    countdownSeconds,
    freshlyActivated,
    chargeCount,
    shakesNeeded,
    toggleByShake,
    cancelCountdown,
    deactivate,
  } = useCarismochito();

  // Listener de shake siempre activo — el contexto decide qué hacer según estado.
  useShakeDetector(toggleByShake);

  return (
    <>
      {state === 'active' ? <SidePeekMascot /> : null}
      {/* Celebración (confeti + badge) sólo en activación nueva, no al
          restaurar el modo al reabrir la app. */}
      {state === 'active' && freshlyActivated ? <CelebrationConfetti /> : null}
      {state === 'active' && freshlyActivated ? (
        <FloatingBadge onDeactivate={deactivate} />
      ) : null}
      {state === 'idle' && chargeCount > 0 ? (
        <ChargeDots count={chargeCount} total={shakesNeeded} />
      ) : null}
      {state === 'countingDown' ? (
        <View style={styles.modalRoot} pointerEvents="auto">
          <CountdownScreen
            countdown={countdown}
            totalSeconds={countdownSeconds}
            onCancel={cancelCountdown}
          />
        </View>
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Estilos                                                                    */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  /* Confeti de celebración */
  confettiRoot: {
    zIndex: 9600,
    elevation: 58,
  },

  /* Mascota asomándose girada 90° desde un lateral */
  peekRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9300,
    elevation: 52,
  },
  peekMascot: {
    position: 'absolute',
    ...Platform.select({
      ios: {
        shadowColor: G_GLOW,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 14,
      },
      android: { elevation: 12 },
      default: {
        // @ts-ignore - web only
        boxShadow: `0px 0px 18px ${G_GLOW}`,
      },
    }),
  },

  /* Badge flotante */
  badgeRoot: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9500,
    elevation: 60,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: G_DARK,
    borderRadius: 28,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 16,
    gap: 10,
    borderWidth: 2,
    borderColor: G,
    ...Platform.select({
      ios: {
        shadowColor: G,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.55,
        shadowRadius: 18,
      },
      android: {
        elevation: 16,
      },
      default: {
        // @ts-ignore - web only
        boxShadow: `0px 6px 22px ${G}AA`,
      },
    }),
  },
  badgeText: {
    paddingRight: 4,
  },
  badgeTitle: {
    color: G_LIGHT,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1.4,
  },
  badgeSubtitle: {
    color: '#D4F5A0',
    fontSize: 10,
    marginTop: 2,
    letterSpacing: 0.3,
  },

  /* Modal de cuenta atrás */
  modalRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9998,
    elevation: 80,
  },
  countdownRoot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  countdownContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  haloOuter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: G,
    opacity: 0.16,
    ...Platform.select({
      ios: {
        shadowColor: G_GLOW,
        shadowOpacity: 0.7,
        shadowRadius: 80,
        shadowOffset: { width: 0, height: 0 },
      },
      android: { elevation: 0 },
      default: {
        // @ts-ignore - web only
        boxShadow: `0px 0px 120px ${G_GLOW}`,
      },
    }),
  },
  activatingLabel: {
    color: G_LIGHT,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 4,
    textTransform: 'uppercase',
    opacity: 0.85,
  },
  carismoTitle: {
    color: '#E8FFB8',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 3,
    marginTop: 4,
    marginBottom: 18,
    textShadowColor: G_GLOW,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  ringBox: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    position: 'absolute',
    bottom: 6,
    color: '#ffffff',
    fontSize: 52,
    fontWeight: '900',
    textShadowColor: G_GLOW,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
    includeFontPadding: false,
  },
  subtle: {
    color: '#A3D86E',
    fontSize: 13,
    marginTop: 22,
    marginBottom: 28,
    textAlign: 'center',
    opacity: 0.85,
  },
  cancelBtn: {
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 30,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: G,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
      default: {
        // @ts-ignore - web only
        boxShadow: '0px 4px 14px rgba(0,0,0,0.3)',
      },
    }),
  },
  cancelText: {
    color: G_DARK,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
