/**
 * Las piezas del pañuelo en 3D: chapa, pin esmaltado, cinta, parche y medalla.
 *
 * Cada una se construye con su centro en el origen, apoyada en el plano XY,
 * con +Z saliendo de la tela y +Y hacia el cuello. Quien la coloca solo tiene
 * que llevarla a un punto del triángulo y orientarla.
 *
 * Tamaños en unidades del pañuelo (1 ≈ 15 cm): una chapa mide 0,30 de
 * diámetro, algo más grande que una de verdad, para que se lea en el móvil.
 */
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';

import { PanueloColors } from '@/constants/colors';
import { GLYPH_BOX, glyphPath } from '@/constants/panueloGlyphs';
import type {
  ChapaLook,
  CintaLook,
  MedallaLook,
  PanueloLook,
  PanueloMetal,
  ParcheLook,
  PinLook,
  PulseraLook,
} from '@/types/panuelo';

import {
  loadImage,
  paintBraid,
  paintChapa,
  paintEnamel,
  paintMedalFace,
  paintParche,
  paintRibbon,
} from './art';

export interface BuiltItem {
  group: THREE.Group;
  /** Radio aproximado: para tocarla, para el aro de selección y para el margen. */
  radius: number;
  /**
   * La parte que cuelga (de una medalla, de una cinta), con el origen en el
   * punto del que cuelga: el visor la balancea al girar el pañuelo.
   */
  swing?: THREE.Object3D;
  /** Cuánto se mueve: una cinta ligera, menos que un disco de metal. */
  swingGain?: number;
}

export interface BuildContext {
  logo: HTMLImageElement | null;
  /** Avisa de que algo ha cambiado (una imagen ha terminado de cargar). */
  invalidate: () => void;
}

// ── Materiales ─────────────────────────────────────────────────────────────

const metals = new Map<PanueloMetal, THREE.MeshStandardMaterial>();

function metal(kind: PanueloMetal = 'oro'): THREE.MeshStandardMaterial {
  let m = metals.get(kind);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: PanueloColors.metal[kind] ?? PanueloColors.metal.oro,
      metalness: 1,
      roughness: kind === 'negro' ? 0.38 : 0.24,
    });
    // Compartido entre piezas: no se libera al quitar una.
    m.userData.shared = true;
    metals.set(kind, m);
  }
  return m;
}

function shadowed<T extends THREE.Object3D>(obj: T): T {
  obj.castShadow = true;
  obj.receiveShadow = true;
  return obj;
}

// ── Formas ─────────────────────────────────────────────────────────────────

const svgLoader = new SVGLoader();
const shapeCache = new Map<string, THREE.Shape[]>();

/** El contorno de una forma, centrado y con el eje Y hacia arriba. */
function glyphShapes(glyph: string): THREE.Shape[] {
  const cached = shapeCache.get(glyph);
  if (cached) return cached;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"><path d="${glyphPath(glyph)}" fill="#000" fill-rule="evenodd"/></svg>`;
  const shapes: THREE.Shape[] = [];
  for (const path of svgLoader.parse(svg).paths) {
    shapes.push(...SVGLoader.createShapes(path));
  }
  shapeCache.set(glyph, shapes);
  return shapes;
}

/**
 * Una forma extruida de `size` de lado, con las UV planas (0-1 sobre la caja
 * de la forma) para poder pintarle un `<canvas>` encima. Apoyada en z = 0.
 */
