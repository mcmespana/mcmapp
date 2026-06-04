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
/* Barra verde inferior con el carismochito bailando encima de los tabs       */
/* -------------------------------------------------------------------------- */

function BottomBarGlow() {
  const insets = useSafeAreaInsets();
  const enter = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(enter, {
      toValue: 1,
      tension: 70,
      friction: 11,
      useNativeDriver: true,
    }).start();
    // Latido verde suave y continuo del resplandor inferior.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [enter, pulse]);

  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 1],
  });
  const mascotTranslate = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [40, 0],
  });

  return (
    <View
      pointerEvents="none"
      style={[styles.bottomGlowRoot, { paddingBottom: insets.bottom }]}
    >
      {/* Resplandor verde que sube desde la barra de pestañas. */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: glowOpacity }]}>
        <LinearGradient
          colors={[
            'rgba(27, 158, 75, 0)',
            'rgba(27, 158, 75, 0.28)',
            'rgba(90, 224, 138, 0.42)',
          ]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Mascota bailando, asomada justo por encima de los iconos. */}
      <Animated.View
        style={[
          styles.bottomMascot,
          {
            opacity: enter,
            transform: [{ translateY: mascotTranslate }],
          },
        ]}
      >
        <CarismochitoMascot size={64} dance={2} />
      </Animated.View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Badge flotante                                                             */
/* -------------------------------------------------------------------------- */

function FloatingBadge({ onDeactivate }: { onDeactivate: () => void }) {
  const insets = useSafeAreaInsets();
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(enter, {
      toValue: 1,
      tension: 80,
      friction: 9,
      useNativeDriver: true,
    }).start();
  }, [enter]);

  const translateY = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [-60, 0],
  });

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
      {state === 'active' ? <BottomBarGlow /> : null}
      {state === 'active' ? <CelebrationConfetti /> : null}
      {state === 'active' ? <FloatingBadge onDeactivate={deactivate} /> : null}
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

  /* Barra verde inferior + mascota */
  bottomGlowRoot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 150,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 9300,
    elevation: 52,
  },
  bottomMascot: {
    marginBottom: 4,
    ...Platform.select({
      ios: {
        shadowColor: G_GLOW,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
      default: {
        // @ts-ignore - web only
        boxShadow: `0px 0px 20px ${G_GLOW}`,
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
