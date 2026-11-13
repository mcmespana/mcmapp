import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Path,
  Polygon,
  Rect,
} from 'react-native-svg';

import { PanueloColors } from '@/constants/colors';
import { glyphPath } from '@/constants/panueloGlyphs';
import type { PanueloLook, PanueloMetal } from '@/types/panuelo';

type Props = {
  look: PanueloLook;
  size: number;
  /**
   * Pieza que aún no se tiene: se pinta solo la silueta, en este color. Sin
   * él, la pieza sale con sus colores.
   */
  silhouette?: string;
};

const LOGO = require('@/panuelo-3d/assets/logo-com.png');

const metalColor = (metal: PanueloMetal | undefined) =>
  PanueloColors.metal[metal ?? 'oro'];

/**
 * Una pieza del pañuelo dibujada en plano, para la colección y las fichas.
 *
 * Es la versión 2D de lo que el visor modela en 3D (`panuelo-3d/src/items.ts`)
 * y sale de los mismos datos y de los mismos trazados
 * (`constants/panueloGlyphs.ts`): no hay imágenes que mantener a mano. No
 * pretende ser idéntica al 3D, pretende reconocerse.
 */
export function PanueloItemArt({ look, size, silhouette }: Props) {
  const paint = (color: string) => silhouette ?? color;
  const ink = 'ink' in look ? (look.ink ?? '#ffffff') : '#ffffff';

  const logoOverlay = (scale: number, top = 0.5) =>
    'logo' in look && look.logo && !silhouette ? (
      <Image
        source={LOGO}
        tintColor={look.kind === 'medalla' ? '#ffffff' : ink}
        style={[
          styles.logo,
          {
            width: size * scale,
            height: size * scale,
            left: (size * (1 - scale)) / 2,
            top: size * top - (size * scale) / 2,
            opacity: look.kind === 'medalla' ? 0.7 : 1,
          },
        ]}
        contentFit="contain"
        accessibilityIgnoresInvertColors
      />
    ) : null;

  const glyphAt = (
    glyph: string,
    cx: number,
    cy: number,
    box: number,
    fill: string,
  ) => (
    <G
      transform={`translate(${cx - box / 2} ${cy - box / 2}) scale(${box / 100})`}
    >
      <Path d={glyphPath(glyph)} fill={fill} fillRule="evenodd" />
    </G>
  );

  let art: React.ReactNode;
  switch (look.kind) {
    case 'chapa':
      art = (
        <>
          <Circle cx={50} cy={50} r={46} fill={paint(look.ring ?? look.bg)} />
          {look.ring ? (
            <Circle cx={50} cy={50} r={33} fill={paint(look.bg)} />
          ) : null}
          {look.glyph && !look.logo && !silhouette
            ? glyphAt(look.glyph, 50, 50, look.ring ? 40 : 52, ink)
            : null}
        </>
      );
      break;
    case 'pin':
      art = (
        <G transform="translate(8 8) scale(0.84)">
          <Path
            d={glyphPath(look.shape)}
            fill={paint(look.enamel)}
            stroke={paint(metalColor(look.metal))}
            strokeWidth={7}
            strokeLinejoin="round"
            fillRule="evenodd"
          />
        </G>
      );
      break;
    case 'parche': {
      const wide = look.shape === 'arrow' || look.shape === 'rect';
      art = (
        <>
          <Path d={glyphPath(look.shape)} fill={paint(look.border)} />
          <G transform="translate(8 8) scale(0.84)">
            <Path d={glyphPath(look.shape)} fill={paint(look.bg)} />
          </G>
          {look.glyph && !silhouette
            ? glyphAt(look.glyph, wide ? 42 : 50, 50, wide ? 30 : 40, ink)
            : null}
        </>
      );
      break;
    }
    case 'cinta': {
      const stripes = look.colors.length > 0 ? look.colors : ['#ffffff'];
      const w = 30 / stripes.length;
      const tail = (angle: number, id: string) => (
        <G transform={`rotate(${angle} 50 10)`}>
          <Defs>
            <ClipPath id={id}>
              <Polygon points="35,10 65,10 65,90 50,78 35,90" />
            </ClipPath>
          </Defs>
          <G clipPath={`url(#${id})`}>
            {stripes.map((color, i) => (
              <Rect
                key={i}
                x={35 + i * w}
                y={10}
                width={w + 0.5}
                height={80}
                fill={paint(color)}
              />
            ))}
          </G>
        </G>
      );
      art = (
        <>
          {tail(-13, 'cinta-a')}
          {tail(13, 'cinta-b')}
          <Rect
            x={32}
            y={6}
            width={36}
            height={8}
            rx={4}
            fill={paint(PanueloColors.metal.oro)}
          />
        </>
      );
      break;
    }
    case 'medalla': {
      const stripes = look.ribbon.length > 0 ? look.ribbon : ['#ffffff'];
      const w = 30 / stripes.length;
      const tone = metalColor(look.metal);
      art = (
        <>
          <Defs>
            <ClipPath id="medalla-cinta">
              <Polygon points="35,6 65,6 65,34 50,44 35,34" />
            </ClipPath>
          </Defs>
          <G clipPath="url(#medalla-cinta)">
            {stripes.map((color, i) => (
              <Rect
                key={i}
                x={35 + i * w}
                y={6}
                width={w + 0.5}
                height={40}
                fill={paint(color)}
              />
            ))}
          </G>
          <Rect
            x={32}
            y={3}
            width={36}
            height={7}
            rx={3.5}
            fill={paint(tone)}
          />
          <Circle cx={50} cy={68} r={26} fill={paint(tone)} />
          {silhouette ? null : (
            <Circle
              cx={50}
              cy={68}
              r={21}
              fill="none"
              stroke="#ffffff"
              strokeOpacity={0.45}
              strokeWidth={1.5}
            />
          )}
          {!look.logo && !silhouette
            ? glyphAt(look.glyph ?? 'star', 50, 68, 26, '#ffffff')
            : null}
        </>
      );
      break;
    }
  }

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {art}
      </Svg>
      {look.kind === 'medalla' ? logoOverlay(0.3, 0.68) : logoOverlay(0.5)}
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    position: 'absolute',
  },
});
