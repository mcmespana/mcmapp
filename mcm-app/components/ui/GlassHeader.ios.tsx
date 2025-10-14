import React from 'react';
import { StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

interface GlassHeaderProps {
  tintColor?: string;
}

export default function GlassHeader({ tintColor }: GlassHeaderProps) {
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
