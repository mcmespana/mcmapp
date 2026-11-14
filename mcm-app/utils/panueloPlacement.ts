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
import type { PanueloItemKind, PanueloPlacement } from '@/types/panuelo';

/** Medidas reales del triángulo, en unidades del visor (1 ≈ 15 cm). */
export const FLAP_WIDTH = 2.9;
export const FLAP_HEIGHT = 2.25;

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

/**
 * Lo que ocupa cada clase de pieza, como el radio de un círculo (en unidades
 * del visor). Una medalla con su cinta o una pulsera piden el doble de sitio
 * que un pin: con un hueco igual para todas, las grandes se pisaban.
 * Van a la par de las medidas de `panuelo-3d/src/items.ts`.
 */
const REACH: Record<PanueloItemKind, number> = {
  pin: 0.14,
  chapa: 0.15,
  parche: 0.19,
  cinta: 0.19,
  pulsera: 0.2,
  medalla: 0.22,
};

/** Lo que ocupa una pieza de la que no se sabe la clase. */
export const DEFAULT_REACH = 0.15;

/** El radio que ocupa una pieza en el pañuelo. */
export function itemReach(kind: PanueloItemKind, size = 1): number {
  const k = Number.isFinite(size) ? clamp(size, 0.7, 1.5) : 1;
  return (REACH[kind] ?? DEFAULT_REACH) * k;
}

type Spot = { u: number; v: number; reach?: number };

/** Donde está serigrafiado el logo: lo último que se tapa. */
const LOGO_ZONE: readonly Spot[] = [
  { u: 0, v: 0.5, reach: 0.2 },
  { u: 0, v: 0.62, reach: 0.2 },
  { u: 0, v: 0.74, reach: 0.16 },
];

/** Cuánto aire queda entre una pieza y la más cercana (negativo: se pisan). */
function clearance(p: Spot, reach: number, others: readonly Spot[]): number {
  let min = Infinity;
  for (const q of others) {
    const d = placementDistance(p, q) - reach - (q.reach ?? DEFAULT_REACH);
    if (d < min) min = d;
  }
  return min;
}

/**
 * El primer hueco libre para una pieza nueva, sabiendo lo que ocupa ella
 * (`reach`) y lo que ocupan las que ya están. Si los huecos de la lista no
 * valen, busca el punto más despejado de una rejilla; con el pañuelo a
 * reventar, la pieza cae encima de otra (y se puede mover).
 */
export function nextFreeSlot(
  taken: readonly Spot[],
  reach: number = DEFAULT_REACH,
): PanueloPlacement {
  // Un pelo de tolerancia: dos huecos vecinos no se «pisan» por un redondeo.
  const EPS = 1e-9;
  // Una pieza grande no cabe pegada al borde ni en el pico: se saldría.
  const inside = (u: number, v: number) =>
    ((1 - Math.abs(u)) * (1 - v) * FLAP_WIDTH) / 2 >= reach;
  for (const [u, v] of SLOTS) {
    if (inside(u, v) && clearance({ u, v }, reach, taken) >= -EPS) {
      return { u, v, rot: 0 };
    }
  }
  // La rejilla esquiva el logo mientras quede sitio en otra parte.
  const search = (crowd: readonly Spot[]) => {
    let best = { u: 0, v: 0.2 };
    let bestGap = -Infinity;
    for (let v = 0.14; v <= 0.86; v += 0.04) {
      for (let u = -0.84; u <= 0.84; u += 0.08) {
        const [cu, cv] = clampToFlap(u, v);
        if (!inside(cu, cv)) continue;
        const g = clearance({ u: cu, v: cv }, reach, crowd);
        if (g > bestGap + EPS) {
          bestGap = g;
          best = { u: cu, v: cv };
        }
      }
    }
    return { best, bestGap };
  };
  const clean = search([...taken, ...LOGO_ZONE]);
  if (clean.bestGap >= -EPS) return { ...clean.best, rot: 0 };
  // Ya no cabe sin pisar algo: antes el logo que otra pieza.
  const crowded = search(taken);
  const best = crowded.bestGap > clean.bestGap ? crowded.best : clean.best;
  return { ...best, rot: 0 };
}
