// utils/comunica/eventRoll.ts
//
// La lista del autobús (plan 07; `single_stic_pasar_lista_evento.php` y
// `sticpa_pl_ev_*` del plugin), sin React: filas, secciones (delegación,
// etapa, curso, monitores plegados, «No van»), chips con su recuento, el
// buscador, «Están todos» sobre lo que se ve, el reparto por grupos de
// actividad y lo que va a la cola.
//
// La app AGRUPA, pero no recalcula: curso, etapa y papel vienen del servidor.

import type {
  EventPerson,
  EventRoll,
  EventRollWrite,
  Mark,
  MarkEntry,
  SessionSummary,
} from '@/services/comunica/contract';
import { NOTE_MAX } from '@/services/comunica/contract';
import {
  NOT_GOING_LABEL,
  sortKeyOf,
  withoutLabel,
  type ArmedTab,
} from './activityGroups';
import { fold } from './events';
import { levelOrder, levelSectionKey } from './schoolLevels';
import type { RollDraft } from './rollDraft';

export const MONITOR_CHIP = 'monitor';
export const WITHOUT_CHIP = 'sin';
const STAGES = ['mic', 'com', 'lc', null] as const;
const STAGE_TITLE = { mic: 'MIC', com: 'COM', lc: 'LC' } as const;

export interface EventRow {
  id: string;
  person: EventPerson;
  /** «Monitor/a · 4 EP · M4.1 · Patrulla 3 · Hab. 12». */
  line: string;
  /** El chip al que pertenece: el curso (o el grupo, por grupos). */
  chip: string;
  /** Lo que mira el buscador, ya sin acentos. */
  haystack: string;
  monitor: boolean;
  sortKey: string;
}

export interface OutRow {
  id: string;
  person: EventPerson;
  line: string;
  status: string;
  chip: string;
  haystack: string;
  sortKey: string;
}

export type ListItem =
  | { type: 'course'; key: string; title: string; count: number }
  | { type: 'note'; key: string; text: string }
  | { type: 'row'; key: string; row: EventRow }
  | { type: 'out'; key: string; row: OutRow };

export interface ListSection {
  key: string;
  title: string;
  count: number;
  kind: 'stage' | 'other' | 'monitors' | 'notGoing' | 'group';
  /** Los monitores: plegables. */
  foldable?: boolean;
  open?: boolean;
  data: ListItem[];
}

export interface Chip {
  key: string;
  label: string;
  count: number;
}

const courseTitle = (p: EventPerson) => p.schoolLevel?.label ?? 'Sin curso';
const courseKey = (p: EventPerson) => levelSectionKey(p.schoolLevel);

/** Las filas de los que van, una vez cada uno. */
export function eventRows(
  roll: Pick<EventRoll, 'people'>,
  groupLabels: ReadonlyMap<string, readonly string[]>,
): EventRow[] {
  return roll.people.map((p) => {
    const monitor = p.role !== 'participant';
    const labels = (groupLabels.get(p.person.id) ?? []).slice(0, 3);
    const parts = [
      monitor ? (p.role === 'team' ? 'Equipo' : 'Monitor/a') : null,
      p.schoolLevel?.label,
      p.homeGroup?.code,
      ...labels,
    ].filter(Boolean) as string[];
    return {
      id: p.person.id,
      person: p,
      line: parts.join(' · '),
      chip: monitor ? MONITOR_CHIP : courseKey(p),
      haystack: fold(
        [
          p.person.firstName,
          p.person.lastName,
          p.schoolLevel?.label,
          p.homeGroup?.code,
          p.otherDelegation?.name,
          ...(groupLabels.get(p.person.id) ?? []),
        ]
          .filter(Boolean)
          .join(' '),
      ),
      monitor,
      sortKey: sortKeyOf(p),
    };
  });
}

