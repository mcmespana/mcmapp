import { harmoniousColors } from '@/utils/colorHarmony';

// utils/eventHorarios.ts
//
// Varios horarios en un mismo evento (p. ej. el Congreso M+C: el Curso Despierta
// y las dos formaciones de Pre-monitores, el mismo fin de semana con programas
// distintos).
//
// ## Convención en Firebase
//
//   activities/<evento>/horario1   { updatedAt, data: [días], meta: { nombre } }
//   activities/<evento>/horario2   { updatedAt, data: [días], meta: { nombre } }
//   …                              (hasta HORARIO_MAX)
//
// · Cada nodo tiene la forma de siempre (`{ updatedAt, data, hidden? }`) más un
//   `meta.nombre` que es lo que se enseña en el selector.
// · Se descubren probando `horario1`, `horario2`… (no hay índice que mantener).
// · Un horario con `hidden: true` no sale en el selector.
// · Cada horario tiene su COLOR: `meta.color` (#RRGGBB) si se pone a mano; si
//   no, uno que combina con el del evento (`harmoniousColors`).
// · Un evento SIN `horario1` sigue usando el `horario` de siempre (Jubileo,
//   Visita del Papa…): nada cambia para ellos.

/** Máximo de horarios por evento que se buscan. */
export const HORARIO_MAX = 8;

/** Clave del horario n-ésimo (1-based): `horario1`, `horario2`… */
export const horarioKey = (n: number): string => `horario${n}`;

/** Clave del horario único de siempre (eventos sin horarios numerados). */
export const HORARIO_LEGACY_KEY = 'horario';

export interface HorarioSheet {
  /** Clave del nodo bajo el evento (`horario1`). */
  key: string;
  /** Nombre que se enseña en el selector. */
  nombre: string;
  /** Color puesto a mano en `meta.color`; si falta, se calcula. */
  color?: string;
}

/** Lo que se averigua de cada nodo `horarioN` al sondearlo. */
export interface HorarioProbe {
  n: number;
  /** ¿Existe el nodo? (tiene `updatedAt`) */
  exists: boolean;
  hidden: boolean;
  /** `meta.nombre` tal cual vino de Firebase (puede faltar o ser basura). */
  nombre?: unknown;
  /** `meta.color` tal cual vino de Firebase. */
  color?: unknown;
}

const isHex = (v: unknown): v is string =>
  typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.trim());

/** Nombre a mostrar: `meta.nombre` si es texto útil; si no, «Horario N». */
export function horarioNombre(n: number, nombre: unknown): string {
  return typeof nombre === 'string' && nombre.trim()
    ? nombre.trim()
    : `Horario ${n}`;
}

/** De los resultados del sondeo, los horarios visibles, en orden. */
export function sheetsFromProbes(probes: HorarioProbe[]): HorarioSheet[] {
  return probes
    .filter((p) => p.exists && !p.hidden)
    .sort((a, b) => a.n - b.n)
    .map((p) => ({
      key: horarioKey(p.n),
      nombre: horarioNombre(p.n, p.nombre),
      ...(isHex(p.color) ? { color: p.color.trim().toUpperCase() } : {}),
    }));
}

/**
 * Qué horario enseñar: el que la persona eligió si sigue existiendo; si no, el
 * primero. Sin horarios numerados, el `horario` de siempre.
 */
export function chooseHorarioKey(
  sheets: HorarioSheet[],
  picked: string | null,
): string {
  if (sheets.length === 0) return HORARIO_LEGACY_KEY;
  return sheets.find((s) => s.key === picked)?.key ?? sheets[0].key;
}

/** Valida lo leído de la caché local: solo se fía de una lista bien formada. */
export function parseCachedSheets(raw: string | null): HorarioSheet[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const ok = parsed.every(
      (s) =>
        s &&
        typeof s === 'object' &&
        typeof (s as HorarioSheet).key === 'string' &&
        typeof (s as HorarioSheet).nombre === 'string' &&
        ((s as HorarioSheet).color === undefined ||
          isHex((s as HorarioSheet).color)),
    );
    return ok ? (parsed as HorarioSheet[]) : null;
  } catch {
    return null;
  }
}

/**
 * Color de cada horario, en el orden de `sheets`: el de `meta.color` si lo
 * tiene; si no, el que le toca de una paleta que combina con el del evento (el
 * primero es el propio color del evento, el resto lo complementan).
 */
export function horarioTints(
  eventTint: string,
  sheets: HorarioSheet[],
): string[] {
  const auto = harmoniousColors(eventTint, Math.max(1, sheets.length));
  return sheets.map((s, i) => s.color ?? auto[i]);
}
