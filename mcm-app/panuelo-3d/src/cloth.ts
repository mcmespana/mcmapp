/**
 * El pañuelo: geometría y tela.
 *
 * No hay modelo `.glb`: el pañuelo se calcula. Es un pañuelo PUESTO —el rollo
 * alrededor del cuello, el nudo delante con sus dos puntas y el triángulo
 * cayendo por la espalda—, sin cuerpo debajo. Calcularlo en vez de modelarlo
 * tiene dos ventajas: pesa cero bytes, y la misma fórmula que dibuja el
 * triángulo dice dónde y con qué inclinación va cosida cada pieza
 * (`flapPoint`).
 *
 * Unidades: 1 ≈ 15 cm. El triángulo mira a +Z (hacia la cámara al abrir).
 */
import * as THREE from 'three';

import { PanueloColors } from '@/constants/colors';
import type { PanueloColor } from '@/types/panuelo';
import { FLAP_HEIGHT, FLAP_WIDTH } from '@/utils/panueloPlacement';

// ── Medidas ────────────────────────────────────────────────────────────────

/**
 * El recorrido del rollo: de la nuca, por encima de los hombros, hasta el
 * nudo del pecho, y vuelta. Diez puntos; la curva pasa por todos.
 */
const HALF_RING: [number, number, number][] = [
  [0.72, -0.07, 0.56],
  [1.3, -0.26, 0.34], // el hombro
  [1.22, -0.5, -0.12],
  [0.62, -0.84, -0.5],
];
const NAPE: [number, number, number] = [0, 0, 0.62];
const KNOT_AT: [number, number, number] = [0, -1.05, -0.62];
const v3 = ([x, y, z]: [number, number, number], mirror = false) =>
  new THREE.Vector3(mirror ? -x : x, y, z);
const RING = new THREE.CatmullRomCurve3(
  [
    v3(NAPE),
    ...HALF_RING.map((p) => v3(p)),
    v3(KNOT_AT),
    ...HALF_RING.map((p) => v3(p, true)).reverse(),
  ],
  true,
  'centripetal',
);
/** En qué tramo de la curva está el hombro (el punto 2 de 10). */
const SHOULDER = 2 / 10;
/** El pico del triángulo. */
const TIP = new THREE.Vector3(0, -1.8, 0.66);

/** Caja que hay que encuadrar (el pañuelo entero, con algo de aire). */
export const BOUNDS = {
  center: new THREE.Vector3(0, -0.86, 0),
  width: 3.25,
  height: 2.45,
};