export function outRows(roll: Pick<EventRoll, 'notGoing'>): OutRow[] {
  return roll.notGoing
    .map((p) => ({
      id: p.person.id,
      person: p,
      line: p.schoolLevel?.label ?? '',
      status: p.registrationStatus
        ? NOT_GOING_LABEL[p.registrationStatus]
        : 'No va',
      chip: courseKey(p),
      haystack: fold(
        `${p.person.firstName} ${p.person.lastName} ${p.schoolLevel?.label ?? ''}`,
      ),
      sortKey: sortKeyOf(p),
    }))
    .sort(bySort);
}

function bySort(a: { sortKey: string }, b: { sortKey: string }) {
  return a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0;
}

/**
 * Los chips por curso (`sticpa_pl_ev_chips_html`): «Todos 47», uno por curso
 * con cuántos (sin monitores) y «Monitores N» el último. Solo si hay dos o
 * más: con uno, filtrar no filtra nada.
 */
export function courseChips(rows: readonly EventRow[]): Chip[] {
  const byCourse = new Map<
    string,
    { label: string; n: number; order: number }
  >();
  let monitors = 0;
  for (const r of rows) {
    if (r.monitor) {
      monitors += 1;
      continue;
    }
    const c = byCourse.get(r.chip) ?? {
      label: courseTitle(r.person),
      n: 0,
      order: levelOrder(r.person.schoolLevel),
    };
    c.n += 1;
    byCourse.set(r.chip, c);
  }
  if (byCourse.size + (monitors > 0 ? 1 : 0) < 2) return [];
  const chips: Chip[] = [{ key: '', label: 'Todos', count: rows.length }];
  [...byCourse.entries()]
    .sort(
      (a, b) => a[1].order - b[1].order || a[1].label.localeCompare(b[1].label),
    )
    .forEach(([key, c]) => chips.push({ key, label: c.label, count: c.n }));
  if (monitors > 0) {
    chips.push({ key: MONITOR_CHIP, label: 'Monitores', count: monitors });
  }
  return chips;
}

const matches = (
  r: { chip: string; haystack: string },
  chip: string,
  q: string,
) => (!chip || r.chip === chip) && (!q || r.haystack.includes(q));

/**
 * La lista por cursos (`sticpa_pl_ev_secciones_html`): los de la delegación
 * por etapa (MIC, COM, LC, «Sin etapa») y curso; las otras delegaciones
 * detrás, por nombre y etapa («COM · Villanueva»); los monitores, plegados,
 * vengan de donde vengan; y «No van» al final. Los números cuentan lo que se
 * ve.
 */
export function courseSections(
  rows: readonly EventRow[],
  out: readonly OutRow[],
  {
    chip = '',
    query = '',
    monitorsOpen = false,
  }: { chip?: string; query?: string; monitorsOpen?: boolean },
): ListSection[] {
  const q = fold(query);
  const shown = rows.filter((r) => matches(r, chip, q));
  const kids = shown.filter((r) => !r.monitor);
  const sections: ListSection[] = [];

  const block = (
    key: string,
    title: string,
    kind: ListSection['kind'],
    people: EventRow[],
  ) => {
    if (people.length === 0) return;
    const byCourse = new Map<string, EventRow[]>();
    [...people]
      .sort(
        (a, b) =>
          levelOrder(a.person.schoolLevel) - levelOrder(b.person.schoolLevel) ||
          bySort(a, b),
      )
      .forEach((r) => {
        const k = levelSectionKey(r.person.schoolLevel);
        byCourse.set(k, [...(byCourse.get(k) ?? []), r]);
      });
    const data: ListItem[] = [];
    for (const [k, list] of byCourse) {
      data.push({
        type: 'course',
        key: `${key}:${k}`,
        title: courseTitle(list[0].person),
        count: list.length,
      });
      for (const r of list) data.push({ type: 'row', key: r.id, row: r });
    }
    sections.push({ key, title, kind, count: people.length, data });
  };

  const home = kids.filter((r) => !r.person.otherDelegation);
  for (const stage of STAGES) {
    block(
      `stage:${stage ?? 'none'}`,
      stage ? STAGE_TITLE[stage] : 'Sin etapa',
      'stage',
      home.filter((r) => r.person.stage === stage),
    );
  }
  const others = new Map<string, EventRow[]>();
  for (const r of kids) {
    const d = r.person.otherDelegation;
    if (d) others.set(d.name, [...(others.get(d.name) ?? []), r]);
  }
  [...others.keys()]
    .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
    .forEach((name) => {
      const list = others.get(name)!;
      for (const stage of STAGES) {
        block(
          `other:${name}:${stage ?? 'none'}`,
          stage ? `${STAGE_TITLE[stage]} · ${name}` : name,
          'other',
          list.filter((r) => r.person.stage === stage),
        );
      }
    });

  const monitors = shown.filter((r) => r.monitor).sort(bySort);
  if (monitors.length > 0) {
    // Abierto si se pide (el chip «Monitores», tocar la cabecera) o si el
    // buscador ha encontrado a alguien dentro.
    const open = monitorsOpen || chip === MONITOR_CHIP || !!q;
    sections.push({
      key: 'monitors',
      title: rows.some((r) => r.person.role === 'team')
        ? 'Monitores y equipo'
        : 'Monitores',
      kind: 'monitors',
      count: monitors.length,
      foldable: true,
      open,
      data: open
        ? monitors.map((r) => ({ type: 'row' as const, key: r.id, row: r }))
        : [],
    });
  }

  const gone =
    chip === MONITOR_CHIP ? [] : out.filter((r) => matches(r, chip, q));
  if (gone.length > 0) {
    sections.push({
      key: 'not-going',
      title: 'No van',
      kind: 'notGoing',
      count: gone.length,
      data: gone.map((r) => ({ type: 'out' as const, key: r.id, row: r })),
    });
  }
  return sections;
}

