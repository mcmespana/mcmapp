import React from 'react';
import { StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
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
  /**
   * Optional element rendered to the LEFT of the title block (e.g. logo,
   * back button, avatar). When present the row centres vertically so the
   * left block sits next to the title.
   */
  left?: React.ReactNode;
  /** Optional element rendered to the right of the title (e.g. icons, badges). */
  right?: React.ReactNode;
  /**
   * Compact mode: title uses `typography.h2` instead of `typography.h0`.
   * Good for app-bar-style headers (e.g. Home) where the title sits next
   * to a logo/avatar and h0 would be visually overwhelming.
   */
  compact?: boolean;
  /** Override the title style (font size, weight, letterSpacing). */
  titleStyle?: TextStyle;
  /** Extra style for the wrapper. */
  style?: ViewStyle;
}

/**
 * Standard in-page hero: optional left slot + (kicker + title + subtitle) + optional right slot.
 *
 * Inspired by the header pattern in `app/(tabs)/contigo/index.tsx:284-307`.
 * Use this in every internal screen so the "screen entry" feels consistent
 * across the app (JubileoHome, MasHome, Reflexiones, Apps, Wordle…).
 *
 * With `left` + `compact`, this also doubles as the top app-bar pattern for
 * Home: logo on the left, "MCM App" centred, action icons on the right.
 */
export default function ScreenHero({
  title,
  subtitle,
  accentColor,
  kicker,
  left,
  right,
  compact = false,
  titleStyle,
  style,
}: ScreenHeroProps) {
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'icon');
  const kickerColor = accentColor ?? mutedColor;
  const hasLeftOrRight = !!left || !!right;
  const baseTitleStyle = compact ? typography.h2 : typography.h0;

  return (
    <View style={[styles.row, hasLeftOrRight && styles.rowCenter, style]}>
      {left ? <View style={styles.left}>{left}</View> : null}
      <View style={styles.titleCol}>
        {kicker ? (
          <Text style={[typography.overline, { color: kickerColor }]}>
            {kicker}
          </Text>
        ) : null}
        <Text
          style={[
            baseTitleStyle,
            !compact && styles.title,
            { color: textColor },
            titleStyle,
          ]}
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
  /** Vertically centred row — used when there's a `left` or `right` slot. */
  rowCenter: {
    alignItems: 'center',
  },
  left: {
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginLeft: 8,
  },
});
