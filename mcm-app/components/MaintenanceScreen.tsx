import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@/components/ui/icons';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import brand, { Colors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import { radii } from '@/constants/uiStyles';
import { useColorScheme } from '@/hooks/useColorScheme';

interface Props {
  message?: string;
}

/**
 * Bloqueo por MANTENIMIENTO (`maintenanceMode` del panel). La pantalla de
 * «hay que actualizar» (versión mínima) vive en `UpdateRequiredScreen`.
 */
export default function MaintenanceScreen({ message }: Props) {
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];

  const title = 'Volvemos enseguida';
  const body =
    message || 'Estamos haciendo mantenimiento. Inténtalo en unos minutos.';

  // Entrada del icono + halo pulsante.
  const scale = useSharedValue(0.9);
  const halo = useSharedValue(0);
  const bounce = useSharedValue(0);

  useEffect(() => {
    scale.set(withSpring(1, { stiffness: 140, damping: 12, mass: 1 }));
    halo.set(
      withRepeat(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    );
    bounce.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
    return () => {
      cancelAnimation(halo);
      cancelAnimation(bounce);
    };
  }, [scale, halo, bounce]);

  const iconWrapStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.get() },
      { translateY: interpolate(bounce.get(), [0, 1], [0, -6]) },
    ],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(halo.get(), [0, 1], [0.3, 0.65]),
    transform: [{ scale: interpolate(halo.get(), [0, 1], [0.9, 1.15]) }],
  }));

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
            <MaterialIcons name="build" size={38} color="#fff" />
          </Animated.View>
        </View>

        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.body, { color: theme.icon }]}>{body}</Text>
      </View>
    </SafeAreaView>
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
    borderRadius: radii.pillFull,
    backgroundColor: brand.secondary,
  } as ViewStyle,
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: radii.pillFull,
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
});