/**
 * La lista POR GRUPOS de una pestaña (`sticpa_gac_secciones_html` y
 * `_chips_html`): una sección por grupo con gente que se marca (monitores y
 * participantes juntos, sin pliegue; los no inscritos en su cabecera) y «Sin
 * patrulla» al final. Los chips son los grupos.
 */
export function groupSections(
  armed: ArmedTab,
  rows: readonly EventRow[],
  out: readonly OutRow[],
  { chip = '', query = '' }: { chip?: string; query?: string },
): { sections: ListSection[]; chips: Chip[]; rows: EventRow[] } {
  const q = fold(query);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const sections: ListSection[] = [];
  const chips: Chip[] = [];
  const all: EventRow[] = [];
  const pushGroup = (
    key: string,
    title: string,
    people: EventRow[],
    unregistered: string[],
  ) => {
    const regrouped = people.map((r) => ({ ...r, chip: key }));
    all.push(...regrouped);
    if (people.length > 0)
      chips.push({ key, label: title, count: people.length });
    const shown = regrouped.filter((r) => matches(r, chip, q));
    if (shown.length === 0) return;
    const data: ListItem[] = [];
    if (unregistered.length > 0) {
      data.push({
        type: 'note',
        key: `${key}:note`,
        text: `Sin inscripción, no se marca: ${unregistered.join(', ')}`,
      });
    }
    for (const r of shown) data.push({ type: 'row', key: r.id, row: r });
    sections.push({ key, title, kind: 'group', count: shown.length, data });
  };
  for (const g of armed.groups) {
    const members = [...g.monitors, ...g.participants];
    pushGroup(
      g.group.id,
      g.group.name,
      members
        .filter((m) => m.markable && m.person)
        .map((m) => byId.get(m.person!.person.id))
        .filter((r): r is EventRow => !!r),
      members.filter((m) => !m.markable && !m.status).map((m) => m.name),
    );
  }
  pushGroup(
    WITHOUT_CHIP,
    withoutLabel(armed.tab),
    armed.without
      .map((p) => byId.get(p.person.id))
      .filter((r): r is EventRow => !!r),
    [],
  );
  const gone = out.filter((r) => !chip && (!q || r.haystack.includes(q)));
  if (gone.length > 0) {
    sections.push({
      key: 'not-going',
      title: 'No van',
      kind: 'notGoing',
      count: gone.length,
      data: gone.map((r) => ({ type: 'out' as const, key: r.id, row: r })),
    });
  }
  return {
    sections,
    chips:
      chips.length > 0
        ? [{ key: '', label: 'Todos', count: all.length }, ...chips]
        : [],
    rows: all,
  };
}

