/**
 * El emblema de «Tu año»: doce arcos alrededor, uno por mes —más llenos los
 * meses con más días de oración—, y una estrella de cuatro puntas en el
 * centro. Es el año de cada uno, dibujado.
 */
import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

interface Props {
  size: number;
  color: string;
  /** 12 valores 0–1: cuánto de cada mes. Sin datos, todos encendidos. */
  months?: number[];
}

const GAP_DEG = 8;

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const rad = (a: number) => ((a - 90) * Math.PI) / 180;
  const x0 = cx + r * Math.cos(rad(a0));
  const y0 = cy + r * Math.sin(rad(a0));
  const x1 = cx + r * Math.cos(rad(a1));
  const y1 = cy + r * Math.sin(rad(a1));
  return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`;
}

/** Estrella de cuatro puntas, de lados curvos. */
function starPath(cx: number, cy: number, r: number) {
  const k = r * 0.22;
  return [
    `M ${cx} ${cy - r}`,
    `Q ${cx + k} ${cy - k} ${cx + r} ${cy}`,
    `Q ${cx + k} ${cy + k} ${cx} ${cy + r}`,
    `Q ${cx - k} ${cy + k} ${cx - r} ${cy}`,
    `Q ${cx - k} ${cy - k} ${cx} ${cy - r}`,
    'Z',
  ].join(' ');
}

export default function RecapEmblem({ size, color, months }: Props) {
  const c = size / 2;
  const stroke = Math.max(2, size * 0.085);
  const r = c - stroke / 2 - 1;
  const step = 360 / 12;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {Array.from({ length: 12 }, (_, i) => {
        const v = months ? Math.max(0, Math.min(1, months[i] ?? 0)) : 1;
        return (
          <Path
            key={i}
            d={arcPath(
              c,
              c,
              r,
              i * step + GAP_DEG / 2,
              (i + 1) * step - GAP_DEG / 2,
            )}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            opacity={0.35 + 0.65 * v}
          />
        );
      })}
      <Path d={starPath(c, c, size * 0.24)} fill={color} />
      <Circle
        cx={c + size * 0.2}
        cy={c - size * 0.2}
        r={size * 0.035}
        fill={color}
      />
    </Svg>
  );
}
