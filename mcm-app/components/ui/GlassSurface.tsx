import React from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { pickGlassTint } from './glass';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export interface GlassSurfaceProps {
  /** Tint color used for the solid background fallback. */
  tintColor?: string;
  /** Variant — affects opacity on web/native fallback. */
  variant?: 'clear' | 'regular' | 'material';
  /** Optional bottom hairline border. */
  bottomBorder?: boolean;
  /**
   * Color de esa hairline. El default (negro al 10%) es invisible sobre
   * superficies oscuras: pásalo explícito en modo oscuro.
   */
  bottomBorderColor?: string;
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

/**
 * Cross-platform fallback for the iOS glass effect.
 *   - Web: solid background + CSS `backdropFilter: blur(...)` when supported.
 *   - Android: solid tinted background (no real blur — Android RN has no
 *     reliable cheap blur primitive).
 *
 * Android/Web don't try to replicate iOS LiquidGlass; instead they aim for
 * a clean, opaque-but-tinted surface that fits the institutional palette.
 */
export default function GlassSurface({
  tintColor,
  variant = 'regular',
  bottomBorder = false,
  bottomBorderColor,
  children,
  style,
}: GlassSurfaceProps) {
  // Sin tinte, el respaldo era SIEMPRE blanco al 95 %, también en modo oscuro.
  // En iOS no se notaba (allí manda el cristal nativo de `GlassSurface.ios`),
  // pero en Android y web la cápsula de la Home, el botón de volver, los de un
  // evento y el FAB de la canción salían como pastillas blancas con iconos
  // claros encima: invisibles. En oscuro, el respaldo es la superficie elevada.
  const isDark = useColorScheme() === 'dark';
  const effectiveTint = tintColor ?? (isDark ? Colors.dark.card : undefined);
  const { backgroundColor } = pickGlassTint(effectiveTint);

  // Web supports backdrop-filter natively — we can keep the glass feel.
  const webBlur =
    Platform.OS === 'web'
      ? {
          // @ts-ignore - RN types lag behind web-specific CSS props.
          backdropFilter: variant === 'clear' ? 'blur(18px)' : 'blur(28px)',
          // @ts-ignore
          WebkitBackdropFilter:
            variant === 'clear' ? 'blur(18px)' : 'blur(28px)',
        }
      : null;

  // Slightly lower opacity on web so the backdrop-filter is visible.
  const webBackground =
    Platform.OS === 'web' && effectiveTint
      ? effectiveTint + (variant === 'clear' ? '99' : 'CC')
      : backgroundColor;

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: webBackground },
        webBlur as any,
        style,
      ]}
    >
      {bottomBorder ? (
        <View
          style={[
            styles.bottomBorder,
            bottomBorderColor ? { backgroundColor: bottomBorderColor } : null,
          ]}
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomBorder: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
});
