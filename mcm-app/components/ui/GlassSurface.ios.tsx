import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import {
  GlassView,
  isLiquidGlassAvailable,
  isGlassEffectAPIAvailable,
} from 'expo-glass-effect';
import { BlurView, BlurTint } from 'expo-blur';
import { pickGlassTint } from './glass';

export interface GlassSurfaceProps {
  /** Tint color underneath the glass effect. Drives blur tint + opacity automatically. */
  tintColor?: string;
  /**
   * Glass intensity preset.
   *   - `clear`: most translucent (tab bar, full-screen overlays)
   *   - `regular`: balanced (headers, FAB)
   *   - `material`: most opaque (popover surfaces)
   */
  variant?: 'clear' | 'regular' | 'material';
  /**
   * Override the BlurView `tint` prop (only used on iOS <18 fallback).
   * Useful for tab-bar / chrome surfaces that need `systemChromeMaterial`.
   */
  blurTint?: BlurTint;
  /** Optional bottom hairline border (used by GlassHeader to separate from content). */
  bottomBorder?: boolean;
  /** Children rendered on top of the glass effect (rare — usually you wrap content elsewhere). */
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

/**
 * Unified iOS glass surface — picks LiquidGlass (iOS 18+) when available
 * and falls back to BlurView with adaptive tint otherwise.
 *
 * Used by GlassHeader, GlassFAB, GlassTabBarBackground and any iOS-only
 * glass surface in the app. Avoids duplicating brightness/tint logic.
 */
export default function GlassSurface({
  tintColor,
  variant = 'regular',
  blurTint: blurTintOverride,
  bottomBorder = false,
  children,
  style,
}: GlassSurfaceProps) {
  // isGlassEffectAPIAvailable() guards against crashes on some iOS 26 beta
  // builds where isLiquidGlassAvailable() returns true but the native API
  // isn't actually safe to use. See: https://github.com/expo/expo/issues/40911
  const liquidAvailable =
    isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  const {
    backgroundColor,
    blurTint: autoTint,
    blurIntensity,
  } = pickGlassTint(tintColor);
  // Default to systemChromeMaterial for chrome surfaces (tab bar) when
  // no explicit tint color was provided and no override given.
  const blurTint: BlurTint =
    blurTintOverride ?? (tintColor ? autoTint : 'systemChromeMaterial');

  // glassEffectStyle for LiquidGlass mirrors the variant prop.
  const glassEffectStyle: 'clear' | 'regular' =
    variant === 'clear' ? 'clear' : 'regular';

  // El radio del contenedor debe aplicarse también a la capa nativa de cristal:
  // sin esto, el `GlassView`/`BlurView` dibuja su propio borde/halo rectangular
  // que el contenedor recorta a destiempo y se percibe como un segundo cristal
  // (el efecto "doble capa" del botón Atrás). Igualando el radio, la pieza de
  // cristal queda perfectamente redondeada en una sola capa.
  const flat = StyleSheet.flatten(style) as ViewStyle | undefined;
  const radius =
    typeof flat?.borderRadius === 'number' ? flat.borderRadius : undefined;
  const radiusStyle = radius != null ? { borderRadius: radius } : null;

  const baseLayer = liquidAvailable ? (
    <>
      {tintColor ? (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor }, radiusStyle]}
        />
      ) : null}
      <GlassView
        glassEffectStyle={glassEffectStyle}
        style={[StyleSheet.absoluteFill, radiusStyle]}
      />
    </>
  ) : (
    <BlurView
      tint={blurTint}
      intensity={blurIntensity}
      style={[
        StyleSheet.absoluteFill,
        tintColor ? { backgroundColor } : null,
        radiusStyle,
      ]}
    />
  );

  return (
    <View style={[StyleSheet.absoluteFill, style]}>
      {baseLayer}
      {bottomBorder ? <View style={styles.bottomBorder} /> : null}
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