const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/** Un punto del rollo. k = 0 es la nuca; k = 0,5, el nudo. */
function ringPoint(k: number, out = new THREE.Vector3()): THREE.Vector3 {
  return RING.getPoint(((k % 1) + 1) % 1, out);
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();

/** El triángulo liso: del arco del cuello al pico, algo abombado. */
function flapBase(s: number, t: number, out: THREE.Vector3): THREE.Vector3 {
  // El triángulo cuelga del tramo trasero del rollo, de hombro a hombro.
  ringPoint(s * SHOULDER, out);
  // El rollo tapa el arranque: la tela sale de un poco más abajo.
  out.y -= 0.02;
  out.lerp(TIP, t);
  // Los omóplatos: la tela se abomba a media altura.
  out.z += 0.09 * Math.sin(Math.PI * Math.pow(t, 0.8)) * (1 - 0.6 * s * s);
  return out;
}

/** Las arrugas: pliegues suaves que bajan del cuello y se abren hacia abajo. */
function wrinkle(s: number, t: number): number {
  // Cerca del pico los pliegues se apagan: ahí «s» ya no significa nada.
  const env = smooth(0.04, 0.4, t) * (1 - smooth(0.6, 0.97, t));
  const folds =
    0.04 * Math.sin(5.2 * s + 2.4 * t + 0.5) +
    0.02 * Math.sin(11.5 * s - 5 * t + 1.9) +
    0.012 * Math.sin(3.1 * s + 9 * t);
  // El dobladillo se levanta un poco en los bordes.
  const hem = 0.022 * smooth(0.8, 1, Math.abs(s)) * (1 - t);
  return env * folds + hem;
}

const EPS = 0.004;

/**
 * Un punto del triángulo y su orientación.
 *
 * @param s de −1 (borde izquierdo) a 1 (borde derecho)
 * @param t de 0 (cuello) a 1 (pico)
 */
export function flapPoint(
  s: number,
  t: number,
): { position: THREE.Vector3; normal: THREE.Vector3; up: THREE.Vector3 } {
  const tt = Math.min(0.985, Math.max(0, t));
  const base = (ss: number, t2: number, out: THREE.Vector3) => {
    flapBase(ss, t2, out);
    // Normal aproximada del triángulo liso, para empujar las arrugas.
    flapBase(ss + EPS, t2, _a).sub(out);
    flapBase(ss, t2 + EPS, _b).sub(out);
    _c.crossVectors(_b, _a).normalize();
    return out.addScaledVector(_c, wrinkle(ss, t2));
  };
  const position = base(s, tt, new THREE.Vector3());
  const ds = base(s + EPS, tt, new THREE.Vector3()).sub(position);
  const dt = base(s, tt + EPS, new THREE.Vector3()).sub(position);
  const normal = new THREE.Vector3().crossVectors(dt, ds).normalize();
  // «Arriba» de la pieza: hacia el cuello, pegado a la tela.
  const up = dt.multiplyScalar(-1);
  up.addScaledVector(normal, -up.dot(normal)).normalize();
  return { position, normal, up };
}

/** Coordenadas de textura de un punto del triángulo (y su inversa). */
export function flapUv(s: number, t: number): [number, number] {
  return [0.5 + 0.5 * s * (1 - t), t];
}
export function uvToFlap(u: number, v: number): [number, number] {
  const t = Math.min(0.985, Math.max(0, v));
  return [(2 * u - 1) / (1 - t), t];
}

// ── Geometría ──────────────────────────────────────────────────────────────

function buildFlapGeometry(): THREE.BufferGeometry {
  const NS = 84;
  const NT = 76;
  const positions: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  for (let j = 0; j <= NT; j++) {
    const t = (j / NT) * 0.999;
    for (let i = 0; i <= NS; i++) {
      const s = (i / NS) * 2 - 1;
      const p = flapPoint(s, t).position;
      positions.push(p.x, p.y, p.z);
      const [u, v] = flapUv(s, t);
      uvs.push(u, v);
    }
  }
  const row = NS + 1;
  for (let j = 0; j < NT; j++) {
    for (let i = 0; i < NS; i++) {
      const a = j * row + i;
      index.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/**
 * Un tubo de sección elíptica a lo largo de una curva, con surcos en espiral
 * (la tela enrollada). `shape(k)` da el semiancho y el semigrosor en cada
 * punto, y con eso salen el rollo del cuello y las dos puntas.
 */
function buildRoll(opts: {
  point: (k: number, out: THREE.Vector3) => THREE.Vector3;
  /** Hacia dónde mira el «ancho» de la sección en cada punto. */
  side: (k: number, tangent: THREE.Vector3, out: THREE.Vector3) => void;
  shape: (k: number) => [number, number];
  segments: number;
  closed: boolean;
  twist: number;
  uvRepeat: number;
}): THREE.BufferGeometry {
  const { segments, closed } = opts;
  const RADIAL = 16;
  const positions: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  const p = new THREE.Vector3();
  const p2 = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const side = new THREE.Vector3();
  const up = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const k = i / segments;
    opts.point(k, p);
    opts.point(Math.min(1, k + 0.002), p2);
    tangent.copy(p2).sub(p);
    if (tangent.lengthSq() < 1e-12) {
      opts.point(k - 0.002, p2);
      tangent.copy(p).sub(p2);
    }
    tangent.normalize();
    opts.side(k, tangent, side);
    side.addScaledVector(tangent, -side.dot(tangent)).normalize();
    up.crossVectors(tangent, side).normalize();
    const [a, b] = opts.shape(k);
    for (let j = 0; j <= RADIAL; j++) {
      const phi = (j / RADIAL) * Math.PI * 2;
      const groove =
        1 + 0.13 * Math.sin(2 * phi + opts.twist * k * Math.PI * 2);
      const x = Math.cos(phi) * a * groove;
      const y = Math.sin(phi) * b * groove;
      positions.push(
        p.x + side.x * x + up.x * y,
        p.y + side.y * x + up.y * y,
        p.z + side.z * x + up.z * y,
      );
      uvs.push(k * opts.uvRepeat, j / RADIAL);
    }
  }
  const row = RADIAL + 1;
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < RADIAL; j++) {
      const a = i * row + j;
      index.push(a, a + 1, a + row, a + 1, a + row + 1, a + row);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  if (closed) weldSeam(g, segments, row);
  return g;
}

/** En un tubo cerrado, la primera y la última sección comparten normales. */
function weldSeam(g: THREE.BufferGeometry, segments: number, row: number) {
  const n = g.getAttribute('normal') as THREE.BufferAttribute;
  for (let j = 0; j < row; j++) {
    const a = j;
    const b = segments * row + j;
    const x = n.getX(a) + n.getX(b);
    const y = n.getY(a) + n.getY(b);
    const z = n.getZ(a) + n.getZ(b);
    const len = Math.hypot(x, y, z) || 1;
    n.setXYZ(a, x / len, y / len, z / len);
    n.setXYZ(b, x / len, y / len, z / len);
  }
}

const KNOT = ringPoint(0.5);

function buildCollar(): THREE.BufferGeometry {
  const center = new THREE.Vector3(0, -0.5, 0);
  return buildRoll({
    point: (k, out) => ringPoint(k, out),
    // La sección se tumba sobre el cuerpo: su «ancho» mira hacia fuera.
    side: (k, _t, out) => {
      ringPoint(k, out).sub(center);
      out.y *= 0.3;
    },
    shape: (k) => {
      // Gordo en la nuca (lleva más vueltas), fino al llegar al nudo.
      const front = 1 - Math.abs(1 - 2 * k);
      const thick = 0.082 - 0.03 * smooth(0.3, 1, front);
      return [thick * 0.9, thick * 1.05];
    },
    segments: 200,
    closed: true,
    twist: 16,
    uvRepeat: 40,
  });
}

function buildTail(sign: 1 | -1): THREE.BufferGeometry {
  const start = KNOT.clone().add(new THREE.Vector3(sign * 0.03, -0.05, -0.02));
  const ctrl = KNOT.clone().add(new THREE.Vector3(sign * 0.06, -0.3, -0.14));
  const end = KNOT.clone().add(new THREE.Vector3(sign * 0.2, -0.5, -0.05));
  const curve = new THREE.QuadraticBezierCurve3(start, ctrl, end);
  return buildRoll({
    point: (k, out) => curve.getPoint(k, out),
    side: (k, _t, out) => {
      // La punta se va girando según cae.
      const angle = sign * (0.3 + 0.9 * k);
      out.set(Math.cos(angle), 0, Math.sin(angle));
    },
    shape: (k) => {
      const a = 0.085 * (1 - Math.pow(k, 1.6)) + 0.004;
      return [a, a * 0.34 + 0.006];
    },
    segments: 44,
    closed: false,
    twist: 1.5,
    uvRepeat: 12,
  });
}

function buildKnot(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 28, 20);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // Un nudo no es una bola: tiene bultos donde la tela se cruza.
    const lump =
      1 + 0.1 * Math.sin(5 * x + 2 * y) * Math.cos(4 * y - 3 * z) + 0.06 * y;
    pos.setXYZ(i, x * 0.14 * lump, y * 0.115 * lump, z * 0.11 * lump);
  }
  g.computeVertexNormals();
  g.translate(KNOT.x, KNOT.y - 0.01, KNOT.z - 0.015);
  return g;
}

// ── Tela ───────────────────────────────────────────────────────────────────

/** Mapa de normales de un tejido liso (trama y urdimbre), que se repite. */
function makeWeaveNormalMap(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const threads = 8;
  const height = (x: number, y: number) => {
    const fx = (x / size) * threads * Math.PI * 2;
    const fy = (y / size) * threads * Math.PI * 2;
    return (
      Math.sin(fx) * Math.cos(fy * 0.5) + Math.sin(fy) * Math.cos(fx * 0.5)
    );
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = height(x + 1, y) - height(x - 1, y);
      const dy = height(x, y + 1) - height(x, y - 1);
      const n = new THREE.Vector3(-dx * 0.55, -dy * 0.55, 1).normalize();
      const i = (y * size + x) * 4;
      img.data[i] = (n.x * 0.5 + 0.5) * 255;
      img.data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      img.data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

const TEX = 1024;

/** Pseudoaleatorio con semilla: la misma mancha en cada apertura. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/**
 * La textura del triángulo: el color de la tela, un moteado muy leve, el
 * pespunte del dobladillo y el logo serigrafiado cerca del pico.
 */
function paintFlap(
  ctx: CanvasRenderingContext2D,
  color: PanueloColor,
  logo: HTMLImageElement | null,
) {
  const cloth = PanueloColors.cloth[color];
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = cloth;
  ctx.fillRect(0, 0, TEX, TEX);

  // Moteado: una tela teñida no es un color plano.
  const rnd = seeded(7);
  for (let i = 0; i < 220; i++) {
    const x = rnd() * TEX;
    const y = rnd() * TEX;
    const r = 30 + rnd() * 110;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const tone = rnd() > 0.5 ? '255,255,255' : '0,0,0';
    g.addColorStop(0, `rgba(${tone},0.035)`);
    g.addColorStop(1, `rgba(${tone},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Dobladillo: los dos lados largos, de las esquinas de arriba al pico.
  const hem = (x0: number, inset: number) => {
    ctx.beginPath();
    ctx.moveTo(x0 + inset, 0);
    ctx.lineTo(TEX / 2 + inset * 0.2, TEX);
  };
  for (const side of [1, -1] as const) {
    const x0 = side === 1 ? 0 : TEX;
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(0,0,0,0.10)';
    ctx.lineWidth = 34;
    hem(x0, side * 8);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 2.2;
    ctx.setLineDash([9, 7]);
    hem(x0, side * 30);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  if (logo) {
    // El triángulo mide FLAP_WIDTH × FLAP_HEIGHT y la textura es cuadrada:
    // el logo se pinta estirado a lo alto para que cosido salga redondo.
    const w = 218;
    const h = (w * FLAP_WIDTH) / FLAP_HEIGHT;
    const tint = document.createElement('canvas');
    tint.width = tint.height = 512;
    const tctx = tint.getContext('2d')!;
    tctx.fillStyle = PanueloColors.print[color];
    tctx.fillRect(0, 0, 512, 512);
    tctx.globalCompositeOperation = 'destination-in';
    tctx.drawImage(logo, 0, 0, 512, 512);
    // La serigrafía no cubre del todo: se le ve el grano de la tela.
    tctx.globalCompositeOperation = 'destination-out';
    const grain = seeded(3);
    for (let i = 0; i < 2600; i++) {
      tctx.fillStyle = `rgba(0,0,0,${0.25 + grain() * 0.4})`;
      tctx.fillRect(grain() * 512, grain() * 512, 1.6, 1.6);
    }
    ctx.globalAlpha = 0.95;
    ctx.drawImage(tint, TEX / 2 - w / 2, TEX * 0.6 - h / 2, w, h);
    ctx.globalAlpha = 1;
  }
}

export interface Panuelo {
  group: THREE.Group;
  /** El triángulo: es donde se cosen las piezas y lo que se toca al arrastrar. */
  flap: THREE.Mesh;
  setColor(color: PanueloColor): void;
  setLogo(logo: HTMLImageElement): void;
}

export function createPanuelo(
  color: PanueloColor,
  maxAnisotropy: number,
): Panuelo {
  const weave = makeWeaveNormalMap();

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TEX;
  const ctx = canvas.getContext('2d')!;
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.flipY = false;
  map.anisotropy = Math.min(8, maxAnisotropy);

  const flapWeave = weave.clone();
  flapWeave.repeat.set(FLAP_WIDTH * 24, FLAP_HEIGHT * 24);
  flapWeave.needsUpdate = true;

  const common = {
    roughness: 0.9,
    metalness: 0,
    sheen: 0.2,
    sheenRoughness: 0.5,
    side: THREE.DoubleSide,
    normalScale: new THREE.Vector2(0.2, 0.2),
  } as const;

  // La serigrafía va solo por fuera: el revés es tela lisa.
  const flapMaterial = new THREE.MeshPhysicalMaterial({
    ...common,
    side: THREE.FrontSide,
    map,
    normalMap: flapWeave,
  });
  const flapBackMaterial = new THREE.MeshPhysicalMaterial({
    ...common,
    side: THREE.BackSide,
    normalMap: flapWeave,
  });
  const rollWeave = weave.clone();
  rollWeave.repeat.set(4, 6);
  rollWeave.needsUpdate = true;
  const rollMaterial = new THREE.MeshPhysicalMaterial({
    ...common,
    normalMap: rollWeave,
  });

  const flap = new THREE.Mesh(buildFlapGeometry(), flapMaterial);
  flap.receiveShadow = true;
  flap.castShadow = true;

  const flapBack = new THREE.Mesh(flap.geometry, flapBackMaterial);
  flapBack.receiveShadow = true;

  const group = new THREE.Group();
  group.add(flap, flapBack);
  for (const geometry of [
    buildCollar(),
    buildKnot(),
    buildTail(1),
    buildTail(-1),
  ]) {
    const mesh = new THREE.Mesh(geometry, rollMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  let current = color;
  let logoImage: HTMLImageElement | null = null;
  const repaint = () => {
    paintFlap(ctx, current, logoImage);
    map.needsUpdate = true;
    const base = new THREE.Color(PanueloColors.cloth[current]);
    rollMaterial.color.copy(base);
    // El revés, un punto más oscuro: ahí no da la luz igual.
    flapBackMaterial.color.copy(base).multiplyScalar(0.82);
    const sheen = base.clone().lerp(new THREE.Color('#ffffff'), 0.3);
    for (const m of [flapMaterial, flapBackMaterial, rollMaterial]) {
      m.sheenColor.copy(sheen);
    }
  };
  repaint();

  return {
    group,
    flap,
    setColor(next) {
      current = next;
      repaint();
    },
    setLogo(logo) {
      logoImage = logo;
      repaint();
    },
  };
}
