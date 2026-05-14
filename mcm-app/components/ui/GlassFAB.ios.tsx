import React from 'react';
import { StyleSheet, Text, ViewStyle } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { MaterialIcons } from '@expo/vector-icons';
import { radii, shadows } from '@/constants/uiStyles';
import GlassSurface from './GlassSurface';

interface GlassFABProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  tintColor?: string;
  iconColor?: string;
  size?: number;
  /** Optional label rendered next to the icon. Turns the FAB into a pill. */
  label?: string;
  style?: ViewStyle;
}

/**
 * iOS-only glass FAB. Delegates the glass effect to GlassSurface so the
 * brightness / LiquidGlass-vs-BlurView decision lives in one place.
 */
export default function GlassFAB({
  icon,
  onPress,
  tintColor = '#f4c11e',
  iconColor = '#222',
  size = 24,
  label,
  style,
}: GlassFABProps) {
  const isPill = !!label;
  return (
    <PressableFeedback
      onPress={onPress}
      style={[styles.fab, isPill && styles.pill, style]}
    >
      <PressableFeedback.Scale />
      <GlassSurface tintColor={tintColor} variant="regular" />
      <MaterialIcons name={icon} size={size} color={iconColor} />
      {label ? (
        <Text style={[styles.label, { color: iconColor }]}>{label}</Text>
      ) : null}
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 90,
    width: 56,
    height: 56,
    borderRadius: radii.full,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    zIndex: 1000,
    ...(shadows.lg as ViewStyle),
  },
  pill: {
    width: undefined,
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 6,
  },
  label: { fontSize: 13, fontWeight: '700' },
});
