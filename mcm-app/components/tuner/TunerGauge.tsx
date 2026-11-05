/**
 * El arco del afinador: de −50 a +50 cents, con la marca del centro y una
 * «bola» que recorre el arco con un muelle. Del centro a la bola se rellena el
 * tramo (cuánto te falta), y la zona de ±5 cents se ve siempre en verde suave:
 * es el sitio al que hay que llevarla.
 *
 * Todo lo que se mueve va en el hilo de UI (`useAnimatedProps`): la pantalla
 * le pasa los cents ~20 veces por segundo y el muelle reapunta sin cortes, así
 * que la bola fluye en vez de saltar de lectura en lectura.
 *
 * Agnóstico de territorio por contrato: los colores entran por props.
 */
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { durations, springs } from '@/constants/animations';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Media apertura del arco, en grados desde la vertical. */
const SWEEP_DEG = 68;
/** Cents en cada extremo del arco. */
export const GAUGE_RANGE_CENTS = 50;
/** Margen de «afinada» que se pinta en verde. */
const ZONE_CENTS = 5;
const TRACK_WIDTH = 6;
const PUCK_RADIUS = 11;
const TICK_GAP = 10;
const TICK_MINOR = 6;
const TICK_MAJOR = 12;

export interface TunerGaugeColors {
  track: string;
  tick: string;
  tickStrong: string;
  zone: string;
  inTune: string;
  near: string;
  idle: string;
  puckCore: string;
}

interface TunerGaugeProps {
  width: number;
  /** Cents respecto a la cuerda (se recortan a ±50 para pintar). */
  cents: number;
  active: boolean;
  inTune: boolean;
  colors: TunerGaugeColors;
}

