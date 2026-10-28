// utils/comunica/activityGroups.ts
//
// Grupos de actividad de un evento (patrullas, habitaciones… los crea
// Comunica Tools; aquí solo se leen). Port de `sticpa_gac_*` del plugin
// (`inc/stic-grupos-actividad.php`): nombres de pestaña, «Sin …», la etiqueta
// corta bajo el nombre y el armado de una pestaña. Sin React.

import type {
  ActivityGroup,
  ActivityMember,
  ActivityTab,
  ActivityType,
  EventPerson,
  EventRoll,
} from '@/services/comunica/contract';
import { ACTIVITY_TYPES } from '@/services/comunica/contract';
import { nameKey } from './nameKey';

/** Singular (un grupo) y plural (la pestaña), en el orden de las pestañas. */
export const ACTIVITY_NAMES: Record<ActivityType, [string, string]> = {
  patrol: ['Patrulla', 'Patrullas'],
  dynamics: ['Grupo de dinámica', 'Dinámica'],
  room: ['Habitación', 'Habitaciones'],
  olympics: ['Olimpiadas', 'Olimpiadas'],
  cleaning: ['Limpieza', 'Limpieza'],
  subgroup: ['Subgrupo', 'Subgrupos'],
  clan: ['Clan', 'Clanes'],
  house: ['Casa', 'Casas'],
  large_group: ['Agrupación grande', 'Agrupaciones'],
  other: ['Otros', 'Otros'],
};

/** Lo que va delante del nombre en la etiqueta corta («Hab. 12»). */
const SHORT: Partial<Record<ActivityType, string>> = {
  patrol: 'Patrulla',
  dynamics: 'Dinámica',
  room: 'Hab.',
  olympics: 'Olimp.',
  cleaning: 'Limpieza',
  subgroup: 'Subgrupo',
  clan: 'Clan',
  house: 'Casa',
};

const SHORT_MAX = 22;

const clean = (s: string | null | undefined) =>
  (s ?? '').replace(/\s+/g, ' ').trim();

const plainVowels = (s: string) =>
  s
    .toLowerCase()
    .replace(/á/g, 'a')
    .replace(/é/g, 'e')
    .replace(/í/g, 'i')
    .replace(/ó/g, 'o')
    .replace(/ú/g, 'u');

/**
 * La etiqueta corta de un grupo para la línea bajo el nombre
 * (`sticpa_gac_etiqueta_corta`): «Patrulla Halcones», «Hab. 12». Si el nombre
 * ya dice el tipo («Patrulla 3», «Habitación 12», «Hab 12»), tal cual. Más de
 * 22 caracteres, se corta con «…».
 */
export function shortGroupLabel(type: ActivityType, name: string): string {
  let n = clean(name);
  if ([...n].length > SHORT_MAX) {
    n = `${[...n]
      .slice(0, SHORT_MAX - 1)
      .join('')
      .trimEnd()}…`;
  }
  const short = SHORT[type];
  if (!short || n === '') return n;
  const root = plainVowels(short.replace(/\.$/, ''));
  const prefix = root.slice(0, Math.max(3, Math.min(5, root.length)));
  return plainVowels(n).startsWith(prefix) ? n : `${short} ${n}`;
}

/** El nombre de la pestaña: la tanda si la hay; si no, el tipo en plural. */
export function tabLabel(tab: Pick<ActivityTab, 'type' | 'batch'>): string {
  const batch = clean(tab.batch);
  return batch || ACTIVITY_NAMES[tab.type]?.[1] || 'Grupos';
}

/** «Sin patrulla», «Sin habitación» o «Sin grupo». */
export function withoutLabel(tab: Pick<ActivityTab, 'type' | 'batch'>) {
  if (clean(tab.batch)) return 'Sin grupo';
  if (tab.type === 'patrol') return 'Sin patrulla';
  if (tab.type === 'room') return 'Sin habitación';
  return 'Sin grupo';
}

/** Las pestañas en el orden de los tipos y, dentro, por tanda. */
export function sortTabs(tabs: readonly ActivityTab[]): ActivityTab[] {
  return [...tabs].sort(
    (a, b) =>
      ACTIVITY_TYPES.indexOf(a.type) - ACTIVITY_TYPES.indexOf(b.type) ||
      clean(a.batch).localeCompare(clean(b.batch), 'es'),
  );
}

