/**
 * El pañuelo: geometría y tela.
 *
 * No hay modelo `.glb`: el pañuelo se calcula. Es un pañuelo PUESTO —un triángulo
 * entero cuyas esquinas pasan por los hombros, el nudo delante con sus dos puntas y el triángulo
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
 * El recorrido de la banda del cuello: de la nuca, por encima de los hombros, hasta el
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
const TIP = new THREE.Vector3(0, -2.3, 0.7);

/** Caja que hay que encuadrar (el pañuelo entero, con algo de aire). */
export const BOUNDS = {
  center: new THREE.Vector3(0, -1.1, 0),
  width: 3.25,
  height: 2.95,
};

const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/** Un punto de la banda del cuello. k = 0 es la nuca; k = 0,5, el nudo. */
function ringPoint(k: number, out = new THREE.Vector3()): THREE.Vector3 {
  return RING.getPoint(((k % 1) + 1) % 1, out);
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();

/** El triángulo liso: del arco del cuello al pico, algo abombado. */
function flapBase(s: number, t: number, out: THREE.Vector3): THREE.Vector3 {
  // El triángulo cuelga del tramo trasero de la banda, de hombro a hombro.
  ringPoint(s * SHOULDER, out);
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
  // Muy poco: el pañuelo va liso, solo con la caída natural de la tela.
  return env * folds * 0.45;
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

/** Columnas de tela a cada lado, del hombro al nudo. */
const NE = 22;
/** Hilos a lo ancho del triángulo de la espalda, y filas de arriba abajo. */
const NS = 52;
const NT = 44;
/** Puntos por fila de la malla: [lado] [espalda] [lado]. */
const ROW = NS + 1 + 2 * NE;
const _top = new THREE.Vector3();
const _hem = new THREE.Vector3();
const _edge = new THREE.Vector3();
const _drop = new THREE.Vector3();
const _out = new THREE.Vector3();
const _ref = new THREE.Vector3();
const BODY = new THREE.Vector3(0, -0.5, 0);
const DOWN = new THREE.Vector3(0, -1, 0);

/**
 * La tela que sigue más allá del hombro, hasta el nudo. Es LA MISMA tela que
 * el triángulo de la espalda —una sola malla, sin costura ni corte—: el
 * pañuelo es un triángulo entero cuyas esquinas pasan por los hombros.
 *
 * Cada «hilo» va del borde de arriba (la curva del cuello) al bajo de la
 * tela. En la espalda todos los hilos acaban en el pico; pasado el hombro, el
 * bajo sube por el costado del triángulo y da la vuelta hasta el nudo, que es
 * por donde va el borde de un pañuelo puesto.
 *
 * @param e de 0 (el hombro: coincide con el borde del triángulo) a 1 (el nudo)
 * @param t de 0 (arriba) a 1 (el bajo)
 */
function sidePoint(
  sign: 1 | -1,
  e: number,
  t: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const k = SHOULDER + e * (0.5 - SHOULDER);
  ringPoint(k, _top);
  // El bajo, por delante: cae del cuello, ancho en el hombro y recogido al
  // llegar al nudo (pero nunca un hilo: es la esquina del triángulo).
  ringPoint(SHOULDER, _ref);
  _drop
    .copy(TIP)
    .sub(_ref)
    .normalize()
    .lerp(DOWN, smooth(0.1, 0.65, e));
  _drop.normalize();
  const depth = 0.62 - 0.5 * smooth(0.15, 1, e) + 0.06 * Math.sin(Math.PI * e);
  _hem.copy(_top).addScaledVector(_drop, depth);
  // El bajo, junto a la espalda: sube por el costado del triángulo.
  _edge.copy(TIP).lerp(_ref, 0.6 * smooth(0, 0.5, e));
  _edge.lerp(_hem, smooth(0.1, 0.8, e));

  // Lo que se aparta este hilo del borde del triángulo: en e = 0, nada.
  out.copy(_top).lerp(_edge, t);
  _a.copy(_ref).lerp(TIP, t);
  out.sub(_a);

  // La tela se despega un poco del cuerpo y, hacia el nudo, se frunce.
  _out.copy(_top).sub(BODY);
  _out.y = 0;
  _out.normalize();
  const live = smooth(0.05, 0.4, e);
  const belly = 0.05 * Math.sin(Math.PI * t) * (1 - 0.5 * e);
  const folds =
    smooth(0.2, 0.9, e) *
    (0.022 * Math.sin(t * Math.PI * 5 + e * 3.1) +
      0.012 * Math.sin(t * Math.PI * 9 - e * 5.3)) *
    Math.sin(Math.PI * Math.min(1, t * 1.15));
  out.addScaledVector(_out, live * (belly + folds));

  out.add(flapPoint(1, t).position);
  out.x *= sign;
  return out;
}

function buildFlapGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  const p = new THREE.Vector3();
  // Una sola malla: [lado izquierdo] [triángulo de la espalda] [lado derecho].
  const row = ROW;
  for (let j = 0; j <= NT; j++) {
    const t = (j / NT) * 0.999;
    for (let c = 0; c < row; c++) {
      const i = c - NE;
      if (i < 0 || i > NS) {
        const sign = i < 0 ? -1 : 1;
        const e = (i < 0 ? -i : i - NS) / NE;
        sidePoint(sign, e, t, p);
        positions.push(p.x, p.y, p.z);
        // Sin dibujo: el color del borde de la tela.
        const [u, v] = flapUv(sign, t);
        uvs.push(u, v);
      } else {
        const s = (i / NS) * 2 - 1;
        const q = flapPoint(s, t).position;
        positions.push(q.x, q.y, q.z);
        const [u, v] = flapUv(s, t);
        uvs.push(u, v);
      }
    }
  }
  for (let j = 0; j < NT; j++) {
    for (let c = 0; c < row - 1; c++) {
      const a = j * row + c;
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

// ── Simulación de tela ─────────────────────────────────────────────────────

/**
 * La tela, simulada: cada vértice de la malla es una partícula con su inercia,
 * unida a sus vecinas por hilos que no se estiran (dinámica basada en
 * posiciones, integración de Verlet). No es una animación ni una flexión
 * calculada: al girar el pañuelo cada punto se queda donde estaba y son los
 * hilos los que tiran de él, así que la tela se retrasa, ondea, se pliega y
 * se asienta sola.
 *
 * Lo que la sujeta: el borde del cuello y el nudo están fijos, y cada punto
 * tiende a su sitio de reposo (la forma del pañuelo puesto) con una fuerza
 * que afloja hacia el pico — es lo que hace de «cuerpo» debajo, sin tener que
 * modelar uno.
 */
export interface ClothSim {
  /**
   * Un paso. `dYaw`/`dPitch`: cuánto ha girado el pañuelo desde el paso
   * anterior; `tiltX`/`tiltY`: inclinación del móvil. Devuelve si la tela
   * sigue moviéndose (si no, no hace falta volver a pintar).
   */
  step(
    dt: number,
    dYaw: number,
    dPitch: number,
    tiltX: number,
    tiltY: number,
  ): boolean;
  /** Cuánto se ha movido de su sitio el punto (s, t) del triángulo. */
  offsetAt(s: number, t: number, out: THREE.Vector3): THREE.Vector3;
  /** Devuelve la tela a su sitio, quieta. */
  reset(): void;
}

function createClothSim(geometry: THREE.BufferGeometry): ClothSim {
  const attr = geometry.getAttribute('position') as THREE.BufferAttribute;
  const pos = attr.array as Float32Array;
  const count = attr.count;
  const rest = new Float32Array(pos);
  const prev = new Float32Array(pos);
  /** Cuánto se deja mover cada punto (0 = fijo) y cuánto tira de él su sitio. */
  const free = new Float32Array(count);
  const pull = new Float32Array(count);
  for (let j = 0; j <= NT; j++) {
    const t = j / NT;
    for (let c = 0; c < ROW; c++) {
      const i = c - NE;
      const e = i < 0 ? -i / NE : i > NS ? (i - NS) / NE : 0;
      // Fijo arriba (el cuello) y al llegar al nudo.
      const w = smooth(0, 0.22, t) * (1 - smooth(0.55, 0.95, e));
      free[j * ROW + c] = w;
      pull[j * ROW + c] = 46 - 34 * smooth(0.1, 1, t);
    }
  }
  // Los hilos: a lo ancho, a lo largo y en diagonal.
  const links: number[] = [];
  const lengths: number[] = [];
  const link = (a: number, b: number) => {
    const d = Math.hypot(
      rest[a * 3] - rest[b * 3],
      rest[a * 3 + 1] - rest[b * 3 + 1],
      rest[a * 3 + 2] - rest[b * 3 + 2],
    );
    if (d < 1e-4 || free[a] + free[b] === 0) return;
    links.push(a, b);
    lengths.push(d);
  };
  for (let j = 0; j <= NT; j++) {
    for (let c = 0; c < ROW; c++) {
      const a = j * ROW + c;
      if (c + 1 < ROW) link(a, a + 1);
      if (j < NT) link(a, a + ROW);
      if (c + 1 < ROW && j < NT) {
        link(a, a + ROW + 1);
        link(a + 1, a + ROW);
      }
      // Y de dos en dos: es lo que le da cuerpo, para que haga pliegues
      // amplios de tela y no se arrugue como papel.
      if (c + 2 < ROW) link(a, a + 2);
      if (j + 2 <= NT) link(a, a + 2 * ROW);
    }
  }
  const linkA = Uint32Array.from(links.filter((_, k) => k % 2 === 0));
  const linkB = Uint32Array.from(links.filter((_, k) => k % 2 === 1));
  const linkLen = Float32Array.from(lengths);

  const STEP = 1 / 60;
  const cx = BOUNDS.center.x;
  const cy = BOUNDS.center.y;
  const cz = BOUNDS.center.z;
  let pending = 0;
  let awake = false;
  let calm = 0;
  let lastTiltX = 0;
  let lastTiltY = 0;

  /** Gira un punto alrededor del centro: se queda donde estaba en el mundo. */
  const hold = (arr: Float32Array, k: number, yaw: number, pitch: number) => {
    let x = arr[k] - cx;
    let y = arr[k + 1] - cy;
    let z = arr[k + 2] - cz;
    const cyaw = Math.cos(yaw);
    const syaw = Math.sin(yaw);
    const x1 = x * cyaw + z * syaw;
    const z1 = -x * syaw + z * cyaw;
    x = x1;
    z = z1;
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const y1 = y * cp - z * sp;
    const z2 = y * sp + z * cp;
    y = y1;
    z = z2;
    arr[k] = x + cx;
    arr[k + 1] = y + cy;
    arr[k + 2] = z + cz;
  };

  const substep = (tiltX: number, tiltY: number, drag: number): number => {
    let fastest = 0;
    const h2 = STEP * STEP;
    for (let p = 0; p < count; p++) {
      const w = free[p];
      if (w === 0) continue;
      const k = p * 3;
      for (let a = 0; a < 3; a++) {
        const x = pos[k + a];
        const v = (x - prev[k + a]) * drag;
        // Su sitio tira de él, y el móvil inclinado cambia hacia dónde cae.
        let acc = pull[p] * (rest[k + a] - x);
        if (a === 0) acc += tiltX * CLOTH_TILT;
        else if (a === 2) acc += tiltY * CLOTH_TILT;
        prev[k + a] = x;
        pos[k + a] = x + v + acc * h2 * w;
        const speed = v < 0 ? -v : v;
        if (speed > fastest) fastest = speed;
      }
    }
    // Los hilos no se estiran: es lo que lleva el movimiento de un punto al
    // de al lado, y lo que hace que ondee.
    for (let it = 0; it < CLOTH_ITERATIONS; it++) {
      for (let n = 0; n < linkLen.length; n++) {
        const a = linkA[n];
        const b = linkB[n];
        const wa = free[a];
        const wb = free[b];
        const ka = a * 3;
        const kb = b * 3;
        const dx = pos[kb] - pos[ka];
        const dy = pos[kb + 1] - pos[ka + 1];
        const dz = pos[kb + 2] - pos[ka + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        const corr = ((d - linkLen[n]) / d / (wa + wb)) * CLOTH_STRETCH;
        pos[ka] += dx * corr * wa;
        pos[ka + 1] += dy * corr * wa;
        pos[ka + 2] += dz * corr * wa;
        pos[kb] -= dx * corr * wb;
        pos[kb + 1] -= dy * corr * wb;
        pos[kb + 2] -= dz * corr * wb;
      }
    }
    return fastest;
  };

  return {
    step(dt, dYaw, dPitch, tiltX, tiltY) {
      const turning = Math.abs(dYaw) > 1e-5 || Math.abs(dPitch) > 1e-5;
      if (turning) {
        awake = true;
        // El pañuelo ha girado; la tela, todavía no (casi: el aire la frena).
        for (let p = 0; p < count; p++) {
          const w = free[p] * CLOTH_LAG;
          if (w === 0) continue;
          hold(pos, p * 3, -dYaw * w, -dPitch * w);
          hold(prev, p * 3, -dYaw * w, -dPitch * w);
        }
      }
      // El móvil se ha inclinado (no «está» inclinado: eso no la despierta).
      if (Math.abs(tiltX - lastTiltX) + Math.abs(tiltY - lastTiltY) > 0.01) {
        lastTiltX = tiltX;
        lastTiltY = tiltY;
        awake = true;
      }
      if (!awake) return false;
      pending = Math.min(pending + dt / 1000, STEP * 3);
      let fastest = 1;
      let stepped = false;
      while (pending >= STEP) {
        pending -= STEP;
        // Un rato después del último tirón el aire la frena más: se asienta
        // en un par de segundos en vez de quedarse temblando.
        calm = turning ? 0 : calm + STEP;
        const drag = CLOTH_DRAG - 0.05 * smooth(0.8, 2.2, calm);
        fastest = substep(tiltX, tiltY, drag);
        stepped = true;
      }
      if (stepped) {
        attr.needsUpdate = true;
        geometry.computeVertexNormals();
        if (!turning && fastest < 0.0004) {
          // Se ha asentado: a dormir, hasta que algo la mueva.
          awake = false;
          return false;
        }
      }
      return true;
    },
    offsetAt(s, t, out) {
      const col = NE + ((Math.min(1, Math.max(-1, s)) + 1) / 2) * NS;
      const rowAt = Math.min(1, Math.max(0, t)) * NT;
      const c0 = Math.min(ROW - 2, Math.floor(col));
      const j0 = Math.min(NT - 1, Math.floor(rowAt));
      const fc = col - c0;
      const fj = rowAt - j0;
      out.set(0, 0, 0);
      for (let dj = 0; dj < 2; dj++) {
        for (let dc = 0; dc < 2; dc++) {
          const k = ((j0 + dj) * ROW + c0 + dc) * 3;
          const w = (dc ? fc : 1 - fc) * (dj ? fj : 1 - fj);
          out.x += (pos[k] - rest[k]) * w;
          out.y += (pos[k + 1] - rest[k + 1]) * w;
          out.z += (pos[k + 2] - rest[k + 2]) * w;
        }
      }
      return out;
    },
    reset() {
      pos.set(rest);
      prev.set(rest);
      awake = false;
      attr.needsUpdate = true;
      geometry.computeVertexNormals();
    },
  };
}

/** Lo que frena el aire a la tela, por paso. */
const CLOTH_DRAG = 0.972;
/** Cuánto se queda atrás la tela al girar el pañuelo (1 = del todo). */
const CLOTH_LAG = 0.92;
/** Cuánto tira del pico inclinar el móvil. */
const CLOTH_TILT = 2.4;
const CLOTH_ITERATIONS = 3;
/** Por debajo de 1 la tela da un poco de sí, y se ve más blanda. */
const CLOTH_STRETCH = 0.9;

/**
 * Una banda de tela a lo largo de una curva: sección elíptica muy aplastada,
 * LISA (el pañuelo no va enrollado: es tela plana doblada). `shape(k)` da el
 * semigrosor y el semiancho en cada punto, y con eso salen la banda del cuello
 * y las dos puntas del nudo.
 */
function buildRoll(opts: {
  point: (k: number, out: THREE.Vector3) => THREE.Vector3;
  /** Hacia dónde mira el «ancho» de la sección en cada punto. */
  side: (k: number, tangent: THREE.Vector3, out: THREE.Vector3) => void;
  shape: (k: number) => [number, number];
  segments: number;
  closed: boolean;
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
      const x = Math.cos(phi) * a;
      const y = Math.sin(phi) * b;
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
      // Una punta de tela plana que acaba en pico.
      const a = 0.085 * (1 - Math.pow(k, 1.6)) + 0.004;
      return [a, 0.009];
    },
    segments: 44,
    closed: false,
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
    // Un nudo plano y prieto: apenas un pliegue donde la tela se cruza.
    const lump =
      1 + 0.035 * Math.sin(5 * x + 2 * y) * Math.cos(4 * y - 3 * z) + 0.05 * y;
    pos.setXYZ(i, x * 0.12 * lump, y * 0.1 * lump, z * 0.075 * lump);
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
  /** La tela simulada (ver `ClothSim`). */
  cloth: ClothSim;
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
  for (const geometry of [buildKnot(), buildTail(1), buildTail(-1)]) {
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

  // La tela se mueve: que no desaparezca al salirse de su caja de reposo.
  flap.frustumCulled = false;
  flapBack.frustumCulled = false;

  return {
    group,
    flap,
    cloth: createClothSim(flap.geometry),
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
