import React from 'react';
import { View } from 'react-native';

interface ProgressRingProps {
  /** Number of completed units (0..total). */
  done: number;
  /** Total units. Defaults to 3 (Contigo's habits). */
  total?: number;
  /** Outer diameter in px. Defaults to 96. */
  size?: number;
  /** Visual thickness of the ring (controls dot size). Defaults to 8. */
  stroke?: number;
  /**
   * Color of filled dots. Can be a string or a function that receives
   * (done, total) to vary the color based on progress.
   */
  color?: string | ((done: number, total: number) => string);
  /** Color of empty dots (the "track"). */
  trackColor?: string;
  /** Density: number of dots around the circle. Defaults to 48 (smooth ring). */
  dotCount?: number;
}

/**
 * Pure-View dotted progress ring. No SVG dependency — works on every platform
 * including dev clients without native modules installed.
 *
 * Originally extracted from `components/contigo/HomeWidgets.tsx`. The Contigo
 * version is the canonical caller; this one is agnostic and reusable in
 * Calendar (events this month), Wordle (attempts), Reflexiones (entries), etc.
 */
export default function ProgressRing({
  done,
  total = 3,
  size = 96,
  stroke = 8,
  color,
  trackColor = 'rgba(255,255,255,0.10)',
  dotCount = 48,
}: ProgressRingProps) {
  const pct = total === 0 ? 0 : Math.max(0, Math.min(1, done / total));
  const filled = Math.round(pct * dotCount);
  const dotSize = Math.max(3, Math.round(stroke * 0.65));
  const radius = (size - dotSize) / 2 - 1;
  const cx = size / 2;
  const cy = size / 2;

  const resolvedColor =
    typeof color === 'function'
      ? color(done, total)
      : (color ??
        (done === total && total > 0
          ? '#6DBF7E'
          : done >= Math.ceil(total * 0.66)
            ? '#F97316'
            : done > 0
              ? '#FB923C'
              : 'rgba(255,255,255,0.22)'));

  return (
    <View style={{ width: size, height: size }}>
      {Array.from({ length: dotCount }).map((_, i) => {
        const a = (i / dotCount) * Math.PI * 2 - Math.PI / 2;
        const x = cx + radius * Math.cos(a) - dotSize / 2;
        const y = cy + radius * Math.sin(a) - dotSize / 2;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: i < filled ? resolvedColor : trackColor,
            }}
          />
        );
      })}
    </View>
  );
}