function extrudeGlyph(
  glyph: string,
  size: number,
  depth: number,
  bevel: number,
): THREE.ExtrudeGeometry {
  const g = new THREE.ExtrudeGeometry(glyphShapes(glyph), {
    depth: depth / (size / GLYPH_BOX),
    bevelEnabled: bevel > 0,
    bevelThickness: (bevel * 0.7) / (size / GLYPH_BOX),
    bevelSize: bevel / (size / GLYPH_BOX),
    bevelSegments: 3,
    curveSegments: 18,
  });
  const k = size / GLYPH_BOX;
  // SVG tiene la Y hacia abajo: se voltea (y con ello el sentido de las caras).
  g.translate(-GLYPH_BOX / 2, -GLYPH_BOX / 2, 0);
  g.scale(k, -k, k);
  flipWinding(g);
  g.computeBoundingBox();
  g.translate(0, 0, -g.boundingBox!.min.z);
  const pos = g.getAttribute('position');
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / size + 0.5, pos.getY(i) / size + 0.5);
  }
  g.computeVertexNormals();
  return g;
}

/** Tras un espejo las caras quedan del revés: se les da la vuelta. */
function flipWinding(g: THREE.BufferGeometry) {
  const attrs = ['position', 'normal', 'uv']
    .map((name) => g.getAttribute(name) as THREE.BufferAttribute | undefined)
    .filter(Boolean) as THREE.BufferAttribute[];
  for (const attr of attrs) {
    const n = attr.itemSize;
    const arr = attr.array;
    for (let i = 0; i < attr.count; i += 3) {
      for (let c = 0; c < n; c++) {
        const b = (i + 1) * n + c;
        const d = (i + 2) * n + c;
        const tmp = arr[b];
        arr[b] = arr[d];
        arr[d] = tmp;
      }
    }
    attr.needsUpdate = true;
  }
}

// ── Chapa ──────────────────────────────────────────────────────────────────

const CHAPA_R = 0.15;

function chapaGeometry(): THREE.BufferGeometry {
  const profile: THREE.Vector2[] = [];
  const STEPS = 14;
  for (let i = 0; i <= STEPS; i++) {
    const r = (i / STEPS) * CHAPA_R;
    const y = 0.015 + 0.021 * Math.pow(1 - Math.pow(r / CHAPA_R, 2), 0.75);
    profile.push(new THREE.Vector2(r, y));
  }
  // El canto doblado hacia atrás.
  profile.push(new THREE.Vector2(CHAPA_R * 1.005, 0.009));
  profile.push(new THREE.Vector2(CHAPA_R * 0.985, 0.003));
  profile.push(new THREE.Vector2(CHAPA_R * 0.93, 0));
  const g = new THREE.LatheGeometry(profile, 56);
  g.rotateX(Math.PI / 2);
  const pos = g.getAttribute('position');
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, y);
    const a = Math.atan2(y, x);
    // La cara ocupa hasta el 86 % del dibujo; lo demás es el canto.
    const ur =
      z >= 0.0149 ? (r / CHAPA_R) * 0.43 : 0.43 + (1 - z / 0.015) * 0.06;
    uv.setXY(i, 0.5 + Math.cos(a) * ur, 0.5 + Math.sin(a) * ur);
  }
  g.computeVertexNormals();
  return g;
}

function buildChapa(look: ChapaLook, ctx: BuildContext): BuiltItem {
  const group = new THREE.Group();
  const face = new THREE.MeshPhysicalMaterial({
    map: paintChapa(look, ctx.logo, null),
    roughness: 0.35,
    metalness: 0,
    clearcoat: 0.8,
    clearcoatRoughness: 0.18,
    envMapIntensity: 0.7,
    side: THREE.DoubleSide,
  });
  group.add(shadowed(new THREE.Mesh(chapaGeometry(), face)));

  const back = new THREE.Mesh(
    new THREE.CircleGeometry(CHAPA_R * 0.93, 40),
    metal('plata'),
  );
  back.rotation.y = Math.PI;
  back.position.z = 0.0005;
  group.add(back);
  // El imperdible de detrás: solo se ve al darle la vuelta.
  const clasp = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.005, CHAPA_R * 1.1, 4, 8),
    metal('plata'),
  );
  clasp.rotation.z = Math.PI / 2;
  clasp.position.z = -0.004;
  group.add(clasp);

  if (look.image) {
    loadImage(look.image).then((img) => {
      if (!img) return;
      face.map?.dispose();
      face.map = paintChapa(look, ctx.logo, img);
      face.needsUpdate = true;
      ctx.invalidate();
    });
  }
  return { group, radius: CHAPA_R };
}

