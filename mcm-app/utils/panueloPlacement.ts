/**
 * Dónde cabe una pieza en el triángulo del pañuelo.
 *
 * Lo comparten la app y el visor 3D (`panuelo-3d/`): los dos tienen que estar
 * de acuerdo en hasta dónde se puede arrastrar una pieza y en qué hueco cae
 * una recién conseguida. Por eso aquí no hay nada de three.js ni de React.
 *
 * Coordenadas (`PanueloPlacement`): `u` va de −1 a 1 entre los dos bordes del
 * triángulo A ESA ALTURA, y `v` de 0 (cuello) a 1 (pico).
 */
import type { PanueloPlacement } from '@/types/panuelo';

/** Medidas reales del triángulo, en unidades del visor (1 ≈ 15 cm). */
export const FLAP_WIDTH = 2.9;
export const FLAP_HEIGHT = 1.75;

/** Hasta dónde llega una pieza: ni pegada al rollo ni colgando del pico. */
const V_MIN = 0.07;
const V_MAX = 0.9;
/** Margen con el borde, en proporción del ancho del triángulo. */
const EDGE_MARGIN = 0.05;

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** Mete (u, v) dentro del triángulo, dejando margen para que no cuelgue. */
export function clampToFlap(u: number, v: number): [number, number] {
  const t = clamp(Number.isFinite(v) ? v : 0.3, V_MIN, V_MAX);
  const limit = Math.max(0, 1 - EDGE_MARGIN / (1 - t) - 0.06);
  return [clamp(Number.isFinite(u) ? u : 0, -limit, limit), t];
}

/** Giro normalizado a (−180, 180]. */
export function normalizeRotation(rot: number): number {
  if (!Number.isFinite(rot)) return 0;
  const r = ((rot % 360) + 360) % 360;
  return r > 180 ? r - 360 : r;
}

/** Posición real (en unidades del visor) de un punto del triángulo. */
function toFlat(p: { u: number; v: number }): [number, number] {
  return [(p.u * (1 - p.v) * FLAP_WIDTH) / 2, p.v * FLAP_HEIGHT];
}

/** Distancia real entre dos puntos del triángulo. */
export function placementDistance(
  a: { u: number; v: number },
  b: { u: number; v: number },
): number {
  const [ax, ay] = toFlat(a);
  const [bx, by] = toFlat(b);
  return Math.hypot(ax - bx, ay - by);
}

/**
 * Los huecos «bonitos», en el orden en que se van llenando: la fila de
 * arriba del centro hacia fuera, luego la segunda, luego los lados. El centro
 * de abajo se deja libre: ahí va el logo.
 */
const SLOTS: readonly (readonly [number, number])[] = [
  [0, 0.2],
  [-0.36, 0.2],
  [0.36, 0.2],
  [-0.7, 0.21],
  [0.7, 0.21],
  [-0.24, 0.38],
  [0.24, 0.38],
  [-0.66, 0.38],
  [0.66, 0.38],
  [-0.74, 0.54],
  [0.74, 0.54],
];

/** Donde está serigrafiado el logo: lo último que se tapa. */
const LOGO_ZONE: readonly { u: number; v: number }[] = [
  { u: 0, v: 0.5 },
  { u: 0, v: 0.6 },
  { u: 0, v: 0.7 },
];

/** Dos piezas más cerca que esto se pisan. */
const MIN_GAP = 0.3;

/**
 * El primer hueco libre para una pieza nueva. Si los huecos de la lista están
 * todos ocupados, busca el punto más despejado de una rejilla; con el pañuelo
 * a reventar, la pieza cae encima de otra (y se puede mover).
 */
export function nextFreeSlot(
  taken: readonly { u: number; v: number }[],
): PanueloPlacement {
  const gap = (p: { u: number; v: number }) =>
    taken.reduce((min, q) => Math.min(min, placementDistance(p, q)), Infinity);

  for (const [u, v] of SLOTS) {
    if (gap({ u, v }) >= MIN_GAP) return { u, v, rot: 0 };
  }
  // La rejilla esquiva el logo mientras quede sitio en otra parte.
  const crowd = [...taken, ...LOGO_ZONE];
  const gapAll = (p: { u: number; v: number }) =>
    crowd.reduce((min, q) => Math.min(min, placementDistance(p, q)), Infinity);
  let best = { u: 0, v: 0.2 };
  let bestGap = -1;
  for (let v = 0.14; v <= 0.86; v += 0.06) {
    for (let u = -0.84; u <= 0.84; u += 0.12) {
      const [cu, cv] = clampToFlap(u, v);
      const g = gapAll({ u: cu, v: cv });
      if (g > bestGap) {
        bestGap = g;
        best = { u: cu, v: cv };
      }
    }
  }
  return { ...best, rot: 0 };
}
