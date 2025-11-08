import React from 'react';
import { StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { BlurView } from 'expo-blur';
import { MaterialIcons } from '@expo/vector-icons';

interface GlassFABProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  tintColor?: string;
  iconColor?: string;
  size?: number;
  style?: any;
}

export default function GlassFAB({
  icon,
  onPress,
  tintColor = '#f4c11e',
  iconColor = '#222',
  size = 24,
  style,
}: GlassFABProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.fab, style]}
      activeOpacity={0.8}
    >
      <BlurView
        tint="light"
        intensity={80}
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: tintColor + 'CC' }, // Semi-transparente con el color
        ]}
      />
      <MaterialIcons name={icon} size={size} color={iconColor} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 90, // Más arriba para que no quede detrás del tab bar (tab bar tiene ~85px de alto con safe area)
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000, // Asegurar que esté por encima de todo
  },
});