// ── Pin esmaltado ──────────────────────────────────────────────────────────

function buildPin(look: PinLook): BuiltItem {
  const size = 0.25;
  const geometry = extrudeGlyph(look.shape, size, 0.011, 0.01);
  const enamel = new THREE.MeshPhysicalMaterial({
    color: look.enamel2 ? '#ffffff' : look.enamel,
    map: look.enamel2 ? paintEnamel(look.enamel, look.enamel2) : null,
    roughness: 0.34,
    metalness: 0,
    clearcoat: 0.5,
    clearcoatRoughness: 0.3,
    // De frente a la luz, el esmalte se quemaba a blanco: menos reflejo.
    envMapIntensity: 0.55,
  });
  // Grupo 0: las tapas (el esmalte). Grupo 1: el bisel, que hace de filo de
  // metal alrededor.
  const mesh = shadowed(new THREE.Mesh(geometry, [enamel, metal(look.metal)]));
  const group = new THREE.Group();
  group.add(mesh);
  return { group, radius: size * 0.56 };
}

// ── Parche bordado ─────────────────────────────────────────────────────────

function buildParche(look: ParcheLook): BuiltItem {
  const wide = look.shape === 'arrow' || look.shape === 'rect';
  const size = wide ? 0.4 : 0.32;
  const geometry = extrudeGlyph(look.shape, size, 0.01, 0.003);
  const { map, bump } = paintParche(look);
  const face = new THREE.MeshPhysicalMaterial({
    map,
    bumpMap: bump,
    bumpScale: 1.6,
    roughness: 0.92,
    sheen: 0.7,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color('#ffffff'),
  });
  const side = new THREE.MeshStandardMaterial({
    color: look.border,
    roughness: 0.95,
  });
  const group = new THREE.Group();
  group.add(shadowed(new THREE.Mesh(geometry, [face, side])));
  return { group, radius: size * (wide ? 0.5 : 0.52) };
}

// ── Cinta ──────────────────────────────────────────────────────────────────

/** Una tira de cinta que cuelga desde y = 0, acabada en cola de golondrina. */
function ribbonTail(
  width: number,
  length: number,
  phase: number,
): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(width, length, 6, 22);
  g.translate(0, -length / 2, 0);
  const pos = g.getAttribute('position');
  const notch = width * 0.42;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const k = -pos.getY(i) / length;
    // Cada columna mide algo menos hacia el centro: eso es el corte en V.
    const column = length - notch * (1 - Math.abs(x) / (width / 2));
    pos.setY(i, -k * column);
    pos.setZ(i, 0.006 + 0.012 * k * Math.sin(k * 7 + phase) + 0.004 * k);
  }
  g.computeVertexNormals();
  return g;
}

function ribbonMaterial(colors: string[]): THREE.MeshPhysicalMaterial {
  const { map, bump } = paintRibbon(colors);
  return new THREE.MeshPhysicalMaterial({
    map,
    bumpMap: bump,
    bumpScale: 0.6,
    roughness: 0.62,
    sheen: 1,
    sheenRoughness: 0.35,
    sheenColor: new THREE.Color('#ffffff'),
    side: THREE.DoubleSide,
  });
}

function buildCinta(look: CintaLook): BuiltItem {
  const width = 0.115;
  const length = 0.36;
  const material = ribbonMaterial(look.colors);
  const group = new THREE.Group();
  const top = length / 2 - 0.01;
  // Las dos colas cuelgan del imperdible: son lo que se balancea.
  const swing = new THREE.Group();
  swing.position.set(0, top, 0);
  group.add(swing);
  [
    { angle: 0.2, z: 0, phase: 0.4 },
    { angle: -0.2, z: 0.007, phase: 2.1 },
  ].forEach(({ angle, z, phase }) => {
    const tail = shadowed(
      new THREE.Mesh(ribbonTail(width, length, phase), material),
    );
    tail.position.z = z;
    tail.rotation.z = angle;
    swing.add(tail);
  });
  const bar = shadowed(
    new THREE.Mesh(
      new THREE.CapsuleGeometry(0.011, width * 1.05, 4, 10),
      metal('oro'),
    ),
  );
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, top - 0.004, 0.02);
  group.add(bar);
  return { group, radius: length * 0.52, swing, swingGain: 0.6 };
}

