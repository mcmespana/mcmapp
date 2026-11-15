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
  PulseraLook,
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

/** Generador pseudoaleatorio con semilla: el bordado sale igual siempre. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** Lo que `layer` pinta, recortado a la forma (el alfa) de `mask`. */
function masked(
  mask: HTMLCanvasElement,
  layer: (c: CanvasRenderingContext2D) => void,
): HTMLCanvasElement {
  const { canvas, ctx } = newCanvas();
  layer(ctx);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(mask, 0, 0);
  return canvas;
}

/** Rayas paralelas por todo el lienzo: la sarga, el sentido del satén. */
function stripes(
  c: CanvasRenderingContext2D,
  deg: number,
  period: number,
  width: number,
  light: string,
  dark: string,
  jitter: number,
  seed: number,
) {
  const rnd = seeded(seed);
  c.save();
  c.translate(SIZE / 2, SIZE / 2);
  c.rotate((deg * Math.PI) / 180);
  c.lineWidth = width;
  for (let x = -SIZE; x <= SIZE; x += period) {
    for (const [dx, color] of [
      [0, light],
      [period / 2, dark],
    ] as const) {
      c.globalAlpha = 1 - jitter * rnd();
      c.strokeStyle = color;
      c.beginPath();
      c.moveTo(x + dx, -SIZE);
      c.lineTo(x + dx, SIZE);
      c.stroke();
    }
  }
  c.restore();
}

/**
 * El bordado: fondo de sarga, ribete grueso de puntadas en satén y el dibujo
 * encima, también en satén y con su sombra. Devuelve el color y el relieve.
 */
