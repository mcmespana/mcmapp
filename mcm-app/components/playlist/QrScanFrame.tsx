/**
 * La "ventana" animada del escáner de QR: las cuatro esquinas y el láser que
 * barre el hueco. Vive aparte de `QrScannerModal` para que ninguno de los dos
 * se convierta en un gigante (y porque aquí no hay nada de cámara: son formas
 * animadas y se pueden mirar en aislado).
 *
 * Todo corre en Reanimated (hilo de UI), así que el barrido no se entrecorta
 * mientras JS está ocupado decodificando fotogramas.
 */
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

/** Lado del hueco transparente por el que se apunta al QR. */
export const FRAME_SIZE = 250;
/** Largo del brazo de cada esquina. */
const CORNER = 42;
const BORDER = 4;
const IDLE_COLOR = '#FFFFFF';
const OK_COLOR = '#A3BD31';

const CORNERS = [
  { top: 0, left: 0, rx: 0 },
  { top: 0, right: 0, rx: 90 },
  { bottom: 0, right: 0, rx: 180 },
  { bottom: 0, left: 0, rx: 270 },
] as const;

interface Props {
  /** Al pasar a `true` el marco se pone verde y da un golpe de escala. */
  found: boolean;
}

export default function QrScanFrame({ found }: Props) {
  // 0 → cerrado (recién abierto), 1 → marco montado y listo para escanear.
  const open = useSharedValue(0);
  // 0 → escaneando, 1 → ¡lo tenemos!
  const hit = useSharedValue(0);

  useEffect(() => {
    open.value = withDelay(
      120,
      withSpring(1, { stiffness: 140, damping: 13, mass: 0.9 }),
    );
  }, [open]);

  useEffect(() => {
    if (!found) return;
    // Golpe seco hacia fuera y vuelta: el marco "atrapa" el código.
    hit.value = withSequence(
      withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) }),
      withSpring(0.6, { stiffness: 200, damping: 12 }),
    );
  }, [found, hit]);

  const wrapStyle = useAnimatedStyle(() => ({
    opacity: interpolate(open.value, [0, 0.4, 1], [0, 1, 1]),
    transform: [
      { scale: interpolate(open.value, [0, 1], [0.78, 1]) },
      { scale: interpolate(hit.value, [0, 1], [1, 1.08]) },
    ],
  }));

  return (
    <Animated.View style={[styles.frame, wrapStyle]}>
      {CORNERS.map((c, i) => (
        <FrameCorner key={i} corner={c} index={i} found={found} />
      ))}
      {found ? <FoundFlash /> : <ScanLaser />}
    </Animated.View>
  );
}

/**
 * Una esquina en forma de L. Entra girando un poco y escalonada respecto a las
 * demás, que es lo que hace que el marco parezca "dibujarse" al abrir.
 */
function FrameCorner({
  corner,
  index,
  found,
}: {
  corner: (typeof CORNERS)[number];
  index: number;
  found: boolean;
}) {
  const enter = useSharedValue(0);

  useEffect(() => {
    enter.value = withDelay(
      140 + index * 70,
      withSpring(1, { stiffness: 170, damping: 12 }),
    );
  }, [enter, index]);

  const style = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { scale: interpolate(enter.value, [0, 1], [0.4, 1]) },
      {
        rotate: `${corner.rx + interpolate(enter.value, [0, 1], [-25, 0])}deg`,
      },
    ],
  }));

  // Posicionamiento estático (top/left/…) fuera del estilo animado.
  const place: any = {};
  if ('top' in corner) place.top = corner.top;
  if ('bottom' in corner) place.bottom = (corner as any).bottom;
  if ('left' in corner) place.left = (corner as any).left;
  if ('right' in corner) place.right = (corner as any).right;

  const color = found ? OK_COLOR : IDLE_COLOR;

  return (
    <Animated.View style={[styles.corner, place, style]}>
      <View style={[styles.armH, { backgroundColor: color }]} />
      <View style={[styles.armV, { backgroundColor: color }]} />
    </Animated.View>
  );
}

/** Línea que barre el hueco de arriba abajo sin parar mientras se escanea. */
function ScanLaser() {
  const sweep = useSharedValue(0);

  useEffect(() => {
    sweep.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [sweep]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(sweep.value, [0, 0.1, 0.9, 1], [0.2, 1, 1, 0.2]),
    transform: [
      {
        translateY: interpolate(
          sweep.value,
          [0, 1],
          [BORDER, FRAME_SIZE - BORDER],
        ),
      },
    ],
  }));

  return (
    <Animated.View style={[styles.laser, style]} pointerEvents="none">
      <LinearGradient
        colors={['rgba(149,210,242,0)', '#95d2f2', 'rgba(149,210,242,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.laserLine}
      />
    </Animated.View>
  );
}

/** Fogonazo verde que rellena el hueco justo al encontrar el código. */
function FoundFlash() {
  const flash = useSharedValue(0);

  useEffect(() => {
    flash.value = withSequence(
      withTiming(1, { duration: 120 }),
      withTiming(0.25, { duration: 320 }),
    );
  }, [flash]);

  const style = useAnimatedStyle(() => ({ opacity: flash.value * 0.55 }));

  return <Animated.View style={[styles.flash, style]} pointerEvents="none" />;
}

const styles = StyleSheet.create({
  frame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    overflow: 'hidden',
    borderRadius: 28,
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
  },
  armH: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CORNER,
    height: BORDER,
    borderRadius: BORDER,
  },
  armV: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: BORDER,
    height: CORNER,
    borderRadius: BORDER,
  },
  laser: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 3,
  },
  laserLine: {
    flex: 1,
    borderRadius: 3,
  },
  flash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: OK_COLOR,
  },
});
