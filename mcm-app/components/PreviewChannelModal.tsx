import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { usePreviewChannel } from '@/contexts/PreviewChannelContext';

/**
 * Modal "Laboratorio Alpha" — UI deliberadamente exagerada, festiva y opuesta
 * al estilo minimalista del resto de la app. Activa/desactiva el canal preview
 * de EAS Update. Sólo se llega aquí tras dar 7 taps escondidos en elementos
 * decorativos del pie (versión + tagline "Movimiento Consolación").
 */

// ─── Datos visuales ─────────────────────────────────────────────────────────

const FLOATING_EMOJIS = [
  '🚀',
  '✨',
  '🌈',
  '🪄',
  '🎉',
  '🧪',
  '🔮',
  '⭐',
  '💫',
  '🌟',
  '🎈',
  '🛸',
];

const FUN_PHRASES = [
  'Bienvenido al multiverso de las features por venir 🐛',
  'Eres oficialmente parte del equipo cool 😎',
  'Pueden caer novedades sin previo aviso 🪂',
  'Aquí se prueba antes de que el resto del mundo lo vea 🔭',
  'Versión: mañana. Estabilidad: quizás. 🤞',
  'Pacto firmado con tinta invisible. Indeleble. 🖋️',
  'Si algo se rompe, has cumplido tu misión 🎯',
  'Bienvenido al laboratorio. Cuidado con las pócimas. ⚗️',
];

// ─── Capa de gradientes morphing ────────────────────────────────────────────

const GRADIENT_DURATION = 4000;
const GRADIENT_HOLD = 0;

