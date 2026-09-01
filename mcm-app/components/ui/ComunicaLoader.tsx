// components/ui/ComunicaLoader.tsx
// Pantalla de carga de marca para el WebView de Comunica.
//
// Comunica tarda en responder (el CRM va lento), así que en vez de dejar un
// hueco vacío o un spinner suelto se muestra una portada animada con la onda
// del logo, una barra de progreso real (`onLoadProgress`) y un esqueleto de
// formulario que anticipa lo que va a aparecer. Al terminar se desvanece.
//
// Solo Reanimated + expo-linear-gradient: nada de SVG ni dependencias nuevas.
// Todo el color sale de tokens y respeta claro/oscuro. Las animaciones corren
// en el hilo de UI, que aquí importa especialmente: esta portada se ve JUSTO
// mientras JS está ocupado arrancando el WebView.

import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import brand from '@/constants/colors';
import spacing from '@/constants/spacing';
import { radii } from '@/constants/uiStyles';
import { durations, reaEasings } from '@/constants/animations';

interface ComunicaLoaderProps {
  /** Tema resuelto por la app (no el del sistema). */
  scheme: 'light' | 'dark';
  /** Progreso de carga del WebView (0–1). */
  progress: number;
  /** Cuando es true, en vez del progreso se ofrece reintentar. */
  error?: boolean;
  /** Reintento tras error. */
  onRetry?: () => void;
  /** Espacio superior (notch) e inferior (tab bar) a respetar. */
  insetTop?: number;
  insetBottom?: number;
}

// Barras de la onda del logo (alturas relativas en reposo) y desfase del loop.
const WAVE_BARS = [
  { h: 18, delay: 0 },
  { h: 34, delay: 120 },
  { h: 52, delay: 240 },
  { h: 34, delay: 360 },
  { h: 22, delay: 480 },
];

/**
 * Una barra de la onda del logo, latiendo en bucle con su propio desfase.
 *
 * Cada barra tiene su `useSharedValue` porque los hooks no se pueden llamar en
 * un bucle — antes era un array de `Animated.Value` guardado en un ref. El
 * retardo va DENTRO de la secuencia repetida, igual que el `Animated.delay`
 * original, para conservar el mismo ritmo.
 */
function WaveBar({
  height,
  delay,
  color,
}: {
  height: number;
  delay: number;
  color: string;
}) {
  const scale = useSharedValue(0.45);

  useEffect(() => {
    scale.set(
      withRepeat(
        withSequence(
          withDelay(
            delay,
            withTiming(1, { duration: 480, easing: reaEasings.cubic }),
          ),
          withTiming(0.4, { duration: 480, easing: reaEasings.cubic }),
        ),
        -1,
        false,
      ),
    );
  }, [scale, delay]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scaleY: scale.get() }],
  }));

  return (
    <Animated.View
      style={[
        { width: 6, height, borderRadius: 3, backgroundColor: color },
        style,
      ]}
    />
  );
}

