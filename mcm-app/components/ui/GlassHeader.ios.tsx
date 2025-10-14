import React from 'react';
import { StyleSheet } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { BlurView } from 'expo-blur';

interface GlassHeaderProps {
  tintColor?: string;
}

export default function GlassHeader({ tintColor }: GlassHeaderProps) {
  const glassAvailable = isLiquidGlassAvailable();

  if (glassAvailable) {
    return (
      <GlassView
        glassEffectStyle="regular"
        tintColor={tintColor}
        style={StyleSheet.absoluteFill}
      />
    );
  }

  // Fallback para iOS < 18
  return (
    <BlurView
      tint="light"
      intensity={90}
      style={[
        StyleSheet.absoluteFill,
        tintColor && { backgroundColor: tintColor + 'CC' }, // Añadir alpha para transparencia
      ]}
    />
  );
}
