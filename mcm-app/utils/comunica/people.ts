// utils/comunica/people.ts
//
// Las reglas de «Grupos y fichas» (plan 05), sin React: secciones de grupos,
// cursos y A-Z, chips, buscador, vecinos de la ficha y los grupos que se
// ofrecen al vincular. Las mismas que el plugin (`pages/single_stic_mis_grupos.php`
// y `js/stic-pasar-lista.js` l.1569-1741).

import type {
  GroupSummary,
  GroupWithMonitors,
  ParticipantRow,
  SchoolLevel,
  SchoolLevelKey,
  Stage,
} from '@/services/comunica/contract';
import { foldForSearch } from '@/utils/songTags';
import { groupLabel, groupTitle } from './marks';
import { compareGroups } from './pasarLista';
import {
  groupHasLevel,
  levelOrder,
  levelSectionKey,
  levelWeight,
} from './schoolLevels';

// ── Grupos ──────────────────────────────────────────────────────────────────

export const STAGE_LABEL: Record<Stage, string> = {
  mic: 'MIC',
  com: 'COM',
  lc: 'LC',
  apoyo: 'Apoyo',
};

export interface GroupSection<G> {
  key: string;
  /** `null` = sin cabecera («Tus grupos» cuando no hay más). */
  title: string | null;
  stage: Stage | null | 'mine';
  groups: G[];
}

const STAGE_SECTIONS: { key: string; stage: Stage | null; title: string }[] = [
  { key: 'mic', stage: 'mic', title: 'MIC' },
  { key: 'com', stage: 'com', title: 'COM' },
  { key: 'lc', stage: 'lc', title: 'LC' },
  { key: 'apoyo', stage: 'apoyo', title: 'Apoyo' },
  { key: 'none', stage: null, title: 'Sin etapa' },
];

/** «Tus grupos» primero (sin cabecera si no hay más), luego MIC, COM, LC y Sin etapa. */
export function groupSections<
  G extends Pick<GroupSummary, 'id' | 'stage' | 'code' | 'name'>,
>(groups: readonly G[], myGroupIds: readonly string[]): GroupSection<G>[] {
  const sorted = [...groups].sort(compareGroups);
  const mine = sorted.filter((g) => myGroupIds.includes(g.id));
  const rest = sorted.filter((g) => !myGroupIds.includes(g.id));
  const out: GroupSection<G>[] = [];
  if (mine.length) {
    out.push({
      key: 'mine',
      title: rest.length ? 'Tus grupos' : null,
      stage: 'mine',
      groups: mine,
    });
  }
  for (const s of STAGE_SECTIONS) {
    const list = rest.filter((g) => g.stage === s.stage);
    if (list.length) {
      out.push({ key: s.key, title: s.title, stage: s.stage, groups: list });
    }
  }
  return out;
}

export const groupsCountLabel = (n: number) =>
  n === 1 ? '1 grupo' : `${n} grupos`;
export const monitorsCountLabel = (n: number) =>
  n === 1 ? '1 monitor' : `${n} monitores`;
export const chavalinesLabel = (n: number) =>
  n === 1 ? '1 chavalín' : `${n} chavalines`;
export const personsLabel = (n: number) =>
  n === 1 ? '1 persona' : `${n} personas`;

/**
 * La línea de debajo de un grupo: «Tu grupo · COM · 1 ESO · 12 chavalines ·
 * 2 monitores». Con `participants: null`, sin número (el cero inventado).
 */
