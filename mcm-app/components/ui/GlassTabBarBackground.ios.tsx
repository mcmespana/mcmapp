import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';

export default function GlassTabBarBackground() {
  // Verificar si LiquidGlass está disponible (iOS 18+)
  const glassAvailable = isLiquidGlassAvailable();

  if (glassAvailable) {
    return (
      <GlassView
        glassEffectStyle="clear"
        style={StyleSheet.absoluteFill}
      />
    );
  }

  // Fallback para iOS < 18
  return (
    <BlurView
      tint="systemChromeMaterial"
      intensity={100}
      style={StyleSheet.absoluteFill}
    />
  );
}

export function useBottomTabOverflow() {
  return useBottomTabBarHeight();
}
