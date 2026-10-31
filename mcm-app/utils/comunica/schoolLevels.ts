// utils/comunica/schoolLevels.ts
//
// Los cursos escolares de Grupos y fichas (plan 05), sin React. Es la regla
// del plugin (`sticpa_pl_curso_rank`, `sticpa_pl_curso_key_de_texto` y
// `sticpa_pl_curso_intensidad`, MIS-GRUPOS.md §5): el ORDEN y el COLOR salen de
// la misma escalera, así que no pueden contradecirse.
//
// La traducción de texto libre a clave la hace el servidor; la usa aquí el
// servidor falso y, en la app, el orden de «los grupos de su curso primero»
// (el curso de un grupo llega como texto, `GroupSummary.schoolLevels`).

import type { SchoolLevel, SchoolLevelKey } from '@/services/comunica/contract';

/** La etiqueta corta de cada curso: la que cabe en un chip («4 EP»). */
export const SCHOOL_LEVEL_LABEL: Record<SchoolLevelKey, string> = {
  ep3: '3 EP',
  ep4: '4 EP',
  ep5: '5 EP',
  ep6: '6 EP',
  eso1: '1 ESO',
  eso2: '2 ESO',
  eso3: '3 ESO',
  eso4: '4 ESO',
  bach1: '1 Bach',
  bach2: '2 Bach',
  fp_gm: 'FP GM',
  fp_gs: 'FP GS',
  university: 'Universitario',
  other: 'Otros',
};

/** Orden escolar de las claves. */
export const SCHOOL_LEVEL_ORDER: readonly SchoolLevelKey[] = [
  'ep3',
  'ep4',
  'ep5',
  'ep6',
  'eso1',
  'eso2',
  'eso3',
  'eso4',
  'bach1',
  'bach2',
  'fp_gm',
  'fp_gs',
  'university',
  'other',
];

const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Bases de la escalera (las del plugin). FP es 350 a propósito. */
const STAGE_BASES: [string, number][] = [
  ['infantil', 0],
  ['primaria', 100],
  ['prim', 100],
  ['eso', 200],
  ['secundaria', 200],
  ['bach', 300],
  ['batxillerat', 300],
  ['bachillerato', 300],
  ['fp', 350],
  ['universi', 400],
  ['adult', 500],
];

/**
 * El curso como número que se ordena (`sticpa_pl_curso_rank`). Sin curso,
 * 9000; un texto que no se reconoce, 8000 y algo.
 */
export function courseRank(text: string | null | undefined): number {
  const txt = (text ?? '').trim();
  if (!txt) return 9000;
  const norm = fold(txt);
  let base = 8000;
  for (const [needle, value] of STAGE_BASES) {
    if (norm.includes(needle)) {
      base = value;
      break;
    }
  }
  const m = norm.match(/(\d+)/);
  return base + (m ? parseInt(m[1], 10) : 0);
}

const KEY_RANK: Record<Exclude<SchoolLevelKey, 'other'>, number> = {
  ep3: 103,
  ep4: 104,
  ep5: 105,
  ep6: 106,
  eso1: 201,
  eso2: 202,
  eso3: 203,
  eso4: 204,
  bach1: 301,
  bach2: 302,
  fp_gm: 351,
  fp_gs: 352,
  university: 400,
};

/**
 * La clave de un texto libre («3º ESO», «1º Bachillerato», «4 Primària»).
 * `null` si no se reconoce (`sticpa_pl_curso_key_de_texto`).
 */
export function schoolLevelKeyFromText(
  text: string | null | undefined,
): SchoolLevelKey | null {
  const txt = (text ?? '').trim();
  if (!txt) return null;
  const norm = fold(txt);
  if (norm === 'otros' || norm === 'otro' || norm === 'other') return 'other';
  const rank = courseRank(txt);
  const n = rank % 50;
  let key: string | null = null;
  if (rank >= 100 && rank < 200) key = `ep${n}`;
  else if (rank >= 200 && rank < 300) key = `eso${n}`;
  else if (rank >= 300 && rank < 350) key = `bach${n}`;
  else if (rank >= 350 && rank < 400)
    key = norm.includes('gs') || norm.includes('superior') ? 'fp_gs' : 'fp_gm';
  else if (rank >= 400 && rank < 500) key = 'university';
  return key && key in SCHOOL_LEVEL_LABEL ? (key as SchoolLevelKey) : null;
}

/** Lo que manda el servidor por un texto: clave y etiqueta corta, o el texto tal cual. */
export function schoolLevelFromText(
  text: string | null | undefined,
): SchoolLevel | null {
  const txt = (text ?? '').trim();
  if (!txt) return null;
  const key = schoolLevelKeyFromText(txt);
  return { key, label: key ? SCHOOL_LEVEL_LABEL[key] : txt };
}

/**
 * Anclajes de la intensidad (`sticpa_pl_curso_intensidad`): dos por etapa,
 * para que 1.º y 6.º de primaria no salgan del mismo color.
 */
const ANCHORS: [number, number][] = [
  [0, 0.1],
  [100, 0.18],
  [107, 0.4],
  [200, 0.46],
  [205, 0.62],
  [300, 0.68],
  [303, 0.74],
  [350, 0.8],
  [400, 0.88],
  [500, 1],
];

/**
 * Cuánto «pesa» un curso: 0 los peques, 1 los adultos. ABSOLUTA (no depende
 * de lo que haya en pantalla) y monótona. `null` = sin color («Otros», lo que
 * no se reconoce y «Sin curso»: un color sobre un dato que no se entiende
 * miente).
 */
export function levelWeight(
  key: SchoolLevelKey | null | undefined,
): number | null {
  if (!key || key === 'other') return null;
  const rank = KEY_RANK[key];
  let prev: [number, number] | null = null;
  for (const [r, w] of ANCHORS) {
    if (rank <= r) {
      if (!prev || r === prev[0]) return w;
      const t = (rank - prev[0]) / (r - prev[0]);
      return Math.max(0, Math.min(1, prev[1] + t * (w - prev[1])));
    }
    prev = [r, w];
  }
  return 1;
}

/** Opacidad del punto de un curso sobre el color de enlace del tema. */
export const levelDotOpacity = (weight: number) => 0.28 + 0.72 * weight;

/**
 * Posición de un curso en la vista por curso: los reconocidos en orden
 * escolar, luego «Otros», luego lo que no se reconoce y «Sin curso» al final.
 */
export function levelOrder(level: SchoolLevel | null | undefined): number {
  if (!level) return 10_000;
  if (!level.key) return 9_000;
  return SCHOOL_LEVEL_ORDER.indexOf(level.key);
}

/** Clave de sección de un curso (la de la vista por curso y sus chips). */
export function levelSectionKey(level: SchoolLevel | null | undefined): string {
  if (!level) return 'none';
  return level.key ?? `?${level.label}`;
}

/** ¿Este grupo es de este curso? (`sticpa_pl_grupos_para_curso`). */
export function groupHasLevel(
  groupLevels: readonly string[],
  key: SchoolLevelKey | null | undefined,
): boolean {
  if (!key) return false;
  return groupLevels.some((t) => schoolLevelKeyFromText(t) === key);
}
