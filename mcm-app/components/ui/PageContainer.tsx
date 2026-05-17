import React from 'react';
import {
  Platform,
  StyleSheet,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { maxContentWidth, maxContentWidthWide } from '@/constants/breakpoints';

interface PageContainerProps {
  children: React.ReactNode;
  /** Use the wider max-width (1200px) — for Home / dashboards. */
  wide?: boolean;
  /**
   * Center the content horizontally on web. Defaults to true.
   * Native platforms ignore max-width (mobile already fills the screen).
   */
  centerOnWeb?: boolean;
  /** Override the max-width. */
  maxWidth?: number;
  style?: ViewStyle;
}

/**
 * Centers content with a sensible max-width on web. On native it just
 * renders children inside a `View` (no-op) — mobile screens already fill
 * the available width.
 *
 * Use this in every internal screen with scrolling content so the web build
 * doesn't feel like a stretched mobile app.
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
  const shouldConstrain = Platform.OS === 'web' && width > limit;

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
