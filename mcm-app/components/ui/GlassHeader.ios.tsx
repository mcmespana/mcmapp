import React from 'react';
import GlassSurface from './GlassSurface';

interface GlassHeaderProps {
  tintColor?: string;
}

/**
 * iOS-only glass header. Wraps GlassSurface (which centralises the
 * LiquidGlass / BlurView decision and the brightness-based tint logic).
 */
export default function GlassHeader({ tintColor }: GlassHeaderProps) {
  return <GlassSurface tintColor={tintColor} variant="regular" bottomBorder />;
}