// ── Medalla ────────────────────────────────────────────────────────────────

function buildMedalla(look: MedallaLook, ctx: BuildContext): BuiltItem {
  const group = new THREE.Group();
  const m = metal(look.metal);
  const BAR_Y = 0.19;
  // Todo lo que cuelga del pasador (cinta, anilla y disco) se balancea junto.
  const swing = new THREE.Group();
  swing.position.set(0, BAR_Y, 0);
  group.add(swing);

  // La cinta: un rectángulo acabado en punta.
  const w = 0.13;
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(w / 2, -0.115);
  shape.lineTo(0, -0.155);
  shape.lineTo(-w / 2, -0.115);
  shape.closePath();
  const ribbonGeometry = new THREE.ShapeGeometry(shape);
  const pos = ribbonGeometry.getAttribute('position');
  const uv = ribbonGeometry.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / w + 0.5, (pos.getY(i) + 0.155) / 0.155);
  }
  const ribbon = shadowed(
    new THREE.Mesh(ribbonGeometry, ribbonMaterial(look.ribbon)),
  );
  ribbon.position.z = 0.008;
  swing.add(ribbon);

  const bar = shadowed(
    new THREE.Mesh(new THREE.CapsuleGeometry(0.012, w * 1.02, 4, 10), m),
  );
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, BAR_Y, 0.014);
  group.add(bar);

  const link = shadowed(
    new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.0045, 10, 24), m),
  );
  link.position.set(0, -0.168, 0.01);
  swing.add(link);

  const R = 0.105;
  const cy = -0.29;
  const disc = shadowed(
    new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.016, 56), m),
  );
  disc.rotation.x = Math.PI / 2;
  disc.position.set(0, cy, 0.01);
  swing.add(disc);
  const rim = shadowed(
    new THREE.Mesh(new THREE.TorusGeometry(R - 0.004, 0.009, 12, 56), m),
  );
  rim.position.set(0, cy, 0.012);
  swing.add(rim);

  // La cara: el mismo metal, con el dibujo en relieve.
  const faceMaterial = m.clone();
  const painted = paintMedalFace(look, ctx.logo, null);
  faceMaterial.bumpMap = painted.bump;
  faceMaterial.bumpScale = 5;
  faceMaterial.roughness = 0.32;
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(R - 0.011, 56),
    faceMaterial,
  );
  face.receiveShadow = true;
  face.position.set(0, cy, 0.0185);
  swing.add(face);

  if (look.image) {
    loadImage(look.image).then((img) => {
      if (!img) return;
      // Una imagen propia (la foto de la medalla de verdad, con su forma y su
      // fondo transparente) sustituye al disco entero.
      const tex = paintMedalFace(look, ctx.logo, img).map;
      disc.visible = false;
      rim.visible = false;
      faceMaterial.dispose();
      const size = R * 2.5;
      face.geometry.dispose();
      face.geometry = new THREE.PlaneGeometry(size, size);
      face.material = new THREE.MeshStandardMaterial({
        map: tex,
        alphaTest: 0.5,
        metalness: 0.45,
        roughness: 0.4,
        side: THREE.DoubleSide,
      });
      face.castShadow = true;
      face.position.set(0, cy - 0.01, 0.014);
      ctx.invalidate();
    });
  }
  return { group, radius: 0.22, swing, swingGain: 1 };
}

// ── Pulsera ────────────────────────────────────────────────────────────────