export function paintParche(look: ParcheLook): {
  map: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
} {
  const ink = look.ink ?? '#ffffff';
  const outline = new Path2D(glyphPath(look.shape));
  const k = SIZE / GLYPH_BOX;
  const isWide = look.shape === 'arrow' || look.shape === 'rect';
  const BW = SIZE * (isWide ? 0.05 : 0.062); // ancho del ribete, en px

  const color = newCanvas();
  const bump = newCanvas();
  const c = color.ctx;
  const b = bump.ctx;

  // Máscaras: toda la forma, la parte de dentro (sin ribete) y el ribete.
  const whole = newCanvas();
  whole.ctx.scale(k, k);
  whole.ctx.fill(outline, 'evenodd');
  const innerM = newCanvas();
  innerM.ctx.scale(k, k);
  innerM.ctx.fill(outline, 'evenodd');
  innerM.ctx.globalCompositeOperation = 'destination-out';
  innerM.ctx.lineJoin = 'round';
  innerM.ctx.lineWidth = (2 * BW) / k;
  innerM.ctx.stroke(outline);
  const band = newCanvas();
  band.ctx.drawImage(whole.canvas, 0, 0);
  band.ctx.globalCompositeOperation = 'destination-out';
  band.ctx.drawImage(innerM.canvas, 0, 0);

  /** Puntadas perpendiculares al canto: un trazo gordo y a rayas. */
  const stitches = (
    t: CanvasRenderingContext2D,
    lit: string,
    gap: string,
    base: string,
  ) => {
    t.save();
    t.scale(k, k);
    t.lineJoin = 'round';
    t.lineCap = 'butt';
    t.lineWidth = (2 * BW) / k;
    t.strokeStyle = base;
    t.stroke(outline);
    t.setLineDash([2.6 / k, 2.6 / k]);
    t.strokeStyle = gap;
    t.lineDashOffset = -2.6 / k;
    t.stroke(outline);
    t.strokeStyle = lit;
    t.lineDashOffset = 0;
    t.stroke(outline);
    t.restore();
  };

  // ── Color ──
  c.fillStyle = look.border;
  c.fillRect(0, 0, SIZE, SIZE);
  c.drawImage(
    masked(band.canvas, (t) =>
      stitches(t, 'rgba(255,255,255,0.16)', 'rgba(0,0,0,0.22)', look.border),
    ),
    0,
    0,
  );
  // Un brillo suave por el centro del ribete: el hilo redondea.
  const sheen = masked(band.canvas, (t) => {
    t.scale(k, k);
    t.lineWidth = BW / k;
    t.lineJoin = 'round';
    t.strokeStyle = 'rgba(255,255,255,0.10)';
    t.stroke(outline);
  });
  // (el trazo centrado en el canto cae medio dentro del ribete)
  c.drawImage(sheen, 0, 0);

  // Fondo: sarga en diagonal.
  const bgLayer = masked(innerM.canvas, (t) => {
    t.fillStyle = look.bg;
    t.fillRect(0, 0, SIZE, SIZE);
    stripes(
      t,
      45,
      5,
      2.4,
      'rgba(255,255,255,0.15)',
      'rgba(0,0,0,0.20)',
      0.5,
      7,
    );
    stripes(
      t,
      -45,
      22,
      1,
      'rgba(255,255,255,0.05)',
      'rgba(0,0,0,0.05)',
      0.7,
      3,
    );
  });
  c.drawImage(bgLayer, 0, 0);
  // Sombra del ribete sobre el fondo: el ribete es más gordo.
  c.drawImage(
    masked(innerM.canvas, (t) => {
      t.shadowColor = 'rgba(0,0,0,0.6)';
      t.shadowBlur = 9;
      t.drawImage(band.canvas, 0, 0);
    }),
    0,
    0,
  );

  // El dibujo en satén.
  const design = (t: CanvasRenderingContext2D, fill: string) => {
    t.fillStyle = fill;
    t.strokeStyle = fill;
    if (look.glyph) {
      const size = look.text ? SIZE * 0.3 : SIZE * 0.44;
      const cy = look.text && !isWide ? SIZE * 0.4 : SIZE / 2;
      const cx = look.text && isWide ? SIZE * 0.26 : SIZE / 2;
      const gs = isWide && look.text ? SIZE * 0.2 : size;
      fillGlyph(t, look.glyph, cx, cy, gs);
      t.save();
      t.lineWidth = 3;
      t.lineJoin = 'round';
      fillGlyph(t, look.glyph, cx, cy, gs, 'stroke');
      t.restore();
    }
    if (look.text) {
      const str = look.text.toUpperCase();
      const cx = look.glyph && isWide ? SIZE * 0.56 : SIZE / 2;
      const cy = look.glyph && !isWide ? SIZE * 0.68 : SIZE / 2;
      const maxWidth = (isWide ? (look.glyph ? 0.4 : 0.6) : 0.52) * SIZE;
      let fontSize = SIZE * 0.13;
      t.font = `800 ${fontSize}px ${FONT}`;
      const measured = t.measureText(str).width;
      if (measured > maxWidth) fontSize *= maxWidth / measured;
      t.font = `800 ${fontSize}px ${FONT}`;
      t.textAlign = 'center';
      t.textBaseline = 'middle';
      t.lineWidth = fontSize * 0.06;
      t.lineJoin = 'round';
      t.fillText(str, cx, cy);
      t.strokeText(str, cx, cy);
    }
  };
  const artMask = newCanvas();
  design(artMask.ctx, '#000');
  const art = masked(artMask.canvas, (t) => {
    t.fillStyle = ink;
    t.fillRect(0, 0, SIZE, SIZE);
    stripes(t, 62, 4, 2, 'rgba(255,255,255,0.28)', 'rgba(0,0,0,0.26)', 0.4, 11);
  });
  // Un filo oscuro bajo el hilo y la sombra que echa sobre el fondo.
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.55)';
  c.shadowBlur = 5;
  c.shadowOffsetX = 1.5;
  c.shadowOffsetY = 3;
  c.drawImage(art, 0, 0);
  c.restore();
  // Canto de tela cortada, apenas un filo oscuro por fuera.
  c.save();
  c.scale(k, k);
  c.clip(outline, 'evenodd');
  c.lineWidth = 4 / k;
  c.strokeStyle = 'rgba(0,0,0,0.28)';
  c.stroke(outline);
  c.restore();

  // ── Relieve ──
  b.fillStyle = '#707070';
  b.fillRect(0, 0, SIZE, SIZE);
  b.drawImage(
    masked(band.canvas, (t) => stitches(t, '#c6c6c6', '#909090', '#a8a8a8')),
    0,
    0,
  );
  b.drawImage(
    masked(innerM.canvas, (t) => {
      t.fillStyle = '#707070';
      t.fillRect(0, 0, SIZE, SIZE);
      stripes(t, 45, 5, 2.4, '#8e8e8e', '#555555', 0.4, 7);
    }),
    0,
    0,
  );
  b.save();
  b.shadowColor = '#c0c0c0';
  b.shadowBlur = 3;
  b.drawImage(
    masked(artMask.canvas, (t) => {
      t.fillStyle = '#b4b4b4';
      t.fillRect(0, 0, SIZE, SIZE);
      stripes(t, 62, 4, 2, '#e0e0e0', '#8a8a8a', 0.3, 11);
    }),
    0,
    0,
  );
  b.restore();

  return {
    map: colorTexture(color.canvas),
    bump: (() => {
      const tex = new THREE.CanvasTexture(bump.canvas);
      tex.anisotropy = 4;
      return tex;
    })(),
  };
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

