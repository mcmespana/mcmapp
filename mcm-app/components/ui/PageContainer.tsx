import React from 'react';
import { StyleSheet, View, ViewStyle, useWindowDimensions } from 'react-native';
import { maxContentWidth, maxContentWidthWide } from '@/constants/breakpoints';

interface PageContainerProps {
  children: React.ReactNode;
  /** Use the wider max-width (1200px) — for Home / dashboards. */
  wide?: boolean;
  /**
   * Center the content horizontally when constrained. Defaults to true.
   * (Name kept for back-compat; now applies on every platform, not just web.)
   */
  centerOnWeb?: boolean;
  /** Override the max-width. */
  maxWidth?: number;
  style?: ViewStyle;
}

/**
 * Centers content with a sensible max-width whenever the viewport is wider
 * than the limit — web *and* large tablets (iPad landscape / portrait when
 * over the limit). On phones (width < limit) it's a no-op: mobile screens
 * already fill the available width.
 *
 * Use this in every internal screen with scrolling content so wide screens
 * don't feel like a stretched mobile app.
 */
export default function PageContainer({
  children,
  wide = false,
  centerOnWeb = true,
  maxWidth,
  style,
}: PageContainerProps) {
  const { width } = useWindowDimensions();
  const limit = maxWidth ?? (wide ? maxContentWidthWide : maxContentWidth);
  // Cross-platform: constrain once the viewport exceeds the limit. This is what
  // keeps the "Más" / event content screens from stretching edge-to-edge on an
  // iPad in landscape. Phones stay full-width (their width is below the limit).
  const shouldConstrain = width > limit;

  return (
    <View
      style={[
        styles.outer,
        shouldConstrain &&
          centerOnWeb && {
            maxWidth: limit,
            width: '100%',
            alignSelf: 'center',
          },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, width: '100%' },
});
