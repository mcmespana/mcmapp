import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { radii } from '@/constants/uiStyles';
import { useThemeColor } from '@/hooks/useThemeColor';

interface StatCardProps {
  /** Emoji or short icon string (1–2 chars). For real icons use the `iconNode` prop. */
  icon?: string;
  /** Custom icon node (e.g. <MaterialIcons />). Takes precedence over `icon`. */
  iconNode?: React.ReactNode;
  /** Main value: number or short string. */
  value: string | number;
  /** Lowercase/uppercase label below the value. */
  label: string;
  /** Overrides the value color. Defaults to theme text. */
  accentColor?: string;
  /** Overrides the card background. Defaults to theme card color. */
  backgroundColor?: string;
  /** Overrides the border color. */
  borderColor?: string;
}

/**
 * Compact stat tile: icon · big value · uppercase label.
 * Extracted from `components/contigo/HomeWidgets.tsx` (StatCard).
 *
 * Pass `accentColor` to colour the number — useful for thematic tabs.
 */
export default function StatCard({
  icon,
  iconNode,
  value,
  label,
  accentColor,
  backgroundColor,
  borderColor,
}: StatCardProps) {
  const cardBg = useThemeColor({}, 'card');
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'icon');

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: backgroundColor ?? cardBg,
          borderColor: borderColor ?? 'rgba(0,0,0,0.06)',
        },
      ]}
    >
      {iconNode ?? (icon ? <Text style={styles.icon}>{icon}</Text> : null)}
      <Text
        style={[styles.value, { color: accentColor ?? textColor }]}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text style={[styles.label, { color: mutedColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radii.pill,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 1 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' as any },
    }),
  },
  icon: { fontSize: 20, marginBottom: 3 },
  value: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
    textAlign: 'center',
    textTransform: 'uppercase',
    lineHeight: 13,
  },
});
