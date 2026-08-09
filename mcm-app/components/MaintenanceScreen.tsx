import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Button } from 'heroui-native';
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
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import brand, { Colors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import { radii } from '@/constants/uiStyles';
import { useColorScheme } from '@/hooks/useColorScheme';
import { h } from '@/utils/haptics';
import { openAppStore } from '@/utils/storeLinks';

interface Props {
  mode: 'maintenance' | 'update';
  message?: string;
  minVersion?: string;
  currentVersion?: string;
  /** Solo aplica a `mode="update"`: deja pasar sin actualizar esta vez. */
  onSkip?: () => void;
}

const SKIP_REVEAL_DELAY_MS = 500;
const FLYING_EMOJIS = ['🫣', '🫠', '🙄'];

export default function MaintenanceScreen({
  mode,
  message,
  minVersion,
  currentVersion,
  onSkip,
}: Props) {
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];

  const isUpdate = mode === 'update';
  const title = isUpdate ? '¡Toca actualizar!' : 'Volvemos enseguida';
  const body =
    message ||
    (isUpdate
      ? `Tu versión (${currentVersion ?? '?'}) se quedó antigua. Actualiza a la ${minVersion ?? 'última'} en un par de toques y sigues a lo tuyo.`
      : 'Estamos haciendo mantenimiento. Inténtalo en unos minutos.');
  const iconName = isUpdate ? 'system-update' : 'build';

  const [showSkip, setShowSkip] = useState(false);

  useEffect(() => {
    if (!isUpdate || !onSkip) return;
    const timer = setTimeout(() => setShowSkip(true), SKIP_REVEAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isUpdate, onSkip]);

  // Entrada del icono + halo pulsante — mismo lenguaje visual que OTAUpdatePrompt.
  const scale = useSharedValue(0.9);
  const halo = useSharedValue(0);
  const bounce = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { stiffness: 140, damping: 12, mass: 1 });
    halo.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    bounce.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(halo);
      cancelAnimation(bounce);
    };
  }, [scale, halo, bounce]);

  const iconWrapStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: interpolate(bounce.value, [0, 1], [0, -6]) },
    ],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(halo.value, [0, 1], [0.3, 0.65]),
    transform: [{ scale: interpolate(halo.value, [0, 1], [0.9, 1.15]) }],
  }));

  const handleGoToStore = () => {
    h.tap();
    openAppStore();
  };

  const handleSkip = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {
      // Sin haptics — ignorar.
    }
    onSkip?.();
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top', 'bottom']}
    >
      <View style={styles.content}>
        <View style={styles.hero}>
          <Animated.View style={[styles.heroHalo, haloStyle]} />
          <Animated.View
            style={[
              styles.iconCircle,
              { backgroundColor: brand.primary },
              iconWrapStyle,
            ]}
          >
            <MaterialIcons name={iconName} size={38} color="#fff" />
          </Animated.View>
        </View>

        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.body, { color: theme.icon }]}>{body}</Text>

        {isUpdate && (
          <>
            <Button
              variant="primary"
              onPress={handleGoToStore}
              style={styles.button}
            >
              <MaterialIcons name="rocket-launch" size={18} color="#FFFFFF" />
              <Button.Label>Ir a la tienda ya</Button.Label>
            </Button>

            {onSkip && <SkipEscape visible={showSkip} onSkip={handleSkip} />}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

/**
 * Segunda oportunidad, medio en broma: aparece a los 500ms con emojis
 * revoloteando para que el "voy pa'dentro" pese menos que darle a actualizar.
 */
function SkipEscape({
  visible,
  onSkip,
}: {
  visible: boolean;
  onSkip: () => void;
}) {
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];
  const subtleText = scheme === 'dark' ? '#B5B7BD' : '#5B6168';

  const reveal = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      reveal.value = withSpring(1, { stiffness: 160, damping: 14 });
    }
  }, [visible, reveal]);

  const revealStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [
      { translateY: interpolate(reveal.value, [0, 1], [10, 0]) },
      { scale: interpolate(reveal.value, [0, 1], [0.96, 1]) },
    ],
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.skipWrap, revealStyle]}>
      <View style={styles.emojiRow}>
        {FLYING_EMOJIS.map((emoji, i) => (
          <FlyingEmoji key={emoji} emoji={emoji} index={i} />
        ))}
      </View>

      <Text style={[styles.skipTaunt, { color: subtleText }]}>
        Veeenga va, te dejo pasar sin actualizar esta vez…
      </Text>

      <Text
        onPress={onSkip}
        accessibilityRole="button"
        accessibilityLabel="Entrar sin actualizar"
        style={[styles.skipButton, { color: theme.text }]}
      >
        Voy pa&apos;dentro 🚪
      </Text>
    </Animated.View>
  );
}

function FlyingEmoji({ emoji, index }: { emoji: string; index: number }) {
  const drift = useSharedValue(0);
  const spin = useSharedValue(0);

  useEffect(() => {
    drift.value = withDelay(
      index * 180,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: 1100 + index * 150,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(0, {
            duration: 1100 + index * 150,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
        false,
      ),
    );
    spin.value = withDelay(
      index * 180,
      withRepeat(
        withTiming(1, { duration: 2600, easing: Easing.linear }),
        -1,
        false,
      ),
    );
    return () => {
      cancelAnimation(drift);
      cancelAnimation(spin);
    };
  }, [drift, spin, index]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(drift.value, [0, 1], [0, -10]) },
      {
        translateX: interpolate(
          drift.value,
          [0, 1],
          [0, index % 2 === 0 ? 6 : -6],
        ),
      },
      {
        rotate: `${interpolate(spin.value, [0, 1], [0, index % 2 === 0 ? 18 : -18])}deg`,
      },
    ],
  }));

  return (
    <Animated.Text style={[styles.flyingEmoji, style]}>{emoji}</Animated.Text>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 } as ViewStyle,
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  } as ViewStyle,
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 110,
    marginBottom: spacing.sm,
  } as ViewStyle,
  heroHalo: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: brand.secondary,
  } as ViewStyle,
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  title: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.4,
  } as TextStyle,
  body: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.85,
    maxWidth: 340,
  } as TextStyle,
  button: {
    marginTop: spacing.lg,
    minWidth: 240,
  } as ViewStyle,
  skipWrap: {
    marginTop: spacing.lg,
    alignItems: 'center',
  } as ViewStyle,
  emojiRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xs,
  } as ViewStyle,
  flyingEmoji: {
    fontSize: 26,
  } as TextStyle,
  skipTaunt: {
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: spacing.xs,
  } as TextStyle,
  skipButton: {
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
  } as TextStyle,
});