function AnimatedGradients() {
  const a = useSharedValue(1);
  const b = useSharedValue(0);
  const c = useSharedValue(0);

  useEffect(() => {
    const totalCycle = GRADIENT_DURATION * 3 + GRADIENT_HOLD * 3;
    const breathe = (start: number, sv: typeof a) => {
      sv.value = withDelay(
        start,
        withRepeat(
          withSequence(
            withTiming(1, { duration: GRADIENT_DURATION }),
            withTiming(0, { duration: GRADIENT_DURATION }),
            withTiming(0, { duration: totalCycle - GRADIENT_DURATION * 2 }),
          ),
          -1,
          false,
        ),
      );
    };
    // A empieza ya visible; B y C entran escalonadas.
    a.value = 1;
    b.value = 0;
    c.value = 0;
    breathe(0, a);
    breathe(GRADIENT_DURATION, b);
    breathe(GRADIENT_DURATION * 2, c);
    return () => {
      cancelAnimation(a);
      cancelAnimation(b);
      cancelAnimation(c);
    };
  }, [a, b, c]);

  const styleA = useAnimatedStyle(() => ({ opacity: a.value }));
  const styleB = useAnimatedStyle(() => ({ opacity: b.value }));
  const styleC = useAnimatedStyle(() => ({ opacity: c.value }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, styleA]}>
        <LinearGradient
          colors={['#FF8E53', '#FE6B8B', '#F4C11E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styleB]}>
        <LinearGradient
          colors={['#6A11CB', '#2575FC', '#00C9A7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styleC]}>
        <LinearGradient
          colors={['#43E97B', '#38F9D7', '#5B86E5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

// ─── Partículas flotando ────────────────────────────────────────────────────

function FloatingParticle({
  index,
  width,
  height,
  phase,
}: {
  index: number;
  width: number;
  height: number;
  phase: SharedValue<number>;
}) {
  const emoji = FLOATING_EMOJIS[index % FLOATING_EMOJIS.length];
  // "Aleatorio" determinista por índice (LCG-ish — basta para distribuir).
  const baseX = ((index * 173) % 100) / 100;
  const baseY = ((index * 271) % 100) / 100;
  const ampX = 40 + ((index * 11) % 60);
  const ampY = 30 + ((index * 13) % 70);
  const speedX = 0.6 + ((index * 7) % 9) / 18;
  const speedY = 0.7 + ((index * 5) % 11) / 22;
  const rotSpeed = 30 + ((index * 17) % 60);
  const size = 22 + ((index * 3) % 18);

  const animatedStyle = useAnimatedStyle(() => {
    const t = phase.value;
    const x = baseX * width + Math.sin(t * speedX + index) * ampX;
    const y = baseY * height + Math.cos(t * speedY + index) * ampY;
    const rot = (t * rotSpeed + index * 50) % 360;
    const scale = 0.85 + Math.sin(t * 1.4 + index) * 0.18;
    return {
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${rot}deg` },
        { scale },
      ],
    };
  });

  return (
    <Animated.Text
      style={[styles.particle, { fontSize: size }, animatedStyle]}
      allowFontScaling={false}
    >
      {emoji}
    </Animated.Text>
  );
}

// ─── Burst de confeti (explosión) ───────────────────────────────────────────

const BURST_PARTICLES = 26;

function ConfettiBurst({
  centerX,
  centerY,
  variant,
}: {
  centerX: number;
  centerY: number;
  variant: 'explode' | 'puff';
}) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: BURST_PARTICLES }).map((_, i) => (
        <ConfettiPiece
          key={i}
          index={i}
          centerX={centerX}
          centerY={centerY}
          variant={variant}
        />
      ))}
    </View>
  );
}

function ConfettiPiece({
  index,
  centerX,
  centerY,
  variant,
}: {
  index: number;
  centerX: number;
  centerY: number;
  variant: 'explode' | 'puff';
}) {
  const angle = (index / BURST_PARTICLES) * Math.PI * 2 + (index % 2) * 0.3;
  const distance = variant === 'explode' ? 180 + (index % 5) * 40 : -60;
  const targetX = Math.cos(angle) * distance;
  const targetY = Math.sin(angle) * distance;
  const duration = variant === 'explode' ? 900 + (index % 4) * 120 : 600;

  const t = useSharedValue(0);
  const rot = useSharedValue(0);
  const emoji =
    variant === 'explode'
      ? ['🎉', '✨', '🎊', '⭐', '💫', '🌟'][index % 6]
      : ['💨', '·', '•'][index % 3];

  useEffect(() => {
    t.value = withTiming(1, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
    rot.value = withTiming(360 * (1 + (index % 3)), { duration });
  }, [t, rot, duration, index]);

  const style = useAnimatedStyle(() => {
    const tx = targetX * t.value;
    const ty =
      targetY * t.value + (variant === 'explode' ? t.value * t.value * 80 : 0); // gravedad leve
    const opacity = variant === 'explode' ? 1 - t.value * 0.9 : 1 - t.value;
    const scale = variant === 'explode' ? 1 - t.value * 0.3 : 0.4 + t.value;
    return {
      opacity,
      transform: [
        { translateX: centerX + tx },
        { translateY: centerY + ty },
        { rotate: `${rot.value}deg` },
        { scale },
      ],
    };
  });

  return (
    <Animated.Text style={[styles.confetti, style]} allowFontScaling={false}>
      {emoji}
    </Animated.Text>
  );
}

// ─── Lever / palanca gigante ────────────────────────────────────────────────

const LEVER_WIDTH = 280;
const LEVER_HEIGHT = 88;
const KNOB = 76;

function GiantLever({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  const t = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    t.value = withSpring(active ? 1 : 0, { damping: 12, stiffness: 110 });
  }, [active, t]);

  const knobStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: t.value * (LEVER_WIDTH - KNOB - 12) + 6 },
      { rotate: `${interpolate(t.value, [0, 1], [-12, 12])}deg` },
      { scale: 1 + Math.abs(t.value - 0.5) * 0.05 },
    ],
  }));
  const trackOnStyle = useAnimatedStyle(() => ({ opacity: t.value }));

  return (
    <Pressable
      onPress={onToggle}
      style={styles.leverContainer}
      accessibilityRole="switch"
      accessibilityState={{ checked: active }}
      accessibilityLabel="Activar modo laboratorio (canal preview)"
    >
      <View style={styles.leverTrackBase}>
        <Animated.View style={[styles.leverTrackOn, trackOnStyle]}>
          <LinearGradient
            colors={['#43E97B', '#FCD200', '#FE6B8B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <View style={styles.leverLabels} pointerEvents="none">
          <Text style={styles.leverLabel}>MUNDANO</Text>
          <Text style={styles.leverLabel}>ALPHA</Text>
        </View>
        <Animated.View style={[styles.leverKnob, knobStyle]}>
          <Text style={styles.leverKnobIcon} allowFontScaling={false}>
            {active ? '🧪' : '😴'}
          </Text>
        </Animated.View>
      </View>
    </Pressable>
  );
}

// ─── Título con wobble ──────────────────────────────────────────────────────

function WobblingTitle({ children }: { children: React.ReactNode }) {
  const wobble = useSharedValue(0);
  useEffect(() => {
    wobble.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 520, easing: Easing.inOut(Easing.quad) }),
        withTiming(-1, { duration: 520, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
    return () => cancelAnimation(wobble);
  }, [wobble]);
  const style = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${wobble.value * 2.5}deg` },
      { scale: 1 + Math.abs(wobble.value) * 0.04 },
    ],
  }));
  return (
    <Animated.Text style={[styles.title, style]}>{children}</Animated.Text>
  );
}

// ─── Pulsing sparkles around title ──────────────────────────────────────────

function Sparkles() {
  const o0 = useSharedValue(0.4);
  const o1 = useSharedValue(0.4);
  const o2 = useSharedValue(0.4);
  const o3 = useSharedValue(0.4);
  useEffect(() => {
    const seq = () =>
      withRepeat(
        withSequence(
          withTiming(1, { duration: 460 }),
          withTiming(0.2, { duration: 460 }),
        ),
        -1,
        true,
      );
    o0.value = withDelay(0, seq());
    o1.value = withDelay(220, seq());
    o2.value = withDelay(440, seq());
    o3.value = withDelay(660, seq());
    return () => {
      cancelAnimation(o0);
      cancelAnimation(o1);
      cancelAnimation(o2);
      cancelAnimation(o3);
    };
  }, [o0, o1, o2, o3]);
  const a0 = useAnimatedStyle(() => ({ opacity: o0.value }));
  const a1 = useAnimatedStyle(() => ({ opacity: o1.value }));
  const a2 = useAnimatedStyle(() => ({ opacity: o2.value }));
  const a3 = useAnimatedStyle(() => ({ opacity: o3.value }));
  return (
    <View style={styles.sparklesRow} pointerEvents="none">
      <Animated.Text style={[styles.sparkle, a0]}>✦</Animated.Text>
      <Animated.Text style={[styles.sparkle, a1]}>✧</Animated.Text>
      <Animated.Text style={[styles.sparkle, a2]}>✦</Animated.Text>
      <Animated.Text style={[styles.sparkle, a3]}>✧</Animated.Text>
    </View>
  );
}

// ─── Ticker de frases rotativas ─────────────────────────────────────────────

function RotatingPhrases() {
  const [idx, setIdx] = useState(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    const id = setInterval(() => {
      opacity.value = withSequence(
        withTiming(0, { duration: 350 }),
        withTiming(1, { duration: 450 }),
      );
      setTimeout(() => {
        setIdx((p) => (p + 1) % FUN_PHRASES.length);
      }, 360);
    }, 4200);
    return () => clearInterval(id);
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.Text style={[styles.phrase, style]} numberOfLines={2}>
      {FUN_PHRASES[idx]}
    </Animated.Text>
  );
}

// ─── Modal principal ────────────────────────────────────────────────────────

export function PreviewChannelModal() {
  const { isSecretMenuOpen, closeSecretMenu, enabled, setEnabled } =
    usePreviewChannel();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const phase = useSharedValue(0);
  const [burstKey, setBurstKey] = useState<number | null>(null);
  const [burstVariant, setBurstVariant] = useState<'explode' | 'puff'>(
    'explode',
  );

  // Bucle global de partículas — un solo shared value para todas.
  useEffect(() => {
    if (!isSecretMenuOpen) {
      phase.value = 0;
      return;
    }
    phase.value = withRepeat(
      withTiming(Math.PI * 2, { duration: 14000, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(phase);
  }, [isSecretMenuOpen, phase]);

  const handleToggle = useCallback(async () => {
    const next = !enabled;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(
        next
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      ).catch(() => {});
    }
    setBurstVariant(next ? 'explode' : 'puff');
    setBurstKey(Date.now());
    await setEnabled(next);
  }, [enabled, setEnabled]);

  const handleClose = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    closeSecretMenu();
  }, [closeSecretMenu]);

  const particles = useMemo(
    () =>
      Array.from({ length: 14 }).map((_, i) => (
        <FloatingParticle
          key={i}
          index={i}
          width={width}
          height={height}
          phase={phase}
        />
      )),
    [width, height, phase],
  );

  return (
    <Modal
      visible={isSecretMenuOpen}
      onRequestClose={handleClose}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <AnimatedGradients />
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {particles}
        </View>
        {/* Capa oscura sutil para que el texto sea legible */}
        <View style={styles.scrim} pointerEvents="none" />

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + 24,
              paddingBottom: insets.bottom + 32,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.headerBlock}>
            <Sparkles />
            <WobblingTitle>🧪 LABORATORIO ALPHA 🧪</WobblingTitle>
            <Text style={styles.subtitle}>
              Has descubierto el portal a las novedades del futuro
            </Text>
            <Text style={styles.eyebrow}>· · · modo ultrasecreto · · ·</Text>
          </View>

          {/* Estado actual + lever */}
          <View style={styles.statusBlock}>
            <Text style={styles.statusEyebrow}>tu nivel de aventura</Text>
            <Text style={styles.statusValue} allowFontScaling={false}>
              {enabled ? '⚡  ZONA ALPHA  ⚡' : '☁️  Mundano  ☁️'}
            </Text>
            <GiantLever active={enabled} onToggle={handleToggle} />
            <RotatingPhrases />
          </View>

          {/* Pergamino: el pacto */}
          <View style={styles.scrollCard}>
            <Text style={styles.scrollTitle}>🔮 EL PACTO DEL PROBADOR</Text>
            <Text style={styles.scrollBody}>
              Al activar este modo, tu dispositivo se suscribirá al canal{' '}
              <Text style={styles.scrollMono}>preview</Text> de EAS Update.
            </Text>
            <Text style={styles.scrollBody}>
              Recibirás antes que nadie las novedades que el equipo publica en
              la rama <Text style={styles.scrollMono}>preview</Text> del
              proyecto. Cosas que aún no están en App Store ni Google Play.
              Cosas que pueden fallar. Cosas brillantes y nuevas.
            </Text>
            <Text style={styles.scrollBody}>
              Cuando lo desactives, en el próximo arranque volverás al canal{' '}
              <Text style={styles.scrollMono}>production</Text>, como el resto
              del mundo.
            </Text>
            <Text style={styles.scrollFootnote}>
              Funciona en versiones instaladas desde la store. Si algo se rompe,
              cierra y vuelve a abrir la app, o desactiva este modo.
            </Text>
          </View>

          {/* Cierre */}
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && { transform: [{ scale: 0.96 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Cerrar laboratorio"
          >
            <Text style={styles.closeButtonText}>
              {enabled ? '✦  cerrar y disfrutar  ✦' : '↩  volver al mundo gris'}
            </Text>
          </Pressable>
        </ScrollView>

        {/* Burst de confeti — montado bajo demanda, se desmonta solo */}
        {burstKey !== null && (
          <ConfettiBurst
            key={burstKey}
            centerX={width / 2 - 14}
            centerY={height / 2 - 14}
            variant={burstVariant}
          />
        )}
      </View>
    </Modal>
  );
}

// ─── Estilos ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1A1230',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  scrollContent: {
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 28,
  },
  particle: {
    position: 'absolute',
    top: 0,
    left: 0,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 2 },
  },
  confetti: {
    position: 'absolute',
    top: 0,
    left: 0,
    fontSize: 26,
  },

  // Header
  headerBlock: {
    alignItems: 'center',
    gap: 8,
  },
  sparklesRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 4,
  },
  sparkle: {
    color: '#FFF',
    fontSize: 22,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowRadius: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 4 },
  },
  subtitle: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 30,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowRadius: 6,
  },
  eyebrow: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 8,
  },

  // Estado + lever
  statusBlock: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    width: '100%',
    maxWidth: 420,
    ...Platform.select({
      web: { boxShadow: '0 12px 36px rgba(0,0,0,0.35)' } as any,
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowOffset: { width: 0, height: 12 },
        shadowRadius: 22,
        elevation: 12,
      },
    }),
  },
  statusEyebrow: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  statusValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.2,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 3 },
  },
  phrase: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 13,
    fontWeight: '600',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 6,
    minHeight: 36,
  },

  // Lever
  leverContainer: {
    width: LEVER_WIDTH,
    alignItems: 'center',
  },
  leverTrackBase: {
    width: LEVER_WIDTH,
    height: LEVER_HEIGHT,
    borderRadius: LEVER_HEIGHT / 2,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  leverTrackOn: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: LEVER_HEIGHT / 2,
    overflow: 'hidden',
  },
  leverLabels: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  leverLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.6,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowRadius: 4,
  },
  leverKnob: {
    position: 'absolute',
    top: (LEVER_HEIGHT - KNOB) / 2,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(0,0,0,0.18)',
    ...Platform.select({
      web: { boxShadow: '0 6px 14px rgba(0,0,0,0.45)' } as any,
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.45,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 10,
        elevation: 10,
      },
    }),
  },
  leverKnobIcon: {
    fontSize: 36,
  },

  // Pergamino
  scrollCard: {
    width: '100%',
    maxWidth: 460,
    padding: 22,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 248, 220, 0.94)',
    borderWidth: 2,
    borderColor: 'rgba(120, 80, 30, 0.45)',
    gap: 12,
    ...Platform.select({
      web: { boxShadow: '0 14px 36px rgba(0,0,0,0.35)' } as any,
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowOffset: { width: 0, height: 12 },
        shadowRadius: 20,
        elevation: 12,
      },
    }),
  },
  scrollTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#3D2A0E',
    letterSpacing: 0.4,
    textAlign: 'center',
    marginBottom: 4,
  },
  scrollBody: {
    color: '#3D2A0E',
    fontSize: 14,
    lineHeight: 21,
  },
  scrollMono: {
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
    fontWeight: '700',
    backgroundColor: 'rgba(61, 42, 14, 0.10)',
    color: '#3D2A0E',
  },
  scrollFootnote: {
    color: 'rgba(61, 42, 14, 0.75)',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
    lineHeight: 17,
  },

  // Cerrar
  closeButton: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
    marginTop: 4,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
});
