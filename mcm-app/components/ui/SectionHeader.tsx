import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import typography from '@/constants/typography';
import { useThemeColor } from '@/hooks/useThemeColor';

interface SectionHeaderProps {
  /** Section label — typically uppercase. */
  label: string;
  /** Optional action label on the right (e.g. "Ver todo"). */
  actionLabel?: string;
  /** Tap handler for the action label. */
  onAction?: () => void;
  /** Accent color for the label and action. Defaults to muted text. */
  accentColor?: string;
  style?: ViewStyle;
}

/**
 * Section header used above grouped content inside a screen.
 * Pairs nicely with `ScreenHero` (big title) followed by 1..N
 * `SectionHeader` + content blocks.
 */
export default function SectionHeader({
  label,
  actionLabel,
  onAction,
  accentColor,
  style,
}: SectionHeaderProps) {
  const mutedColor = useThemeColor({}, 'icon');
  const labelColor = accentColor ?? mutedColor;

  return (
    <View style={[styles.row, style]}>
      <Text style={[typography.overline, { color: labelColor }]}>{label}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity activeOpacity={0.7} onPress={onAction}>
          <Text style={[styles.action, { color: labelColor }]}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
    marginTop: 12,
  },
  action: { fontSize: 12, fontWeight: '700' },
});