/**
 * Cinta de gros-grain para la cinta suelta: costillas finas a lo ancho (cada
 * una con su luz y su sombra), orillos tejidos y el hilo vertical de la
 * urdimbre. 128 × 512; v = 1 arriba.
 */
export function paintGrosgrain(colors: string[]): {
  map: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
} {
  const W = 128;
  const H = 512;
  const P = 8; // alto de una costilla
  const stripeColors = colors.length > 0 ? colors.slice(0, 7) : ['#ffffff'];
  const { canvas, ctx } = newCanvas(W, H);
  const sw = W / stripeColors.length;
  stripeColors.forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.fillRect(Math.floor(i * sw), 0, Math.ceil(sw) + 1, H);
  });
  // Costillas: la parte alta de cada una recoge luz, la baja queda en sombra.
  const rib = newCanvas(W, P);
  const g = rib.ctx.createLinearGradient(0, 0, 0, P);
  g.addColorStop(0, 'rgba(255,255,255,0.26)');
  g.addColorStop(0.45, 'rgba(255,255,255,0)');
  g.addColorStop(0.75, 'rgba(0,0,0,0.10)');
  g.addColorStop(1, 'rgba(0,0,0,0.30)');
  rib.ctx.fillStyle = g;
  rib.ctx.fillRect(0, 0, W, P);
  ctx.fillStyle = ctx.createPattern(rib.canvas, 'repeat')!;
  ctx.fillRect(0, 0, W, H);
  // Urdimbre: hilos finos verticales de brillo desigual.
  const rnd = seeded(5);
  for (let x = 0; x < W; x++) {
    ctx.fillStyle =
      rnd() > 0.5
        ? `rgba(255,255,255,${0.02 + 0.07 * rnd()})`
        : `rgba(0,0,0,${0.02 + 0.07 * rnd()})`;
    ctx.fillRect(x, 0, 1, H);
  }
  // Filo oscuro entre franjas y orillos algo más tupidos.
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  for (let i = 1; i < stripeColors.length; i++) {
    ctx.fillRect(Math.floor(i * sw), 0, 1, H);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.20)';
  ctx.fillRect(2, 0, 2, H);
  ctx.fillRect(W - 4, 0, 2, H);
  ctx.fillStyle = 'rgba(0,0,0,0.20)';
  ctx.fillRect(0, 0, 2, H);
  ctx.fillRect(W - 2, 0, 2, H);
  ctx.fillRect(4, 0, 1, H);
  ctx.fillRect(W - 5, 0, 1, H);

  // Relieve: costillas redondeadas, orillos más altos, urdimbre suave.
  const BW = 64;
  const bump = newCanvas(BW, H);
  const rnd2 = seeded(9);
  const warp = Array.from({ length: BW }, () => (rnd2() - 0.5) * 16);
  for (let y = 0; y < H; y++) {
    const ribV = 128 + 80 * Math.sin(((y % P) / P) * Math.PI * 2);
    for (let x = 0; x < BW; x++) {
      const edge = x < 3 || x >= BW - 3 ? 38 : 0;
      const v = Math.max(0, Math.min(255, Math.round(ribV + warp[x] + edge)));
      bump.ctx.fillStyle = `rgb(${v},${v},${v})`;
      bump.ctx.fillRect(x, y, 1, 1);
    }
  }
  const bumpTex = new THREE.CanvasTexture(bump.canvas);
  bumpTex.anisotropy = 4;
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