export function groupMetaLine(
  g: Pick<GroupSummary, 'stage' | 'schoolLevels' | 'counts'>,
  mine = false,
): string {
  const { participants, monitors } = g.counts;
  return [
    mine ? 'Tu grupo' : null,
    g.stage ? STAGE_LABEL[g.stage] : null,
    g.schoolLevels.join(', ') || null,
    participants !== null ? chavalinesLabel(participants) : null,
    monitors > 0 ? monitorsCountLabel(monitors) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Buscar un grupo: código, nombre, etapa, curso y —si llegan— sus monitores.
 * Sin acentos ni mayúsculas.
 */
export function groupMatches(
  g: Pick<GroupSummary, 'code' | 'name' | 'stage' | 'schoolLevels'> & {
    monitorNames?: readonly string[];
  },
  query: string,
): boolean {
  const q = foldForSearch(query.trim());
  if (!q) return true;
  return foldForSearch(
    [
      g.code ?? '',
      g.name,
      g.stage ? STAGE_LABEL[g.stage] : '',
      ...g.schoolLevels,
      ...(g.monitorNames ?? []),
    ].join(' '),
  ).includes(q);
}

// ── Personas ────────────────────────────────────────────────────────────────

/** Por apellido y luego nombre, como se lee una lista de personas. */
export function compareByLastName(
  a: Pick<ParticipantRow, 'firstName' | 'lastName'>,
  b: Pick<ParticipantRow, 'firstName' | 'lastName'>,
): number {
  return (
    a.lastName.localeCompare(b.lastName, 'es', { sensitivity: 'base' }) ||
    a.firstName.localeCompare(b.firstName, 'es', { sensitivity: 'base' })
  );
}

export const ageLabel = (age?: number) =>
  age !== undefined ? `${age} años` : null;

/**
 * La línea de debajo del nombre: «C1 · 1 ESO · 13 años»; sin grupo,
 * «Sin grupo · 1 ESO · 13 años». `groupCode` = el código (o el nombre) de su
 * grupo.
 */
export function personLine(
  p: Pick<ParticipantRow, 'groupId' | 'schoolLevel' | 'age'>,
  groupCode: string | null,
): string {
  return [
    p.groupId ? groupCode : 'Sin grupo',
    p.schoolLevel?.label ?? null,
    ageLabel(p.age),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** El código de un grupo para la línea de una persona. */
export const groupShort = (g: Pick<GroupSummary, 'code' | 'name'>) =>
  groupTitle(g).code ?? g.name;

export interface CourseSection<P> {
  key: string;
  title: string;
  /** 0-1, o `null` = sin color. */
  weight: number | null;
  /** «Sin curso» va en gris. */
  muted: boolean;
  people: P[];
}

/**
 * La vista por curso: secciones en orden escolar con «N chavalines»; «Otros»
 * y lo que no se reconoce, sin color; «Sin curso» al final y en gris.
 */
export function courseSections<
  P extends Pick<
    ParticipantRow,
    'schoolLevel' | 'firstName' | 'lastName' | 'id'
  >,
>(people: readonly P[]): CourseSection<P>[] {
  const map = new Map<
    string,
    { level: SchoolLevel | undefined; people: P[] }
  >();
  for (const p of people) {
    const k = levelSectionKey(p.schoolLevel);
    const entry = map.get(k) ?? { level: p.schoolLevel, people: [] };
    entry.people.push(p);
    map.set(k, entry);
  }
  return [...map.entries()]
    .sort(([ka, a], [kb, b]) => {
      const d = levelOrder(a.level) - levelOrder(b.level);
      return d !== 0 ? d : ka.localeCompare(kb, 'es');
    })
    .map(([key, { level, people: list }]) => ({
      key,
      title: level ? level.label : 'Sin curso',
      weight: levelWeight(level?.key ?? null),
      muted: !level,
      people: [...list].sort(compareByLastName),
    }));
}

export type ChipKey = 'all' | 'loose' | string;

export interface Chip {
  key: ChipKey;
  label: string;
  count: number;
  warning?: boolean;
}

/**
 * Los chips de Cursos y A-Z: «Todos N», uno por curso (mismo orden que las
 * secciones) y «Sin grupo» al final. Solo si hay más de un curso, o si hay
 * sueltos y no lo son todos (filtrar no filtraría nada).
 */
export function courseChips(
  people: readonly Pick<
    ParticipantRow,
    'schoolLevel' | 'groupId' | 'firstName' | 'lastName' | 'id'
  >[],
): Chip[] | null {
  const sections = courseSections(people);
  const loose = people.filter((p) => !p.groupId).length;
  const someLoose = loose > 0 && loose < people.length;
  if (sections.length <= 1 && !someLoose) return null;
  return [
    { key: 'all', label: 'Todos', count: people.length },
    ...sections.map((s) => ({
      key: s.key,
      label: s.title,
      count: s.people.length,
    })),
    ...(someLoose
      ? [{ key: 'loose', label: 'Sin grupo', count: loose, warning: true }]
      : []),
  ];
}

/** Tocar el chip activo lo suelta (vuelve a «Todos»). */
export const toggleChip = (current: ChipKey, tapped: ChipKey): ChipKey =>
  tapped === current ? 'all' : tapped;

export interface PeopleFilter {
  chip?: ChipKey;
  query?: string;
  /** El chip «¿Quién no puede salir en fotos?» de la lista de un grupo. */
  noPhotosOnly?: boolean;
}

/**
 * Filtra lo pintado, sin ir al servidor: chip + buscador + «sin fotos» a la
 * vez. El buscador mira el NOMBRE y la LÍNEA de debajo (la que se ve), sin
 * acentos ni mayúsculas, y nunca el texto de las marcas ni el de «Vincular».
 */
export function filterPeople<
  P extends Pick<
    ParticipantRow,
    'firstName' | 'lastName' | 'schoolLevel' | 'groupId' | 'badges'
  >,
>(people: readonly P[], line: (p: P) => string, f: PeopleFilter): P[] {
  const q = foldForSearch((f.query ?? '').trim());
  const chip = f.chip ?? 'all';
  return people.filter((p) => {
    if (chip === 'loose' && p.groupId) return false;
    if (
      chip !== 'all' &&
      chip !== 'loose' &&
      levelSectionKey(p.schoolLevel) !== chip
    )
      return false;
    if (f.noPhotosOnly && !p.badges.noPhotos) return false;
    if (!q) return true;
    return foldForSearch(`${p.firstName} ${p.lastName} ${line(p)}`).includes(q);
  });
}

/** Cuántos de la lista no pueden salir en fotos (solo el «no» explícito). */
export const noPhotosCount = (
  people: readonly Pick<ParticipantRow, 'badges'>[],
) => people.filter((p) => p.badges.noPhotos).length;

/**
 * Anterior y siguiente en la lista del grupo, por apellido. SIN DAR LA VUELTA:
 * en el primero no hay anterior y en el último no hay siguiente.
 */
export function neighbors<P extends Pick<ParticipantRow, 'id'>>(
  sorted: readonly P[],
  id: string,
): { prev: P | null; next: P | null } {
  const i = sorted.findIndex((p) => p.id === id);
  if (i < 0) return { prev: null, next: null };
  return {
    prev: i > 0 ? sorted[i - 1] : null,
    next: i < sorted.length - 1 ? sorted[i + 1] : null,
  };
}

export interface GroupOption {
  id: string;
  /** «C1 · Los Peques (1 ESO)». */
  label: string;
  /** Es de su curso. */
  ofLevel: boolean;
}

/** Los grupos al vincular: los de su curso primero; los demás detrás, por si el curso está mal. */
export function groupsForLevel(
  groups: readonly Pick<
    GroupWithMonitors,
    'id' | 'code' | 'name' | 'schoolLevels'
  >[],
  key: SchoolLevelKey | null | undefined,
): GroupOption[] {
  const sorted = [...groups].sort(compareGroups);
  const opts = sorted.map((g) => ({
    id: g.id,
    label: `${groupLabel(g)}${g.schoolLevels.length ? ` (${g.schoolLevels.join(', ')})` : ''}`,
    ofLevel: groupHasLevel(g.schoolLevels, key),
  }));
  return [...opts.filter((o) => o.ofLevel), ...opts.filter((o) => !o.ofLevel)];
}

/**
 * Lo que la cola del móvil ya ha vinculado y el servidor aún no ha dicho: la
 * fila pasa a su grupo al momento.
 */
export function withPendingGroups<
  P extends Pick<ParticipantRow, 'groupId' | 'unassignedMembershipId'>,
>(people: readonly P[], pending: ReadonlyMap<string, string>): P[] {
  if (pending.size === 0) return [...people];
  return people.map((p) =>
    !p.groupId &&
    p.unassignedMembershipId &&
    pending.has(p.unassignedMembershipId)
      ? { ...p, groupId: pending.get(p.unassignedMembershipId)! }
      : p,
  );
}
