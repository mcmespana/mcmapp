import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { radii } from '@/constants/uiStyles';
import { useThemeColor } from '@/hooks/useThemeColor';
import { hexAlpha } from '@/utils/colorUtils';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

interface EmptyStateProps {
  /** Material icon name shown above the title. */
  icon?: MaterialIconName;
  /** Optional emoji to use instead of an icon. */
  emoji?: string;
  /** Bold heading. */
  title: string;
  /** Optional explanatory subtitle (1–2 lines). */
  subtitle?: string;
  /** Optional call-to-action label + handler. */
  actionLabel?: string;
  onAction?: () => void;
  /** Accent color for icon and CTA. Defaults to muted text. */
  accentColor?: string;
}

/**
 * Canonical empty-state for lists / sections with no data.
 * Used in Calendar (no events), Photos (no albums), Reflexiones (no entries),
 * SelectedSongs (no playlist), etc.
 */
export default function EmptyState({
  icon,
  emoji,
  title,
  subtitle,
  actionLabel,
  onAction,
  accentColor,
}: EmptyStateProps) {
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'icon');
  const tone = accentColor ?? mutedColor;

  return (
    <View style={styles.root}>
      {emoji ? (
        <Text style={styles.emoji}>{emoji}</Text>
      ) : icon ? (
        <View
          style={[styles.iconWrap, { backgroundColor: hexAlpha(tone, '1A') }]}
        >
          <MaterialIcons name={icon} size={32} color={tone} />
        </View>
      ) : null}
      <Text style={[styles.title, { color: textColor }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: mutedColor }]}>{subtitle}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onAction}
          style={[styles.cta, { backgroundColor: hexAlpha(tone, '17') }]}
        >
          <Text style={[styles.ctaText, { color: tone }]}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 8,
  },
  emoji: { fontSize: 48, marginBottom: 4 },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 2,
    maxWidth: 320,
  },
  cta: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radii.pill,
  },
  ctaText: { fontSize: 14, fontWeight: '700' },
});