// ── Pulsera ────────────────────────────────────────────────────────────────

/**
 * El trenzado de una pulsera de hilo, en una tira que se repite a lo largo.
 * `chevron` son las espigas de la pulsera de la amistad; `stripes`, rayas a
 * lo largo; `solid`, un solo color (el primero), con el texto si lo hay.
 */
export function paintBraid(look: PulseraLook): {
  map: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
} {
  const colors = look.colors.length > 0 ? look.colors.slice(0, 6) : ['#ffffff'];
  const W = 256;
  const H = 64;
  const { canvas, ctx } = newCanvas(W, H);
  const pattern = look.text ? 'solid' : (look.pattern ?? 'chevron');
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, W, H);
  if (pattern === 'stripes') {
    const h = H / colors.length;
    colors.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, Math.floor(i * h), W, Math.ceil(h) + 1);
    });
  } else if (pattern === 'chevron') {
    // Espigas: una «V» tumbada por color, una detrás de otra.
    const step = W / (colors.length * 2);
    ctx.lineWidth = step * 1.02;
    for (let i = -2; i < colors.length * 2 + 2; i++) {
      ctx.strokeStyle =
        colors[((i % colors.length) + colors.length) % colors.length];
      ctx.beginPath();
      ctx.moveTo(i * step - H / 2, -4);
      ctx.lineTo(i * step, H / 2);
      ctx.lineTo(i * step - H / 2, H + 4);
      ctx.stroke();
    }
  }
  if (look.text) {
    ctx.fillStyle = look.ink ?? '#ffffff';
    ctx.font = `800 ${H * 0.5}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(look.text.toUpperCase(), W / 2, H / 2 + 1, W * 0.92);
  }
  const map = colorTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  // Con texto, la tira se repite menos veces para que se lea.
  if (look.text) map.repeat.set(3 / 9, 1);

  // Relieve: los hilos, en diagonal.
  const bump = newCanvas(64, 64);
  bump.ctx.fillStyle = '#808080';
  bump.ctx.fillRect(0, 0, 64, 64);
  bump.ctx.lineWidth = 3;
  for (let i = -64; i < 128; i += 8) {
    bump.ctx.strokeStyle = '#e0e0e0';
    bump.ctx.beginPath();
    bump.ctx.moveTo(i, 0);
    bump.ctx.lineTo(i + 32, 64);
    bump.ctx.stroke();
    bump.ctx.strokeStyle = '#303030';
    bump.ctx.beginPath();
    bump.ctx.moveTo(i + 4, 0);
    bump.ctx.lineTo(i + 36, 64);
    bump.ctx.stroke();
  }
  const bumpTex = new THREE.CanvasTexture(bump.canvas);
  bumpTex.wrapS = bumpTex.wrapT = THREE.RepeatWrapping;
  bumpTex.repeat.set(4, 1);
  return { map, bump: bumpTex };
}
