/**
 * Tarjetas para compartir como imagen (el evangelio con tu subrayado, tu año
 * en Contigo). Se describen como una lista de formas —rectángulos y textos—
 * sobre un lienzo de 1080 px de ancho, y de ahí salen las dos cosas: lo que se
 * pinta con `react-native-svg` y el SVG en texto con el que la web hace el PNG.
 *
 * Sin capturar pantallas ni paquetes nuevos: `react-native-svg` ya exporta a
 * PNG en iOS y Android (`toDataURL`).
 *
 * El texto se parte a mano (SVG no hace saltos de línea): se estima el ancho
 * por número de letras, tirando a estrecho, y se centra, así que un error de
 * medida no desborda ni se nota.
 */
import { Platform } from 'react-native';
import { WARM_DARK, WARM_LIGHT } from '@/components/contigo/theme';
import {
  DEFAULT_HIGHLIGHT_COLOR,
  HIGHLIGHT_COLORS,
  type HighlightColorKey,
} from '@/utils/highlightRanges';

export const CARD_WIDTH = 1080;
export type CardFormat = 'story' | 'square';
export const cardHeight = (format: CardFormat) =>
  format === 'story' ? 1920 : 1080;

export type CardShape =
  | {
      type: 'rect';
      x: number;
      y: number;
      w: number;
      h: number;
      rx?: number;
      fill: string;
      opacity?: number;
    }
  | {
      type: 'text';
      x: number;
      y: number;
      text: string;
      size: number;
      fill: string;
      family: 'serif' | 'sans';
      weight?: '400' | '600' | '700';
      italic?: boolean;
      anchor?: 'start' | 'middle' | 'end';
      spacing?: number;
      opacity?: number;
    };

export interface CardSpec {
  width: number;
  height: number;
  shapes: CardShape[];
}

export const CARD_STYLES = ['papel', 'noche', 'color', 'blanco'] as const;
export type CardStyle = (typeof CARD_STYLES)[number];

export const CARD_STYLE_LABELS: Record<CardStyle, string> = {
  papel: 'Papel',
  noche: 'Noche',
  color: 'Color',
  blanco: 'Blanco',
};

interface Palette {
  bg: string;
  text: string;
  soft: string;
  accent: string;
  /** Fondo del bloque de la frase (o null: sin bloque). */
  block: string | null;
  blockOpacity: number;
}

export function cardPalette(
  style: CardStyle,
  color: HighlightColorKey = DEFAULT_HIGHLIGHT_COLOR,
): Palette {
  const swatch = (HIGHLIGHT_COLORS[color] ?? HIGHLIGHT_COLORS.sun).swatch;
  switch (style) {
    case 'noche':
      return {
        bg: WARM_DARK.bg,
        text: WARM_DARK.text,
        soft: WARM_DARK.textSec,
        accent: WARM_DARK.accent,
        block: swatch,
        blockOpacity: 0.16,
      };
    case 'color':
      return {
        bg: swatch,
        text: WARM_LIGHT.text,
        soft: WARM_LIGHT.text,
        accent: WARM_LIGHT.text,
        block: null,
        blockOpacity: 0,
      };
    case 'blanco':
      return {
        bg: '#FFFFFF',
        text: WARM_LIGHT.text,
        soft: WARM_LIGHT.textSec,
        accent: WARM_LIGHT.accentText,
        block: null,
        blockOpacity: 0,
      };
    default:
      return {
        bg: WARM_LIGHT.bg,
        text: WARM_LIGHT.text,
        soft: WARM_LIGHT.textSec,
        accent: WARM_LIGHT.accentText,
        block: swatch,
        blockOpacity: 0.55,
      };
  }
}

