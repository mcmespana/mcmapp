import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface TopColorBarProps {
  color?: string;
}

export default function TopColorBar({ color }: TopColorBarProps) {
  const insets = useSafeAreaInsets();

  if (!color) return null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: color,
          paddingTop: insets.top,
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
    height: 4,
    zIndex: 1000,
  },
});
