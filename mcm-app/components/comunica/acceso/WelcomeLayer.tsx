// La entrada en Comunica (14/11/2026, rehecha): un círculo con el degradado de
// marca crece desde el botón hasta llenarlo todo, un anillo blanco se dibuja y
// cierra con su marca, entra el saludo («Hola, David» y la delegación) y la
// capa se abre —se desvanece y se agranda un pelo— YA sobre la portada.
//
// Vive en la puerta (`app/(tabs)/comunica/index.tsx`), por encima del acceso y
// de la portada: el acceso se va debajo sin que se vea. El estado y los
// tiempos están en `welcome.ts`. Con «Reducir movimiento», sin el círculo ni
// el trazo: aparece, saluda y se va.
//
// Es la ÚNICA pieza fuera de `comun/` con permiso para `BrandGradient`
// (`__tests__/comunica/territorio.test.ts`): no es un bloque de la pantalla,
// es la transición entre dos pantallas y dura poco más de un segundo.

import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  FadeInDown,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { motionEasings, reaEasings } from '@/constants/animations';
import typography from '@/constants/typography';
import { h } from '@/utils/haptics';
import BrandGradient from '../comun/BrandGradient';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import { ACCESS_TEXT } from './copy';
import {
  getWelcome,
  markCovered,
  REVEAL_MS,
  subscribeWelcome,
  type Welcome,
} from './welcome';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const RING = 96;
const STROKE = 4;
const R = (RING - STROKE) / 2;
const RING_C = 2 * Math.PI * R;
/** La marca dentro del anillo (en el sistema de 96 × 96). */
const CHECK = 'M30 49 L43 62 L67 36';
const CHECK_LEN = 56;
// La coreografía, en orden. Todo junto: ~1 s hasta quedar quieto (`COVER_MS`).
/** El círculo llena la pantalla. */
const GROW_MS = 600;
/** El anillo empieza a dibujarse con el círculo ya grande. */
const RING_DELAY_MS = 260;
const RING_MS = 520;
/** La marca, al cerrar el anillo. */
const CHECK_DELAY_MS = 700;
const CHECK_MS = 260;
/** El saludo sube mientras se dibuja el anillo. */
const TEXT_DELAY_MS = 520;
const TEXT_MS = 380;
/**
 * El anillo aparece con un rebote corto: es una celebración (la única de esta
 * pantalla), que es donde `design.md` §6 deja que haya rebote.
 */
const POP_MS = 450;
const POP_DAMPING = 0.55;

export default function WelcomeLayer() {
  const w = useSyncExternalStore(subscribeWelcome, getWelcome, getWelcome);
  if (!w) return null;
  // Una entrada nueva, una capa nueva (y sus animaciones desde cero).
  return <Layer key={w.id} w={w} />;
}

