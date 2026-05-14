import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface TopColorBarProps {
  /** Color of the bar. If undefined the component renders nothing. */
  color?: string;
  /** Bar height in px. Defaults to 4 (matches iOS visual weight). */
  height?: number;
}

/**
 * Thin color bar pinned to the very top of the screen, under the status bar.
 * Reinforces the tab's identity color in Android/Web (iOS has its own variant
 * in TopColorBar.ios.tsx that pushes content down with safe-area padding).
 *
 * On native Android the safe-area top is small and the bar sits below the
 * status bar; on web it sits at the very top (no inset needed).
 */
export default function TopColorBar({ color, height = 4 }: TopColorBarProps) {
  const insets = useSafeAreaInsets();
  if (!color) return null;
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: color,
          height: height + (Platform.OS === 'android' ? insets.top : 0),
          paddingTop: Platform.OS === 'android' ? insets.top : 0,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
});
