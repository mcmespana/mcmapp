import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import typography from '@/constants/typography';
import { useThemeColor } from '@/hooks/useThemeColor';

interface ScreenHeroProps {
  /** Big screen title (e.g. "Contigo", "Materiales", "Reflexiones"). */
  title: string;
  /** Optional secondary line under the title. */
  subtitle?: string;
  /** Accent color used for the optional kicker / right-side accents. */
  accentColor?: string;
  /** Optional uppercase kicker shown above the title. */
  kicker?: string;
  /** Optional element rendered to the right of the title (e.g. icons, badges). */
  right?: React.ReactNode;
  /** Extra style for the wrapper. */
  style?: ViewStyle;
}

/**
 * Standard in-page hero: big title (h0) + optional subtitle + optional kicker
 * and right slot.
 *
 * Inspired by the header pattern in `app/(tabs)/contigo/index.tsx:284-307`.
 * Use this in every internal screen so the "screen entry" feels consistent
 * across the app (JubileoHome, MasHome, Reflexiones, Apps, Wordle…).
 */
export default function ScreenHero({
  title,
  subtitle,
  accentColor,
  kicker,
  right,
  style,
}: ScreenHeroProps) {
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'icon');
  const kickerColor = accentColor ?? mutedColor;

  return (
    <View style={[styles.row, style]}>
      <View style={styles.titleCol}>
        {kicker ? (
          <Text style={[typography.overline, { color: kickerColor }]}>
            {kicker}
          </Text>
        ) : null}
        <Text
          style={[typography.h0, styles.title, { color: textColor }]}
          numberOfLines={2}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: mutedColor }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 6,
  },
  titleCol: { flex: 1 },
  title: { lineHeight: 38 },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
});