/** Parte un texto en líneas de como mucho `maxChars`, por palabras. */
export function wrapText(text: string, maxChars: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (!line) line = word;
    else if (line.length + 1 + word.length <= maxChars) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Recorta por frase o por palabra, con puntos suspensivos. */
export function clipText(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
  if (stop > max * 0.5) return cut.slice(0, stop + 1);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

/** Ancho medio de una letra, en em. A lo ancho, para no desbordar. */
const CHAR_EM = { serif: 0.5, sans: 0.54 };

/** El tamaño de letra más grande con el que el texto cabe en la caja. */
export function fitText(
  text: string,
  boxWidth: number,
  boxHeight: number,
  sizes: number[],
  family: 'serif' | 'sans' = 'serif',
  lineHeight = 1.36,
): { size: number; lines: string[] } {
  let last = { size: sizes[sizes.length - 1], lines: [text] };
  for (const size of sizes) {
    const lines = wrapText(
      text,
      Math.max(8, Math.floor(boxWidth / (size * CHAR_EM[family]))),
    );
    last = { size, lines };
    if (lines.length * size * lineHeight <= boxHeight) return last;
  }
  return last;
}

export interface GospelCardInput {
  phrase: string;
  cita: string;
  dateLabel: string;
  /** «Evangelio», «Salmo»… */
  kicker: string;
  color?: HighlightColorKey;
  style: CardStyle;
  format: CardFormat;
}

const MARGIN = 104;
const PHRASE_SIZES = [76, 68, 60, 54, 48, 42, 38, 34];

export function gospelCardSpec(input: GospelCardInput): CardSpec {
  const height = cardHeight(input.format);
  const p = cardPalette(input.style, input.color);
  const shapes: CardShape[] = [
    { type: 'rect', x: 0, y: 0, w: CARD_WIDTH, h: height, fill: p.bg },
  ];
  const cx = CARD_WIDTH / 2;
  const story = input.format === 'story';
  const top = story ? 300 : 132;
  const bottom = height - (story ? 280 : 120);

  shapes.push({
    type: 'text',
    x: cx,
    y: top,
    text: input.kicker.toUpperCase(),
    size: 30,
    fill: p.accent,
    family: 'sans',
    weight: '700',
    anchor: 'middle',
    spacing: 6,
  });
  shapes.push({
    type: 'text',
    x: cx,
    y: top + 52,
    text: input.dateLabel,
    size: 30,
    fill: p.soft,
    family: 'sans',
    anchor: 'middle',
    opacity: 0.85,
  });

  const pad = p.block ? 56 : 0;
  const boxTop = top + 130;
  const boxBottom = bottom - 150;
  const boxWidth = CARD_WIDTH - MARGIN * 2 - pad * 2;
  const quoteRoom = p.block ? 0 : 120;
  const fit = fitText(
    clipText(input.phrase, story ? 560 : 300),
    boxWidth,
    boxBottom - boxTop - pad * 2 - quoteRoom,
    PHRASE_SIZES,
  );
  const lh = fit.size * 1.36;
  const textH = fit.lines.length * lh;
  const blockH = textH + pad * 2 + quoteRoom;
  const blockY = boxTop + (boxBottom - boxTop - blockH) / 2;

  if (p.block) {
    shapes.push({
      type: 'rect',
      x: MARGIN,
      y: blockY,
      w: CARD_WIDTH - MARGIN * 2,
      h: blockH,
      rx: 40,
      fill: p.block,
      opacity: p.blockOpacity,
    });
  } else {
    shapes.push({
      type: 'text',
      x: cx,
      y: blockY + 110,
      text: '“',
      size: 200,
      fill: p.accent,
      family: 'serif',
      weight: '700',
      anchor: 'middle',
      opacity: input.style === 'color' ? 0.3 : 0.9,
    });
  }
  fit.lines.forEach((line, i) => {
    shapes.push({
      type: 'text',
      x: cx,
      y: blockY + pad + quoteRoom + fit.size * 0.95 + i * lh,
      text: line,
      size: fit.size,
      fill: p.text,
      family: 'serif',
      anchor: 'middle',
    });
  });

  if (input.cita) {
    shapes.push({
      type: 'text',
      x: cx,
      y: blockY + blockH + 84,
      text: input.cita,
      size: 36,
      fill: p.accent,
      family: 'serif',
      italic: true,
      weight: '600',
      anchor: 'middle',
    });
  }
  shapes.push({
    type: 'text',
    x: cx,
    y: bottom + 40,
    text: 'Contigo · MCM App',
    size: 26,
    fill: p.soft,
    family: 'sans',
    weight: '600',
    anchor: 'middle',
    spacing: 2,
    opacity: 0.7,
  });
  return { width: CARD_WIDTH, height, shapes };
}

export function cardFontFamily(family: 'serif' | 'sans'): string {
  if (family === 'serif') {
    return Platform.select({
      ios: 'Palatino',
      android: 'serif',
      default: 'Palatino, "Palatino Linotype", Georgia, serif',
    }) as string;
  }
  return Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  }) as string;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** El mismo dibujo, como SVG en texto (para hacer el PNG en web). */
export function cardSvgXml(spec: CardSpec): string {
  const body = spec.shapes
    .map((s) => {
      if (s.type === 'rect') {
        return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.rx ?? 0}" fill="${s.fill}" opacity="${s.opacity ?? 1}"/>`;
      }
      const family = cardFontFamily(s.family).replace(/"/g, "'");
      return `<text x="${s.x}" y="${s.y}" font-size="${s.size}" fill="${s.fill}" font-family="${family}" font-weight="${s.weight ?? '400'}" font-style="${s.italic ? 'italic' : 'normal'}" text-anchor="${s.anchor ?? 'start'}" letter-spacing="${s.spacing ?? 0}" opacity="${s.opacity ?? 1}">${esc(s.text)}</text>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${spec.width}" height="${spec.height}" viewBox="0 0 ${spec.width} ${spec.height}">${body}</svg>`;
}

export interface RecapCardInput {
  year: number;
  stats: { value: string; label: string }[];
  /** Una frase subrayada del año, si se quiere enseñar. */
  phrase?: string;
  /** 12 valores 0–1: cuánto de cada mes. */
  months: number[];
  color?: HighlightColorKey;
  style: CardStyle;
  format: CardFormat;
}

const MONTH_INITIALS = 'EFMAMJJASOND';

export function recapCardSpec(input: RecapCardInput): CardSpec {
  const height = cardHeight(input.format);
  const p = cardPalette(input.style, input.color);
  const story = input.format === 'story';
  const cx = CARD_WIDTH / 2;
  const shapes: CardShape[] = [
    { type: 'rect', x: 0, y: 0, w: CARD_WIDTH, h: height, fill: p.bg },
  ];
  let y = story ? 300 : 150;
  shapes.push({
    type: 'text',
    x: cx,
    y,
    text: 'MI AÑO EN CONTIGO',
    size: 30,
    fill: p.accent,
    family: 'sans',
    weight: '700',
    anchor: 'middle',
    spacing: 6,
  });
  y += story ? 190 : 150;
  shapes.push({
    type: 'text',
    x: cx,
    y,
    text: String(input.year),
    size: story ? 200 : 160,
    fill: p.text,
    family: 'serif',
    weight: '700',
    anchor: 'middle',
  });

  // Los doce meses, en barras.
  y += story ? 110 : 70;
  const barsW = CARD_WIDTH - MARGIN * 2;
  const slot = barsW / 12;
  const barMax = story ? 150 : 90;
  input.months.forEach((v, i) => {
    const hgt = Math.max(8, Math.round(barMax * Math.min(1, Math.max(0, v))));
    shapes.push({
      type: 'rect',
      x: MARGIN + i * slot + slot * 0.2,
      y: y + barMax - hgt,
      w: slot * 0.6,
      h: hgt,
      rx: 10,
      fill: p.accent,
      opacity: v > 0 ? 0.9 : 0.2,
    });
    shapes.push({
      type: 'text',
      x: MARGIN + i * slot + slot / 2,
      y: y + barMax + 40,
      text: MONTH_INITIALS[i],
      size: 24,
      fill: p.soft,
      family: 'sans',
      weight: '600',
      anchor: 'middle',
      opacity: 0.8,
    });
  });
  y += barMax + (story ? 170 : 120);

  // Cifras: dos por fila.
  const stats = input.stats.slice(0, story ? 4 : 2);
  const colW = barsW / 2;
  stats.forEach((st, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const sx = MARGIN + col * colW + colW / 2;
    const sy = y + row * 210;
    shapes.push({
      type: 'text',
      x: sx,
      y: sy,
      text: st.value,
      size: 96,
      fill: p.text,
      family: 'serif',
      weight: '700',
      anchor: 'middle',
    });
    shapes.push({
      type: 'text',
      x: sx,
      y: sy + 52,
      text: st.label,
      size: 30,
      fill: p.soft,
      family: 'sans',
      anchor: 'middle',
    });
  });
  y += Math.ceil(stats.length / 2) * 210;

  if (story && input.phrase) {
    const fit = fitText(
      `«${clipText(input.phrase, 150)}»`,
      barsW,
      230,
      [44, 40, 36, 32],
    );
    fit.lines.forEach((line, i) => {
      shapes.push({
        type: 'text',
        x: cx,
        y: y + 30 + i * fit.size * 1.36,
        text: line,
        size: fit.size,
        fill: p.text,
        family: 'serif',
        italic: true,
        anchor: 'middle',
        opacity: 0.9,
      });
    });
  }

  shapes.push({
    type: 'text',
    x: cx,
    y: height - (story ? 240 : 80),
    text: 'Contigo · MCM App',
    size: 26,
    fill: p.soft,
    family: 'sans',
    weight: '600',
    anchor: 'middle',
    spacing: 2,
    opacity: 0.7,
  });
  return { width: CARD_WIDTH, height, shapes };
}
