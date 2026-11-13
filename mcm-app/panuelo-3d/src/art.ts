/**
 * Los dibujos de las piezas, pintados en un `<canvas>`: la cara de una chapa,
 * el bordado de un parche, las rayas de una cinta, el relieve de una medalla.
 *
 * Todo sale de los datos de la pieza (colores, forma, texto): una pieza nueva
 * en el catálogo no necesita ninguna imagen ni ninguna versión nueva de la
 * app.
 */
import * as THREE from 'three';

import { GLYPH_BOX, glyphPath } from '@/constants/panueloGlyphs';
import type {
  ChapaLook,
  MedallaLook,
  PanueloGlyph,
  ParcheLook,
} from '@/types/panuelo';

const SIZE = 512;
const FONT =
  '-apple-system, "SF Pro Text", Roboto, "Helvetica Neue", sans-serif';

function newCanvas(w = SIZE, h = SIZE) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d')! };
}

function colorTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Pinta una forma centrada en (cx, cy) ocupando `size` píxeles. */
function fillGlyph(
  ctx: CanvasRenderingContext2D,
  glyph: PanueloGlyph | string,
  cx: number,
  cy: number,
  size: number,
  mode: 'fill' | 'stroke' = 'fill',
) {
  const k = size / GLYPH_BOX;
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(k, k);
  const path = new Path2D(glyphPath(glyph));
  if (mode === 'fill') ctx.fill(path, 'evenodd');
  else ctx.stroke(path);
  ctx.restore();
}