/** Las filas que se ven (para «Están todos»: nunca lo plegado ni lo escondido). */
export function visibleRowIds(sections: readonly ListSection[]): string[] {
  const ids: string[] = [];
  for (const s of sections) {
    for (const item of s.data) if (item.type === 'row') ids.push(item.row.id);
  }
  return ids;
}

// ── El borrador y la cola ───────────────────────────────────────────────────

/** El borrador de una lista: las marcas de esa sesión (o nada, sin sesión). */
export function eventDraftFrom(
  roll: Pick<EventRoll, 'people' | 'marksBySession'>,
  sessionId: string | null,
): RollDraft {
  const saved = (sessionId && roll.marksBySession[sessionId]) || {};
  const marks: Record<string, Mark> = {};
  const notes: Record<string, string> = {};
  for (const p of roll.people) {
    const e = saved[p.person.id];
    marks[p.person.id] = e?.mark ?? null;
    notes[p.person.id] = e?.reason ?? '';
  }
  return { marks, notes };
}

/** «Están todos» solo rellena lo SIN marcar de lo que se ve. */
export function markVisibleUnmarked(
  draft: RollDraft,
  visible: readonly string[],
): RollDraft {
  const marks = { ...draft.marks };
  for (const id of visible) if (!marks[id]) marks[id] = 'yes';
  return { ...draft, marks };
}

/**
 * El botón: sin ninguna marca, «Están todos»; con alguna, «El resto está
 * (N)»; sin nadie a la vista por marcar, apagado.
 */
export function fillVisibleLabel(draft: RollDraft, visible: readonly string[]) {
  const pending = visible.filter((id) => !draft.marks[id]).length;
  const any = Object.values(draft.marks).some(Boolean);
  return {
    label: any ? `El resto está (${pending})` : 'Están todos',
    enabled: pending > 0,
  };
}

/** Lo que va a la cola: las marcas puestas de gente de la lista; nunca `null`. */
export function toEventRollWrite(
  draft: RollDraft,
  people: readonly Pick<EventPerson, 'person'>[],
  sessionId: string | null,
  day: string,
): Omit<EventRollWrite, 'clientId'> {
  const marks: Record<string, MarkEntry> = {};
  for (const p of people) {
    const id = p.person.id;
    const mark = draft.marks[id];
    if (!mark) continue;
    const reason = (draft.notes[id] ?? '').trim().slice(0, NOTE_MAX);
    marks[id] = reason ? { mark, reason } : { mark };
  }
  return { sessionId, day, marks };
}

/** La clave de la cola: la sesión, o el día mientras no la haya. */
export const eventRollQueueKey = (
  eventId: string,
  sessionId: string | null,
  day: string,
) => `event-roll:${eventId}:${sessionId ?? `new-${day}`}`;

/**
 * La lista como quedará al subir (optimista): las marcas puestas, sobre la
 * sesión (o sobre `new-<día>` mientras no la haya).
 */
export function applyEventDraft(
  roll: EventRoll,
  write: Omit<EventRollWrite, 'clientId'>,
): EventRoll {
  const key = write.sessionId ?? `new-${write.day}`;
  return {
    ...roll,
    marksBySession: {
      ...roll.marksBySession,
      [key]: { ...(roll.marksBySession[key] ?? {}), ...write.marks },
    },
  };
}

/**
 * Qué sesión se abre: la que se pide; si no, la regla del plan 04 (hoy, si no
 * la última que pasó, si no la próxima), aplicada fuera (`proposeSession`).
 * Sin sesiones, `null`: se marcará el día de hoy y el servidor la crea.
 */
export function sessionById(
  sessions: readonly SessionSummary[],
  id: string | undefined,
) {
  return (id && sessions.find((s) => s.id === id)) || null;
}

/** ¿Hoy cae dentro de las fechas del evento? (crear la sesión de hoy solo así). */
export const todayWithin = (
  e: { startDate: string; endDate: string },
  today: string,
) => e.startDate <= today && e.endDate >= today;
