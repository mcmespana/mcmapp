// components/ui/ComunicaLoader.tsx
// Pantalla de carga de marca para el WebView de Comunica.
//
// Comunica tarda en responder (el CRM va lento), así que en vez de dejar un
// hueco vacío o un spinner suelto se muestra una portada animada con la onda
// del logo, una barra de progreso real (`onLoadProgress`) y un esqueleto de
// formulario que anticipa lo que va a aparecer. Al terminar se desvanece.
//
// Solo RN Animated (native driver) + expo-linear-gradient: nada de SVG ni
// dependencias nuevas. Todo el color sale de tokens y respeta claro/oscuro.

import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import brand from '@/constants/colors';
import spacing from '@/constants/spacing';
import { radii } from '@/constants/uiStyles';
import { durations, easings } from '@/constants/animations';

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

  // ── Animaciones en loop: onda + anillo que respira ────────────────────────
  const bars = useRef(WAVE_BARS.map(() => new Animated.Value(0.45))).current;
  const ring = useRef(new Animated.Value(0)).current;
  const entry = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loops = bars.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(WAVE_BARS[i].delay),
          Animated.timing(v, {
            toValue: 1,
            duration: 480,
            easing: easings.cubic,
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0.4,
            duration: 480,
            easing: easings.cubic,
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    const ringLoop = Animated.loop(
      Animated.timing(ring, {
        toValue: 1,
        duration: 2200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    const enter = Animated.timing(entry, {
      toValue: 1,
      duration: durations.slow,
      easing: easings.bouncy,
      useNativeDriver: true,
    });

    enter.start();
    loops.forEach((l) => l.start());
    ringLoop.start();
    return () => {
      enter.stop();
      loops.forEach((l) => l.stop());
      ringLoop.stop();
    };
  }, [bars, ring, entry]);

  // ── Barra de progreso ─────────────────────────────────────────────────────
  // `onLoadProgress` llega a saltos (y en Android a veces se queda en 0.1 un
  // rato), así que se anima hacia el valor recibido con un mínimo visible para
  // que la barra nunca parezca congelada del todo.
  const bar = useRef(new Animated.Value(0.06)).current;
  useEffect(() => {
    Animated.timing(bar, {
      toValue: Math.max(0.06, Math.min(progress, 1)),
      duration: 420,
      easing: easings.standard,
      useNativeDriver: true,
    }).start();
  }, [bar, progress]);

  // ── Shimmer del esqueleto ─────────────────────────────────────────────────
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1400,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const shimmerStyle = {
    opacity: shimmer.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.45, 1, 0.45],
    }),
  };

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
        <Animated.View
          style={{
            opacity: entry,
            transform: [
              {
                translateY: entry.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12, 0],
                }),
              },
            ],
            alignItems: 'center',
          }}
        >
          {/* Marca: burbuja con la onda de audio del logo + anillo que respira */}
          <View style={styles.markWrapper}>
            <Animated.View
              style={[
                styles.markRing,
                {
                  borderColor: palette.markRing,
                  opacity: ring.interpolate({
                    inputRange: [0, 0.15, 1],
                    outputRange: [0, 0.9, 0],
                  }),
                  transform: [
                    {
                      scale: ring.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.85, 1.45],
                      }),
                    },
                  ],
                },
              ]}
            />
            <View style={[styles.mark, { backgroundColor: palette.markBg }]}>
              <View style={styles.wave}>
                {WAVE_BARS.map((b, i) => (
                  <Animated.View
                    key={i}
                    style={{
                      width: 6,
                      height: b.h,
                      borderRadius: 3,
                      backgroundColor:
                        i % 2 === 0 ? palette.accent : palette.accentSoft,
                      transform: [{ scaleY: bars[i] }],
                    }}
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
                  {
                    backgroundColor: palette.accent,
                    // scaleX sobre el ancho completo: animable en el hilo
                    // nativo (a diferencia de `width`, que va por JS).
                    transform: [{ scaleX: bar }],
                  },
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
    borderRadius: radii.pill,
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
    borderRadius: radii.pill,
    width: '55%',
  },
});