/** Texto siguiendo un arco. `top` lo pone por arriba; si no, por abajo. */
function arcText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  radius: number,
  top: boolean,
  fontSize: number,
) {
  const str = text.toUpperCase();
  ctx.save();
  ctx.font = `800 ${fontSize}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const spacing = fontSize * 0.08;
  const widths = [...str].map((ch) => ctx.measureText(ch).width + spacing);
  const total = widths.reduce((a, b) => a + b, 0);
  let angle = -total / radius / 2;
  [...str].forEach((ch, i) => {
    const half = widths[i] / radius / 2;
    angle += half;
    ctx.save();
    if (top) {
      ctx.translate(
        cx + radius * Math.sin(angle),
        cy - radius * Math.cos(angle),
      );
      ctx.rotate(angle);
    } else {
      ctx.translate(
        cx + radius * Math.sin(angle),
        cy + radius * Math.cos(angle),
      );
      ctx.rotate(-angle);
    }
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    angle += half;
  });
  ctx.restore();
}

/** El logo, teñido de un color. */
function tintedLogo(logo: HTMLImageElement, color: string, size: number) {
  const { canvas, ctx } = newCanvas(size, size);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(logo, 0, 0, size, size);
  return canvas;
}

/** Carga una imagen de fuera. Si falla (sin red, sin CORS), no pasa nada. */
export function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// ── Chapa ──────────────────────────────────────────────────────────────────

export function paintChapa(
  look: ChapaLook,
  logo: HTMLImageElement | null,
  image: HTMLImageElement | null,
): THREE.CanvasTexture {
  const { canvas, ctx } = newCanvas();
  const c = SIZE / 2;
  const ink = look.ink ?? '#ffffff';
  ctx.fillStyle = look.bg;
  ctx.fillRect(0, 0, SIZE, SIZE);

  if (image) {
    // Recorte centrado, tipo «cover».
    const side = Math.min(image.width, image.height);
    ctx.drawImage(
      image,
      (image.width - side) / 2,
      (image.height - side) / 2,
      side,
      side,
      0,
      0,
      SIZE,
      SIZE,
    );
    return colorTexture(canvas);
  }

  // La cara visible de la chapa es el círculo de radio ~0,86·c: lo de fuera
  // se dobla hacia el canto.
  const face = c * 0.86;
  if (look.ring) {
    ctx.fillStyle = look.ring;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = look.bg;
    ctx.beginPath();
    ctx.arc(c, c, face * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  const hasText = Boolean(look.text || look.textBottom);
  const art = look.ring ? face * 1.05 : hasText ? face * 0.92 : face * 1.2;
  ctx.fillStyle = ink;
  if (look.logo && logo) {
    ctx.drawImage(
      tintedLogo(logo, ink, 400),
      c - art / 2,
      c - art / 2,
      art,
      art,
    );
  } else if (look.glyph) {
    fillGlyph(ctx, look.glyph, c, c, art * 0.86);
  }

  // Sobre el aro, el texto va en el color del fondo; sin aro, en la tinta.
  ctx.fillStyle = look.ring ? look.bg : ink;
  const textRadius = look.ring ? face * 0.85 : face * 0.8;
  const fontSize = look.ring ? face * 0.2 : face * 0.2;
  if (look.text) arcText(ctx, look.text, c, c, textRadius, true, fontSize);
  if (look.textBottom) {
    arcText(ctx, look.textBottom, c, c, textRadius, false, fontSize);
  }
  return colorTexture(canvas);
}

// ── Parche ─────────────────────────────────────────────────────────────────

/**
 * El bordado: fondo de hilo en diagonal, un borde gordo de puntadas y el
 * dibujo encima. Devuelve el color y el relieve (las puntadas se notan).
 */
export function paintParche(look: ParcheLook): {
  map: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
} {
  const { canvas, ctx } = newCanvas();
  const bump = newCanvas();
  const ink = look.ink ?? '#ffffff';
  const outline = new Path2D(glyphPath(look.shape));
  const k = SIZE / GLYPH_BOX;

  ctx.fillStyle = look.border;
  ctx.fillRect(0, 0, SIZE, SIZE);
  bump.ctx.fillStyle = '#808080';
  bump.ctx.fillRect(0, 0, SIZE, SIZE);

  // Fondo, algo metido hacia dentro para dejar sitio al borde.
  const inset = (c2d: CanvasRenderingContext2D) => {
    c2d.translate(SIZE / 2, SIZE / 2);
    c2d.scale(0.84, 0.84);
    c2d.translate(-SIZE / 2, -SIZE / 2);
    c2d.scale(k, k);
  };
  ctx.save();
  inset(ctx);
  ctx.fillStyle = look.bg;
  ctx.fill(outline);
  ctx.restore();
  bump.ctx.save();
  inset(bump.ctx);
  bump.ctx.fillStyle = '#5a5a5a';
  bump.ctx.fill(outline);
  bump.ctx.restore();

  // Hilo: rayas finas en diagonal por toda la pieza.
  for (const target of [ctx, bump.ctx]) {
    target.save();
    target.lineWidth = 2;
    for (let i = -SIZE; i < SIZE * 2; i += 6) {
      target.strokeStyle =
        target === ctx
          ? i % 12 === 0
            ? 'rgba(255,255,255,0.10)'
            : 'rgba(0,0,0,0.10)'
          : i % 12 === 0
            ? 'rgba(255,255,255,0.35)'
            : 'rgba(0,0,0,0.35)';
      target.beginPath();
      target.moveTo(i, 0);
      target.lineTo(i + SIZE * 0.5, SIZE);
      target.stroke();
    }
    target.restore();
  }

  // Dibujo y texto, bordados encima.
  ctx.fillStyle = ink;
  bump.ctx.fillStyle = '#c8c8c8';
  const isWide = look.shape === 'arrow' || look.shape === 'rect';
  if (look.glyph) {
    const size = look.text ? SIZE * 0.3 : SIZE * 0.44;
    const cy = look.text && !isWide ? SIZE * 0.4 : SIZE / 2;
    const cx = look.text && isWide ? SIZE * 0.26 : SIZE / 2;
    for (const target of [ctx, bump.ctx]) {
      fillGlyph(
        target,
        look.glyph,
        cx,
        cy,
        isWide && look.text ? SIZE * 0.2 : size,
      );
    }
  }
  if (look.text) {
    const str = look.text.toUpperCase();
    const cx = look.glyph && isWide ? SIZE * 0.56 : SIZE / 2;
    const cy = look.glyph && !isWide ? SIZE * 0.68 : SIZE / 2;
    const maxWidth = (isWide ? (look.glyph ? 0.4 : 0.6) : 0.52) * SIZE;
    for (const target of [ctx, bump.ctx]) {
      let fontSize = SIZE * 0.13;
      target.font = `800 ${fontSize}px ${FONT}`;
      const measured = target.measureText(str).width;
      if (measured > maxWidth) fontSize *= maxWidth / measured;
      target.font = `800 ${fontSize}px ${FONT}`;
      target.textAlign = 'center';
      target.textBaseline = 'middle';
      target.fillText(str, cx, cy);
    }
  }
  const bumpTex = new THREE.CanvasTexture(bump.canvas);
  return { map: colorTexture(canvas), bump: bumpTex };
}

// ── Cinta ──────────────────────────────────────────────────────────────────

/** Rayas a lo largo y el acanalado del gros-grain a lo ancho. */
export function paintRibbon(colors: string[]): {
  map: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
} {
  const stripes = colors.length > 0 ? colors.slice(0, 7) : ['#ffffff'];
  const { canvas, ctx } = newCanvas(128, 256);
  const w = 128 / stripes.length;
  stripes.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(i * w), 0, Math.ceil(w) + 1, 256);
  });
  const bump = newCanvas(8, 256);
  for (let y = 0; y < 256; y++) {
    const v = Math.round(128 + 110 * Math.sin((y / 256) * Math.PI * 2 * 40));
    bump.ctx.fillStyle = `rgb(${v},${v},${v})`;
    bump.ctx.fillRect(0, y, 8, 1);
  }
  const bumpTex = new THREE.CanvasTexture(bump.canvas);
  return { map: colorTexture(canvas), bump: bumpTex };
}

// ── Medalla ────────────────────────────────────────────────────────────────

/**
 * La cara de una medalla. Con imagen, la imagen; sin ella, el relieve del
 * dibujo (o del logo) acuñado en el metal: blanco sube, negro baja.
 */
export function paintMedalFace(
  look: MedallaLook,
  logo: HTMLImageElement | null,
  image: HTMLImageElement | null,
): { map: THREE.CanvasTexture | null; bump: THREE.CanvasTexture | null } {
  if (image) {
    const { canvas, ctx } = newCanvas();
    const side = Math.min(image.width, image.height);
    ctx.drawImage(
      image,
      (image.width - side) / 2,
      (image.height - side) / 2,
      side,
      side,
      0,
      0,
      SIZE,
      SIZE,
    );
    return { map: colorTexture(canvas), bump: null };
  }
  const { canvas, ctx } = newCanvas();
  const c = SIZE / 2;
  ctx.fillStyle = '#707070';
  ctx.fillRect(0, 0, SIZE, SIZE);
  // Corona de rayos finos alrededor: da textura de moneda.
  ctx.strokeStyle = '#8c8c8c';
  ctx.lineWidth = 3;
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * c * 0.7, c + Math.sin(a) * c * 0.7);
    ctx.lineTo(c + Math.cos(a) * c * 0.84, c + Math.sin(a) * c * 0.84);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(255,255,255,0.6)';
  ctx.shadowBlur = 8;
  if (look.logo && logo) {
    const s = c * 1.14;
    ctx.drawImage(tintedLogo(logo, '#ffffff', 400), c - s / 2, c - s / 2, s, s);
  } else {
    fillGlyph(ctx, look.glyph ?? 'star', c, c, c * 1.0);
  }
  return { map: null, bump: new THREE.CanvasTexture(canvas) };
}

/** Degradado de arriba abajo para el esmalte de dos colores. */
export function paintEnamel(top: string, bottom: string): THREE.CanvasTexture {
  const { canvas, ctx } = newCanvas(8, 128);
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0.1, top);
  g.addColorStop(0.9, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 128);
  return colorTexture(canvas);
}
