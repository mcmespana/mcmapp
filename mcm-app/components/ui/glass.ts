// components/ui/glass.ts
// Pure helpers for the glass/blur system. NO native imports here —
// safe to import from any platform.

/**
 * Returns the perceived brightness of a hex color in the 0–255 range.
 * Used to decide if we should apply a light or dark blur tint behind it.
 */
export function getBrightness(hex: string): number {
  if (!hex) return 255;
  const clean = hex.replace('#', '');
  const expanded =
    clean.length === 3
      ? clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2]
      : clean.slice(0, 6);
  const r = parseInt(expanded.substring(0, 2), 16);
  const g = parseInt(expanded.substring(2, 4), 16);
  const b = parseInt(expanded.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

/**
 * Splits tint colors into light/dark and returns the recommended
 * background tint + blur intensity for the BlurView fallback.
 */
export function pickGlassTint(tintColor?: string): {
  /** Hex with alpha suffix, or default white-translucent. */
  backgroundColor: string;
  /** BlurView `tint` prop. */
  blurTint: 'light' | 'dark';
  /** BlurView `intensity` prop. */
  blurIntensity: number;
  /** True if the color is dark — useful for foreground icon/text contrast. */
  isDark: boolean;
} {
  if (!tintColor) {
    return {
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      blurTint: 'light',
      blurIntensity: 100,
      isDark: false,
    };
  }
  const brightness = getBrightness(tintColor);
  if (brightness > 180) {
    // Light color — needs more opacity for readability
    return {
      backgroundColor: tintColor + 'F0', // 94%
      blurTint: 'light',
      blurIntensity: 100,
      isDark: false,
    };
  }
  return {
    backgroundColor: tintColor + 'D0', // 82%
    blurTint: 'dark',
    blurIntensity: 80,
    isDark: true,
  };
}
