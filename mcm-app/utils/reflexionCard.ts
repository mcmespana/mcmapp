/**
 * Una reflexión de Compartiendo como imagen de historia (1080×1920), para
 * sacarla a Instagram o WhatsApp. Usa el mismo motor que las tarjetas de
 * Contigo (`utils/shareCard.ts`): formas sobre un lienzo que
 * `components/contigo/ShareCardView.tsx` pinta y exporta a PNG sin paquetes
 * nuevos.
 */
import { onColor } from '@/utils/colorUtils';
import {
  CARD_WIDTH,
  cardHeight,
  clipText,
  fitText,
  type CardShape,
  type CardSpec,
} from '@/utils/shareCard';

/** Margen lateral del lienzo. */
const SIDE = 96;
/** Tamaños que se prueban para la frase, del mayor al menor. */
const BODY_SIZES = [104, 92, 80, 70, 62, 54, 48, 44];
const BODY_LINE = 1.24;
/** Lo más largo que cabe con dignidad en una historia. */
const MAX_CHARS = 520;

export interface ReflexionCardInput {
  text: string;
  /** Firma tal cual (`Nombre · Delegación`); vacía, sin firma. */
  author: string;
  eventTitle: string;
  /** Color de fondo (el tono de la tarjeta). */
  background: string;
}

export function reflexionCardSpec(input: ReflexionCardInput): CardSpec {
  const height = cardHeight('story');
  const ink = onColor(input.background);
  const shapes: CardShape[] = [
    {
      type: 'rect',
      x: 0,
      y: 0,
      w: CARD_WIDTH,
      h: height,
      fill: input.background,
    },
  ];

  // Comillas gigantes, casi transparentes: la firma visual de Compartiendo.
  shapes.push({
    type: 'text',
    x: SIDE - 16,
    y: 560,
    text: '“',
    size: 420,
    fill: ink,
    family: 'serif',
    weight: '700',
    opacity: 0.16,
  });

  const text = clipText(input.text, MAX_CHARS);
  const box = { w: CARD_WIDTH - SIDE * 2, h: 980 };
  const fit = fitText(text, box.w, box.h, BODY_SIZES, 'sans', BODY_LINE);
  const lineH = fit.size * BODY_LINE;
  const blockH = fit.lines.length * lineH;
  // Centrada en vertical, algo por encima de la mitad (abajo va la firma).
  let y = Math.round(900 - blockH / 2 + fit.size);
  for (const line of fit.lines) {
    shapes.push({
      type: 'text',
      x: SIDE,
      y,
      text: line,
      size: fit.size,
      fill: ink,
      family: 'sans',
      weight: '700',
    });
    y += lineH;
  }

  const author = input.author.trim();
  if (author) {
    shapes.push({
      type: 'rect',
      x: SIDE,
      y: y + 24,
      w: 72,
      h: 8,
      rx: 4,
      fill: ink,
      opacity: 0.5,
    });
    shapes.push({
      type: 'text',
      x: SIDE,
      y: y + 110,
      text: clipText(author, 44),
      size: 46,
      fill: ink,
      family: 'sans',
      weight: '600',
      opacity: 0.88,
    });
  }

  shapes.push({
    type: 'text',
    x: SIDE,
    y: height - 150,
    text: `${input.eventTitle} · Compartiendo`.toUpperCase(),
    size: 32,
    fill: ink,
    family: 'sans',
    weight: '700',
    spacing: 4,
    opacity: 0.62,
  });

  return { width: CARD_WIDTH, height, shapes };
}