function Layer({ w }: { w: Welcome }) {
  const t = useComunicaTheme();
  const reduced = useReducedMotion();
  const win = useWindowDimensions();
  // El botón llega en coordenadas de ventana; la capa empieza bajo la cabecera.
  const root = useRef<React.ComponentRef<typeof View>>(null);
  const [box, setBox] = useState({
    x: 0,
    y: 0,
    width: win.width,
    height: win.height,
  });
  const measure = () =>
    root.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) setBox({ x, y, width, height });
    });
  const { width, height } = box;

  // El círculo: centrado en el botón y con radio para llegar a la esquina más lejana.
  const ox = w.origin ? w.origin.x - box.x : width / 2;
  const oy = w.origin ? w.origin.y - box.y : height / 2;
  const reach = Math.hypot(Math.max(ox, width - ox), Math.max(oy, height - oy));
  const D = Math.ceil(reach * 2) + 8;

  // Si se vuelve a montar ya tapado (la pila se rehace al guardar la sesión),
  // todo está en su sitio y no se repite nada.
  const still = reduced || w.covered;
  const grow = useSharedValue(still ? 1 : 0);
  const ring = useSharedValue(still ? 1 : 0);
  const check = useSharedValue(still ? 1 : 0);
  const pop = useSharedValue(still ? 1 : 0.6);
  const open = useSharedValue(0);

  useEffect(() => {
    if (w.covered) return;
    if (reduced) {
      h.formSuccess();
      markCovered(w.id);
      return;
    }
    grow.set(
      withTiming(1, {
        duration: GROW_MS,
        easing: motionEasings.out,
      }),
    );
    pop.set(
      withDelay(
        RING_DELAY_MS,
        withSpring(1, { duration: POP_MS, dampingRatio: POP_DAMPING }),
      ),
    );
    ring.set(
      withDelay(
        RING_DELAY_MS,
        withTiming(1, { duration: RING_MS, easing: motionEasings.out }),
      ),
    );
    check.set(
      withDelay(
        CHECK_DELAY_MS,
        withTiming(
          1,
          { duration: CHECK_MS, easing: motionEasings.out },
          (done) => {
            if (!done) return;
            runOnJS(h.formSuccess)();
            // Todo quieto: ya se puede guardar la sesión (`welcome.ts`).
            runOnJS(markCovered)(w.id);
          },
        ),
      ),
    );
    // Solo al montar: cada entrada es una capa nueva.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (w.phase === 'reveal') {
      open.set(
        withTiming(1, {
          duration: REVEAL_MS,
          easing: reaEasings.exit,
        }),
      );
    }
  }, [w.phase, open]);

  const layerStyle = useAnimatedStyle(() => ({
    opacity: 1 - open.get(),
    transform: [{ scale: 1 + open.get() * 0.04 }],
  }));
  const discStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(grow.get(), [0, 1], [0.02, 1]) }],
    // Con «Reducir movimiento» no crece: aparece.
    opacity: reduced
      ? 1
      : interpolate(grow.get(), [0, 0.15], [0.6, 1], 'clamp'),
  }));
  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.get() }],
    opacity: interpolate(pop.get(), [0.6, 0.8], [0, 1], 'clamp'),
  }));
  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(ring.get(), [0, 1], [RING_C, 0]),
  }));
  const checkProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(check.get(), [0, 1], [CHECK_LEN, 0]),
  }));

  const greeting = ACCESS_TEXT.welcome(w.name);
  return (
    <Animated.View
      ref={root}
      onLayout={measure}
      style={[StyleSheet.absoluteFill, styles.layer, layerStyle]}
      pointerEvents={w.phase === 'reveal' ? 'none' : 'auto'}
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={w.subtitle ? `${greeting} ${w.subtitle}` : greeting}
    >
      <Animated.View
        style={[
          styles.disc,
          {
            width: D,
            height: D,
            borderRadius: D / 2,
            left: ox - D / 2,
            top: oy - D / 2,
          },
          discStyle,
        ]}
      >
        <BrandGradient variant="block" sheen />
      </Animated.View>

      <View style={styles.center} pointerEvents="none">
        <Animated.View style={badgeStyle}>
          <Svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`}>
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={R}
              fill={t.gradientOverlay}
            />
            <AnimatedCircle
              cx={RING / 2}
              cy={RING / 2}
              r={R}
              stroke={t.onGradient}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${RING_C} ${RING_C}`}
              animatedProps={ringProps}
              // El trazo empieza arriba y gira en el sentido del reloj.
              transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
            />
            <AnimatedPath
              d={CHECK}
              stroke={t.onGradient}
              strokeWidth={STROKE + 1}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={`${CHECK_LEN} ${CHECK_LEN}`}
              animatedProps={checkProps}
            />
          </Svg>
        </Animated.View>
        <Animated.View
          entering={
            still
              ? undefined
              : FadeInDown.duration(TEXT_MS).delay(TEXT_DELAY_MS)
          }
          style={styles.texts}
        >
          <Text
            style={[styles.title, { color: t.onGradient }]}
            numberOfLines={2}
          >
            {greeting}
          </Text>
          {w.subtitle ? (
            <Text
              style={[styles.subtitle, { color: t.onGradient }]}
              numberOfLines={2}
            >
              {w.subtitle}
            </Text>
          ) : null}
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: { zIndex: 1000, elevation: 1000, overflow: 'hidden' },
  disc: { position: 'absolute', overflow: 'hidden' },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 24,
  },
  texts: { alignItems: 'center', gap: 6 },
  title: { ...typography.h1, textAlign: 'center' },
  subtitle: { ...typography.body, textAlign: 'center', opacity: 0.9 },
});
