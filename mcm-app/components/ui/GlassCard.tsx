import React from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import GlassSurface from './GlassSurface';
import { radii, shadows } from '@/constants/uiStyles';
import { useThemeColor } from '@/hooks/useThemeColor';

interface GlassCardProps {
  children: React.ReactNode;
  /** Tint color for the glass effect (iOS) / fallback background (Android/web). */
  tintColor?: string;
  /** Border radius. Defaults to radii.xxl (22). */
  borderRadius?: number;
  /** When true, no border is drawn around the card. */
  borderless?: boolean;
  /** Drop shadow preset. Defaults to "md". */
  shadow?: keyof typeof shadows | 'none';
  style?: ViewStyle;
}

/**
 * Glass-effect card surface.
 *   - iOS: real LiquidGlass / BlurView via GlassSurface.ios.
 *   - Android: solid tinted background via GlassSurface.tsx.
 *   - Web: backdrop-filter blur via GlassSurface.tsx.
 *
 * Drop this in place of a `<View style={card}>` when the card deserves
 * a "premium" feel: home featured event, hero card, etc.
 *
 * Use the static subcomponents `.Header` / `.Body` / `.Footer` for nicely
 * spaced sections, or just pass children directly for full control.
 */
function GlassCard({
  children,
  tintColor,
  borderRadius = radii.xxl,
  borderless = false,
  shadow = 'md',
  style,
}: GlassCardProps) {
  const cardBg = useThemeColor({}, 'card');
  const shadowStyle =
    shadow === 'none' ? null : (shadows[shadow] as ViewStyle | undefined);

  // Native fallback when no tint provided: use theme card color so the
  // card looks like a regular elevated surface (no glass behind).
  const fallbackBg = tintColor ? undefined : cardBg;

  return (
    <View
      style={[
        styles.outer,
        { borderRadius, backgroundColor: fallbackBg },
        shadowStyle,
        style,
      ]}
    >
      <View style={[styles.clip, { borderRadius }]}>
        {/* On iOS the GlassSurface.ios variant produces real glass.
            On Android/Web the cross-platform GlassSurface.tsx is used. */}
        {tintColor ? <GlassSurface tintColor={tintColor} variant="regular" /> : null}
        <View
          style={[
            styles.content,
            !borderless && {
              borderRadius,
              borderWidth: Platform.OS === 'ios' ? 0 : 1,
              borderColor: 'rgba(0,0,0,0.06)',
            },
          ]}
        >
          {children}
        </View>
      </View>
    </View>
  );
}

const Header = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) => <View style={[styles.header, style]}>{children}</View>;

const Body = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) => <View style={[styles.body, style]}>{children}</View>;

const Footer = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) => <View style={[styles.footer, style]}>{children}</View>;

GlassCard.Header = Header;
GlassCard.Body = Body;
GlassCard.Footer = Footer;

export default GlassCard;

const styles = StyleSheet.create({
  outer: { backgroundColor: 'transparent' },
  clip: { overflow: 'hidden' },
  content: { position: 'relative' },
  header: { padding: 16, paddingBottom: 8 },
  body: { padding: 16 },
  footer: { padding: 16, paddingTop: 8 },
});
