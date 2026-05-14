import React from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { MaterialIcons } from '@expo/vector-icons';
import { radii, shadows } from '@/constants/uiStyles';

interface GlassFABProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  /** Background color of the FAB. Defaults to MCM yellow. */
  tintColor?: string;
  /** Icon color. Defaults to near-black. */
  iconColor?: string;
  /** Icon size. Defaults to 24. */
  size?: number;
  style?: ViewStyle;
}

/**
 * Android / Web fallback for GlassFAB.
 * Renders a solid tinted FAB with a prominent shadow — no blur effect
 * (Android RN has no reliable cheap blur primitive; web could use
 * backdrop-filter but solid FABs match Material more closely).
 *
 * The iOS variant (GlassFAB.ios.tsx) uses real LiquidGlass / BlurView.
 */
export default function GlassFAB({
  icon,
  onPress,
  tintColor = '#f4c11e',
  iconColor = '#222',
  size = 24,
  style,
}: GlassFABProps) {
  return (
    <PressableFeedback
      onPress={onPress}
      style={[styles.fab, { backgroundColor: tintColor }, style]}
    >
      <PressableFeedback.Scale />
      <MaterialIcons name={icon} size={size} color={iconColor} />
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
    ...((Platform.OS === 'android' || Platform.OS === 'web'
      ? shadows.lg
      : null) as ViewStyle),
  },
});
