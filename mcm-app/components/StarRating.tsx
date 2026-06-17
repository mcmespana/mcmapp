import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { h } from '@/utils/haptics';
import colors from '@/constants/colors';

interface StarRatingProps {
  /** Valoración actual (0..max). */
  value: number;
  onChange: (value: number) => void;
  /** Número de estrellas. Por defecto 5. */
  max?: number;
  /** Tamaño de cada estrella. Por defecto 36. */
  size?: number;
  /** Color de las estrellas marcadas. */
  color?: string;
  /** Color de las estrellas vacías. */
  inactiveColor?: string;
  style?: ViewStyle;
}

/**
 * Selector de valoración por estrellas (0..max). Tocar una estrella la marca
 * junto con las anteriores; tocar la última marcada la desmarca (toggle), para
 * poder volver a 0. Con háptica suave en cada cambio.
 */
export default function StarRating({
  value,
  onChange,
  max = 5,
  size = 36,
  color = colors.warning,
  inactiveColor = 'rgba(140,140,140,0.35)',
  style,
}: StarRatingProps) {
  return (
    <View
      style={[styles.row, style]}
      accessibilityRole="adjustable"
      accessibilityValue={{ min: 0, max, now: value }}
    >
      {Array.from({ length: max }).map((_, i) => {
        const idx = i + 1;
        const filled = idx <= value;
        return (
          <Pressable
            key={idx}
            hitSlop={6}
            onPress={() => {
              h.select();
              onChange(value === idx ? idx - 1 : idx);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${idx} de ${max} estrellas`}
          >
            <MaterialIcons
              name={filled ? 'star' : 'star-border'}
              size={size}
              color={filled ? color : inactiveColor}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
});