function polar(cx: number, cy: number, r: number, deg: number) {
  'worklet';
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

function arcPath(cx: number, cy: number, r: number, from: number, to: number) {
  'worklet';
  const a = polar(cx, cy, r, from);
  const b = polar(cx, cy, r, to);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  const sweep = to > from ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} ${sweep} ${b.x} ${b.y}`;
}

const centsToDeg = (c: number) => {
  'worklet';
  const clamped = Math.max(-GAUGE_RANGE_CENTS, Math.min(GAUGE_RANGE_CENTS, c));
  return (clamped / GAUGE_RANGE_CENTS) * SWEEP_DEG;
};

/** Alto que ocupa el arco para un ancho dado. */
export function gaugeHeight(width: number): number {
  const r = width / 2 - TICK_GAP - TICK_MAJOR;
  return TICK_GAP + TICK_MAJOR + r + PUCK_RADIUS;
}

export default function TunerGauge({
  width,
  cents,
  active,
  inTune,
  colors,
}: TunerGaugeProps) {
  const reducedMotion = useReducedMotion();
  const r = width / 2 - TICK_GAP - TICK_MAJOR;
  const cx = width / 2;
  const cy = TICK_GAP + TICK_MAJOR + r;
  const height = gaugeHeight(width);

  const deg = useSharedValue(0);
  const activeProgress = useSharedValue(active ? 1 : 0);
  // 0 «casi» (naranja) → 1 afinada (verde): se funde en vez de saltar.
  const tuneMix = useSharedValue(0);

  useEffect(() => {
    const target = active ? centsToDeg(cents) : 0;
    deg.set(reducedMotion ? target : withSpring(target, springs.settle));
  }, [cents, active, deg, reducedMotion]);

  useEffect(() => {
    tuneMix.set(withTiming(inTune ? 1 : 0, { duration: durations.base }));
  }, [inTune, tuneMix]);

  useEffect(() => {
    activeProgress.set(
      withTiming(active ? 1 : 0, { duration: durations.base }),
    );
  }, [active, activeProgress]);

  // El color NO se anima como color: en web, Reanimated no aplica un `fill` o
  // un `stroke` animado a un SVG (se queda en el primero). Se pintan tres
  // capas con su color fijo —en reposo, «casi» y afinada— y se reparte la
  // opacidad entre ellas, que es un número y va igual en todas partes.
  const weights = useDerivedValue(() => {
    const a = activeProgress.get();
    const k = tuneMix.get();
    return { idle: 1 - a, near: a * (1 - k), tune: a * k };
  });

  const arcD = useDerivedValue(() => {
    const d = deg.get();
    // Un tramo de menos de medio grado no se pinta (en Android deja una
    // mota rara en el centro).
    return Math.abs(d) > 0.5
      ? arcPath(cx, cy, r, Math.min(0, d), Math.max(0, d))
      : `M ${cx} ${cy - r}`;
  });
  const nearFillProps = useAnimatedProps(() => ({
    d: arcD.get(),
    strokeOpacity: 0.85 * weights.get().near,
  }));
  const tuneFillProps = useAnimatedProps(() => ({
    d: arcD.get(),
    strokeOpacity: 0.85 * weights.get().tune,
  }));

  const haloNear = useAnimatedProps(() => {
    const p = polar(cx, cy, r, deg.get());
    return { cx: p.x, cy: p.y, opacity: 0.22 * weights.get().near };
  });
  const haloTune = useAnimatedProps(() => {
    const p = polar(cx, cy, r, deg.get());
    return { cx: p.x, cy: p.y, opacity: 0.28 * weights.get().tune };
  });
  const puckIdle = useAnimatedProps(() => {
    const p = polar(cx, cy, r, deg.get());
    return { cx: p.x, cy: p.y, opacity: weights.get().idle };
  });
  const puckNear = useAnimatedProps(() => {
    const p = polar(cx, cy, r, deg.get());
    return { cx: p.x, cy: p.y, opacity: weights.get().near };
  });
  const puckTune = useAnimatedProps(() => {
    const p = polar(cx, cy, r, deg.get());
    return { cx: p.x, cy: p.y, opacity: weights.get().tune };
  });
  const coreProps = useAnimatedProps(() => {
    const p = polar(cx, cy, r, deg.get());
    return { cx: p.x, cy: p.y };
  });

  const ticks = useMemo(() => {
    const out: {
      key: number;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      major: boolean;
      center: boolean;
    }[] = [];
    for (let c = -GAUGE_RANGE_CENTS; c <= GAUGE_RANGE_CENTS; c += 5) {
      const major = c % 25 === 0;
      const d = centsToDeg(c);
      const inner = polar(cx, cy, r + TICK_GAP, d);
      const outer = polar(
        cx,
        cy,
        r + TICK_GAP + (major ? TICK_MAJOR : TICK_MINOR),
        d,
      );
      out.push({
        key: c,
        x1: inner.x,
        y1: inner.y,
        x2: outer.x,
        y2: outer.y,
        major,
        center: c === 0,
      });
    }
    return out;
  }, [cx, cy, r]);

  return (
    <View
      style={{ width, height }}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {/* Carril */}
        <Path
          d={arcPath(cx, cy, r, -SWEEP_DEG, SWEEP_DEG)}
          stroke={colors.track}
          strokeWidth={TRACK_WIDTH}
          strokeLinecap="round"
          fill="none"
        />
        {/* La zona de «afinada» */}
        <Path
          d={arcPath(
            cx,
            cy,
            r,
            centsToDeg(-ZONE_CENTS),
            centsToDeg(ZONE_CENTS),
          )}
          stroke={colors.zone}
          strokeWidth={TRACK_WIDTH}
          strokeLinecap="round"
          fill="none"
        />
        {ticks.map((t) => (
          <Line
            key={t.key}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={t.center || t.major ? colors.tickStrong : colors.tick}
            strokeWidth={t.center ? 3 : t.major ? 2 : 1.5}
            strokeLinecap="round"
          />
        ))}
        {/* Tramo del centro a la bola */}
        <AnimatedPath
          animatedProps={nearFillProps}
          stroke={colors.near}
          strokeWidth={TRACK_WIDTH}
          strokeLinecap="round"
          fill="none"
        />
        <AnimatedPath
          animatedProps={tuneFillProps}
          stroke={colors.inTune}
          strokeWidth={TRACK_WIDTH}
          strokeLinecap="round"
          fill="none"
        />
        <AnimatedCircle
          animatedProps={haloNear}
          r={PUCK_RADIUS * 2}
          fill={colors.near}
        />
        <AnimatedCircle
          animatedProps={haloTune}
          r={PUCK_RADIUS * 2.2}
          fill={colors.inTune}
        />
        <AnimatedCircle
          animatedProps={puckIdle}
          r={PUCK_RADIUS}
          fill={colors.idle}
        />
        <AnimatedCircle
          animatedProps={puckNear}
          r={PUCK_RADIUS}
          fill={colors.near}
        />
        <AnimatedCircle
          animatedProps={puckTune}
          r={PUCK_RADIUS}
          fill={colors.inTune}
        />
        <AnimatedCircle
          animatedProps={coreProps}
          r={PUCK_RADIUS * 0.36}
          fill={colors.puckCore}
        />
      </Svg>
    </View>
  );
}
