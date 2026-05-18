import React from 'react';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import GlassSurface from './GlassSurface';

/**
 * iOS tab-bar background using the unified GlassSurface (LiquidGlass on
 * iOS 18+, BlurView fallback on iOS <18).
 *
 * Note: the tab bar uses the system "chromeMaterial" tint on iOS <18.
 * GlassSurface delegates to BlurView with `light` tint when no color is
 * provided; for the tab bar we keep its native chrome by relying on
 * `clear` variant (most translucent).
 */
export default function GlassTabBarBackground() {
  return <GlassSurface variant="clear" />;
}

export function useBottomTabOverflow() {
  return useBottomTabBarHeight();
}