/** «Patrulla 2» antes que «Patrulla 10». */
export const compareGroupNames = (
  a: Pick<ActivityGroup, 'name' | 'id'>,
  b: Pick<ActivityGroup, 'name' | 'id'>,
) =>
  a.name.localeCompare(b.name, 'es', { numeric: true, sensitivity: 'base' }) ||
  (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Los grupos de cada persona, cortos y en el orden de los tipos, para la
 * lista del autobús (`sticpa_gac_de_cada_uno`).
 */
export function groupLabelsByPerson(
  activity: EventRoll['activity'],
): Map<string, string[]> {
  const byId = new Map(activity.groups.map((g) => [g.id, g]));
  const tmp = new Map<string, { sort: string; label: string }[]>();
  for (const m of activity.members) {
    const g = byId.get(m.groupId);
    if (!g || !m.personId) continue;
    const pos = String(ACTIVITY_TYPES.indexOf(g.type)).padStart(2, '0');
    const list = tmp.get(m.personId) ?? [];
    list.push({
      sort: `${pos}|${g.tabKey}|${g.id}`,
      label: shortGroupLabel(g.type, g.name),
    });
    tmp.set(m.personId, list);
  }
  const out = new Map<string, string[]>();
  for (const [pid, list] of tmp) {
    list.sort((a, b) => a.sort.localeCompare(b.sort, 'en', { numeric: true }));
    out.set(pid, [...new Set(list.map((x) => x.label))]);
  }
  return out;
}

/** Una persona dentro de un grupo de una pestaña. */
export interface TabPerson {
  /** El de la persona; si no está en la lista, el del miembro. */
  key: string;
  name: string;
  /** La de la lista del evento (en `people` o en `notGoing`). */
  person: EventPerson | null;
  /** ¿Se marca? Solo los de `people`. */
  markable: boolean;
  /** «Cancelada», «Rechazada»… si no va. */
  status?: string;
  sortKey: string;
}

export interface ArmedGroup {
  group: ActivityGroup;
  monitors: TabPerson[];
  participants: TabPerson[];
  n: number;
}

export interface ArmedTab {
  tab: ActivityTab;
  groups: ArmedGroup[];
  /** Los que van y no tienen grupo en esta pestaña. */
  without: EventPerson[];
  /** personId → id de su grupo en la pestaña. */
  of: Map<string, string>;
}

export const NOT_GOING_LABEL = {
  cancelled: 'Cancelada',
  rejected: 'Rechazada',
  not_invited: 'Sin invitación',
  did_not_take_part: 'No participa',
} as const;

const personName = (p: EventPerson) =>
  `${p.person.firstName} ${p.person.lastName}`.trim();
export const sortKeyOf = (p: EventPerson) =>
  nameKey(p.person.lastName, p.person.firstName);

/**
 * UNA PESTAÑA, ARMADA (`sticpa_gac_armar`): sus grupos con sus monitores (solo
 * en los grupos «con monitor») y participantes, y quién de los que van se ha
 * quedado sin grupo. Un miembro que no está en la lista (un monitor que no se
 * apuntó) sale con su nombre y no se marca. Uno por pestaña: si llegan dos,
 * vale el primero.
 */
export function armTab(roll: EventRoll, tabKey: string): ArmedTab | null {
  const tab = roll.activity.tabs.find((t) => t.key === tabKey);
  if (!tab) return null;
  const going = new Map(roll.people.map((p) => [p.person.id, p]));
  const notGoing = new Map(roll.notGoing.map((p) => [p.person.id, p]));
  const groups = new Map<string, ArmedGroup>();
  for (const g of roll.activity.groups) {
    if (g.tabKey === tabKey) {
      groups.set(g.id, { group: g, monitors: [], participants: [], n: 0 });
    }
  }
  const of = new Map<string, string>();
  roll.activity.members.forEach((m: ActivityMember, i) => {
    const target = groups.get(m.groupId);
    if (m.tabKey !== tabKey || !target) return;
    if (m.personId && of.has(m.personId)) return;
    const live = m.personId ? going.get(m.personId) : undefined;
    const gone = m.personId ? notGoing.get(m.personId) : undefined;
    const p = live ?? gone ?? null;
    const name = p ? personName(p) : clean(m.name) || '(sin nombre)';
    const [first, ...rest] = name.split(' ');
    const entry: TabPerson = {
      key: p?.person.id ?? `member-${i}`,
      name,
      person: p,
      markable: !!live,
      ...(gone?.registrationStatus
        ? { status: NOT_GOING_LABEL[gone.registrationStatus] }
        : {}),
      sortKey: p ? sortKeyOf(p) : nameKey(rest.join(' '), first),
    };
    const isMonitor = m.role === 'monitor' && target.group.withMonitors;
    (isMonitor ? target.monitors : target.participants).push(entry);
    target.n += 1;
    if (m.personId) of.set(m.personId, m.groupId);
  });
  const bySort = (a: { sortKey: string }, b: { sortKey: string }) =>
    a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0;
  const armed = [...groups.values()];
  for (const g of armed) {
    g.monitors.sort(bySort);
    g.participants.sort(bySort);
  }
  armed.sort((a, b) => compareGroupNames(a.group, b.group));
  const without = roll.people
    .filter((p) => !of.has(p.person.id))
    .sort((a, b) =>
      bySort({ sortKey: sortKeyOf(a) }, { sortKey: sortKeyOf(b) }),
    );
  return { tab, groups: armed, without, of };
}

/** «4 grupos · 32 personas». */
export function tabSummary(armed: Pick<ArmedTab, 'groups'>) {
  const people = armed.groups.reduce((n, g) => n + g.n, 0);
  const g = armed.groups.length;
  return `${g} ${g === 1 ? 'grupo' : 'grupos'} · ${people} ${
    people === 1 ? 'persona' : 'personas'
  }`;
}

/** «7/8 plazas» o «7»; `over` si pasa del cupo. */
export function groupCount(g: Pick<ArmedGroup, 'group' | 'n'>) {
  const cap = g.group.capacity;
  if (cap && cap > 0) {
    return { text: `${g.n}/${cap} plazas`, over: g.n > cap };
  }
  return { text: String(g.n), over: false };
}

/** «Pasar lista por patrullas». */
export const rollByLabel = (tab: Pick<ActivityTab, 'type' | 'batch'>) =>
  `Pasar lista por ${tabLabel(tab).toLowerCase()}`;