/**
 * Una pulsera de hilo, puesta plana sobre la tela: un aro trenzado, cerrado
 * con un nudo del que salen los dos cabos.
 */
function buildPulsera(look: PulseraLook): BuiltItem {
  const RX = 0.17;
  const RY = 0.125;
  const WIDTH = 0.05;
  const AROUND = 120;
  const ACROSS = 6;
  const positions: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= AROUND; i++) {
    const a = (i / AROUND) * Math.PI * 2 - Math.PI / 2;
    for (let j = 0; j <= ACROSS; j++) {
      const k = j / ACROSS - 0.5;
      const r = k * WIDTH;
      positions.push(
        (RX + r) * Math.cos(a),
        (RY + r) * Math.sin(a),
        // Abombada: es un cordón trenzado, no una cinta plana.
        0.004 + 0.011 * Math.cos(k * Math.PI),
      );
      // Al revés a lo largo: así el texto se lee de izquierda a derecha por
      // arriba, con las letras mirando hacia fuera.
      uvs.push((1 - i / AROUND) * 9, j / ACROSS);
    }
  }
  const row = ACROSS + 1;
  for (let i = 0; i < AROUND; i++) {
    for (let j = 0; j < ACROSS; j++) {
      const p = i * row + j;
      index.push(p, p + row, p + 1, p + 1, p + row, p + row + 1);
    }
  }
  const band = new THREE.BufferGeometry();
  band.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  band.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  band.setIndex(index);
  band.computeVertexNormals();

  const { map, bump } = paintBraid(look);
  const material = new THREE.MeshPhysicalMaterial({
    map,
    bumpMap: bump,
    bumpScale: 1.4,
    roughness: 0.85,
    sheen: 0.8,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color('#ffffff'),
    side: THREE.DoubleSide,
  });
  const group = new THREE.Group();
  group.add(shadowed(new THREE.Mesh(band, material)));

  // El nudo y los dos cabos, abajo.
  const first = look.colors[0] ?? '#ffffff';
  const last = look.colors[look.colors.length - 1] ?? first;
  const thread = (color: string) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  const knot = shadowed(
    new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), thread(first)),
  );
  knot.scale.set(1, 0.85, 0.6);
  knot.position.set(0, -RY, 0.016);
  group.add(knot);
  [
    { angle: 0.5, color: first, length: 0.1 },
    { angle: -0.35, color: last, length: 0.12 },
  ].forEach(({ angle, color, length }) => {
    const end = shadowed(
      new THREE.Mesh(
        new THREE.CapsuleGeometry(0.008, length, 3, 8),
        thread(color),
      ),
    );
    end.rotation.z = angle;
    end.position.set(
      Math.sin(angle) * (length / 2 + 0.02),
      -RY - Math.cos(angle) * (length / 2 + 0.02),
      0.01,
    );
    group.add(end);
  });
  return { group, radius: 0.21 };
}

// ── Entrada ────────────────────────────────────────────────────────────────

export function buildItem(look: PanueloLook, ctx: BuildContext): BuiltItem {
  switch (look.kind) {
    case 'chapa':
      return buildChapa(look, ctx);
    case 'pin':
      return buildPin(look);
    case 'parche':
      return buildParche(look);
    case 'cinta':
      return buildCinta(look);
    case 'medalla':
      return buildMedalla(look, ctx);
    case 'pulsera':
      return buildPulsera(look);
    default:
      // Una clase que esta versión del visor no conoce: una chapa lisa, para
      // que la pieza exista aunque no sepamos dibujarla.
      return buildChapa({ kind: 'chapa', bg: '#8e8e93' }, ctx);
  }
}

/** Libera geometrías, materiales y texturas de una pieza. */
export function disposeItem(group: THREE.Object3D) {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (const material of materials) {
      if (material.userData.shared) continue;
      const m = material as THREE.MeshPhysicalMaterial;
      m.map?.dispose();
      m.bumpMap?.dispose();
      m.dispose();
    }
  });
}