export default function ComunicaLoader({
  scheme,
  progress,
  error = false,
  onRetry,
  insetTop = 0,
  insetBottom = 0,
}: ComunicaLoaderProps) {
  const isDark = scheme === 'dark';

  // Paleta: azules del logo de Comunica. En oscuro se aclaran para mantener
  // contraste sobre el fondo casi negro de la web.
  const palette = useMemo(
    () =>
      isDark
        ? {
            gradient: ['#121316', '#171B24', '#121316'] as const,
            accent: brand.info, // celeste
            accentSoft: brand.secondary, // azul letras
            title: '#F2F4F8',
            subtitle: 'rgba(242,244,248,0.62)',
            skeleton: 'rgba(255,255,255,0.07)',
            skeletonHi: 'rgba(255,255,255,0.16)',
            track: 'rgba(255,255,255,0.12)',
            markBg: 'rgba(49,170,223,0.12)',
            markRing: 'rgba(49,170,223,0.35)',
          }
        : {
            gradient: ['#FFFFFF', '#F3F7FD', '#FFFFFF'] as const,
            accent: brand.primary, // azul fondo MCM
            accentSoft: brand.info,
            title: brand.text,
            subtitle: 'rgba(0,43,129,0.55)',
            skeleton: 'rgba(37,56,131,0.07)',
            skeletonHi: 'rgba(37,56,131,0.14)',
            track: 'rgba(37,56,131,0.12)',
            markBg: 'rgba(37,56,131,0.07)',
            markRing: 'rgba(37,56,131,0.18)',
          },
    [isDark],
  );

  // ── Animaciones en loop: anillo que respira + entrada ─────────────────────
  const ring = useSharedValue(0);
  const entry = useSharedValue(0);

  useEffect(() => {
    entry.set(
      withTiming(1, {
        duration: durations.slow,
        easing: reaEasings.bouncy,
      }),
    );
    ring.set(
      withRepeat(
        withTiming(1, { duration: 2200, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      ),
    );
  }, [ring, entry]);

  // ── Barra de progreso ─────────────────────────────────────────────────────
  // `onLoadProgress` llega a saltos (y en Android a veces se queda en 0.1 un
  // rato), así que se anima hacia el valor recibido con un mínimo visible para
  // que la barra nunca parezca congelada del todo.
  const bar = useSharedValue(0.06);
  useEffect(() => {
    bar.set(
      withTiming(Math.max(0.06, Math.min(progress, 1)), {
        duration: 420,
        easing: reaEasings.standard,
      }),
    );
  }, [bar, progress]);

  // ── Shimmer del esqueleto ─────────────────────────────────────────────────
  const shimmer = useSharedValue(0);
  useEffect(() => {
    shimmer.set(
      withRepeat(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        -1,
        false,
      ),
    );
  }, [shimmer]);

  // El mismo estilo se aplica a varias piezas del esqueleto: comparten un solo
  // shared value, así que laten a la vez.
  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.get(), [0, 0.5, 1], [0.45, 1, 0.45]),
  }));

  const entryStyle = useAnimatedStyle(() => ({
    opacity: entry.get(),
    transform: [{ translateY: interpolate(entry.get(), [0, 1], [12, 0]) }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ring.get(), [0, 0.15, 1], [0, 0.9, 0]),
    transform: [{ scale: interpolate(ring.get(), [0, 1], [0.85, 1.45]) }],
  }));

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: bar.get() }],
  }));

  const skeletonRow = (width: `${number}%`, height = 14) => (
    <Animated.View
      style={[
        { width, height, borderRadius: radii.sm },
        { backgroundColor: palette.skeleton },
        shimmerStyle,
      ]}
    />
  );

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.root]}
      // El overlay tapa la web mientras carga; los toques no deben llegar
      // abajo salvo al botón de reintentar (que sí es un hijo pulsable).
      accessibilityRole="progressbar"
      accessibilityLabel={
        error ? 'Error al cargar Comunica' : 'Cargando Comunica'
      }
    >
      <LinearGradient
        colors={palette.gradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 1 }}
      />

      <View
        style={[
          styles.content,
          { paddingTop: insetTop + spacing.xl, paddingBottom: insetBottom },
        ]}
      >
        <Animated.View style={[styles.entry, entryStyle]}>
          {/* Marca: burbuja con la onda de audio del logo + anillo que respira */}
          <View style={styles.markWrapper}>
            <Animated.View
              style={[
                styles.markRing,
                { borderColor: palette.markRing },
                ringStyle,
              ]}
            />
            <View style={[styles.mark, { backgroundColor: palette.markBg }]}>
              <View style={styles.wave}>
                {WAVE_BARS.map((b, i) => (
                  <WaveBar
                    key={i}
                    height={b.h}
                    delay={b.delay}
                    color={i % 2 === 0 ? palette.accent : palette.accentSoft}
                  />
                ))}
              </View>
              {/* Pico de la burbuja de diálogo del logo */}
              <View
                style={[styles.markTail, { borderTopColor: palette.markBg }]}
              />
            </View>
          </View>

          <Text style={[styles.title, { color: palette.title }]}>Comunica</Text>
          <Text style={[styles.subtitle, { color: palette.subtitle }]}>
            {error
              ? 'No hemos podido conectar con el portal'
              : 'Preparando el portal…'}
          </Text>

          {error ? (
            <Pressable
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityLabel="Reintentar"
              style={({ pressed }) => [
                styles.retry,
                {
                  backgroundColor: palette.accent,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <MaterialIcons name="refresh" size={18} color="#FFFFFF" />
              <Text style={styles.retryLabel}>Reintentar</Text>
            </Pressable>
          ) : (
            <View style={[styles.track, { backgroundColor: palette.track }]}>
              <Animated.View
                style={[
                  styles.fill,
                  // scaleX sobre el ancho completo: animable en el hilo de UI
                  // (a diferencia de `width`, que obliga a pasar por JS).
                  { backgroundColor: palette.accent },
                  barStyle,
                ]}
              />
            </View>
          )}
        </Animated.View>

        {/* Esqueleto: insinúa el formulario que está a punto de aparecer */}
        {!error && (
          <View style={styles.skeleton} pointerEvents="none">
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.skeletonGroup}>
                {skeletonRow(i === 0 ? '42%' : '34%', 10)}
                <Animated.View
                  style={[
                    styles.skeletonField,
                    { backgroundColor: palette.skeleton },
                    shimmerStyle,
                  ]}
                />
              </View>
            ))}
            <Animated.View
              style={[
                styles.skeletonButton,
                { backgroundColor: palette.skeletonHi },
                shimmerStyle,
              ]}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    gap: spacing.xl,
  },
  entry: {
    alignItems: 'center',
  },
  markWrapper: {
    width: 108,
    height: 108,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markRing: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 2,
  },
  mark: {
    width: 84,
    height: 84,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Triángulo (pico de la burbuja) hecho con bordes: alto 14, ancho 16.
  markTail: {
    position: 'absolute',
    bottom: -9,
    left: 18,
    width: 0,
    height: 0,
    borderRightWidth: 16,
    borderTopWidth: 14,
    borderRightColor: 'transparent',
  },
  wave: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 56,
  },
  title: {
    marginTop: spacing.md,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  subtitle: {
    marginTop: spacing.xs,
    fontSize: 14,
    textAlign: 'center',
  },
  track: {
    marginTop: spacing.lg,
    width: 180,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    width: '100%',
    height: '100%',
    borderRadius: 3,
    // Por defecto `scaleX` escala desde el centro; con `transformOrigin` la
    // barra crece desde el borde izquierdo (soportado en nativo y web).
    transformOrigin: 'left',
  },
  retry: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radii.xl,
  },
  retryLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  skeleton: {
    gap: spacing.md,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  skeletonGroup: {
    gap: spacing.xs,
  },
  skeletonField: {
    height: 44,
    borderRadius: radii.md,
  },
  skeletonButton: {
    height: 46,
    borderRadius: radii.xl,
    width: '55%',
  },
});
