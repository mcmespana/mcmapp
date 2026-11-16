/**
 * Pinta una tarjeta (`utils/shareCard.ts`) y la sabe compartir como PNG:
 * `toDataURL` de `react-native-svg` en iOS y Android; en web, el mismo dibujo
 * en SVG pasado por un canvas.
 */
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { logger } from '@/utils/logger';
import { cardFontFamily, cardSvgXml, type CardSpec } from '@/utils/shareCard';

export interface ShareCardHandle {
  /** Devuelve false si no se ha podido. */
  share: (fileName: string) => Promise<boolean>;
}

interface Props {
  spec: CardSpec;
  /** Ancho en pantalla; el alto sale de la proporción. */
  width: number;
}

async function shareWeb(spec: CardSpec, fileName: string): Promise<boolean> {
  const xml = cardSvgXml(spec);
  const url = URL.createObjectURL(
    new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }),
  );
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('svg'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = spec.width;
    canvas.height = spec.height;
    canvas.getContext('2d')?.drawImage(img, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    );
    if (!blob) return false;
    const file = new File([blob], fileName, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return true;
      } catch (e) {
        if ((e as { name?: string })?.name === 'AbortError') return true;
      }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    return true;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const ShareCardView = forwardRef<ShareCardHandle, Props>(function ShareCardView(
  { spec, width },
  ref,
) {
  const svgRef = useRef<Svg>(null);

  useImperativeHandle(ref, () => ({
    async share(fileName) {
      try {
        if (Platform.OS === 'web') return await shareWeb(spec, fileName);
        const base64 = await new Promise<string>((resolve, reject) => {
          const svg = svgRef.current;
          if (!svg) return reject(new Error('sin tarjeta'));
          svg.toDataURL(resolve, { width: spec.width, height: spec.height });
        });
        const path = `${FileSystem.cacheDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(path, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await Sharing.shareAsync(path, {
          mimeType: 'image/png',
          UTI: 'public.png',
        });
        return true;
      } catch (e) {
        logger.warn('share card', e);
        return false;
      }
    },
  }));

  return (
    <Svg
      ref={svgRef}
      width={width}
      height={(width * spec.height) / spec.width}
      viewBox={`0 0 ${spec.width} ${spec.height}`}
    >
      {spec.shapes.map((s, i) =>
        s.type === 'rect' ? (
          <Rect
            key={i}
            x={s.x}
            y={s.y}
            width={s.w}
            height={s.h}
            rx={s.rx ?? 0}
            fill={s.fill}
            opacity={s.opacity ?? 1}
          />
        ) : (
          <SvgText
            key={i}
            x={s.x}
            y={s.y}
            fontSize={s.size}
            fill={s.fill}
            fontFamily={cardFontFamily(s.family)}
            fontWeight={s.weight ?? '400'}
            fontStyle={s.italic ? 'italic' : 'normal'}
            textAnchor={s.anchor ?? 'start'}
            letterSpacing={s.spacing ?? 0}
            opacity={s.opacity ?? 1}
          >
            {s.text}
          </SvgText>
        ),
      )}
    </Svg>
  );
});

export default ShareCardView;
