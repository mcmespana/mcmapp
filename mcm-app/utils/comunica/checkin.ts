// utils/comunica/checkin.ts
//
// El check-in de un evento que se gestiona (plan 18), sin React: lo que llega
// del servidor, lo que está en la cola del móvil y cómo se ve la lista.
//
//   · El estado de cada inscripción es la ÚLTIMA versión que se conoce: lo
//     del servidor (detalle + sondeo, mezclado por `updatedAt`) y, ENCIMA, lo
//     que aún está en la cola del móvil. Así lo marcado se ve al momento, sin
//     cobertura también, y el sondeo no lo pisa mientras no sube.
//   · Marcar va a la cola por TANDAS (`checkin:<evento>:<tanda>`): una tanda
//     es un POST con todas sus inscripciones. Volver a marcar a alguien lo
//     saca de las tandas que aún no han subido, para que el orden de subida
//     no pueda resucitar lo de antes.
//   · La nota va aparte, una por inscripción (`checkin-note:<evento>:<id>`):
//     gana la última.
//   · Agrupa y filtra, pero no recalcula: curso, papel y delegación vienen
//     del servidor.

import type {
  CheckinBody,
  CheckinState,
  CheckinTarget,
  ManagedEventDetail,
  ManagedEventSummary,
  ManagedRegistration,
  ManagedRoom,
} from '@/services/comunica/contract';
import { MANAGED_NOTE_MAX } from '@/services/comunica/contract';
import type { OutboxEntry } from '@/services/comunica/outbox';
import { NOT_GOING_LABEL } from './activityGroups';
import { madridTime } from './madrid';
import { nameKey } from './nameKey';
import { levelOrder, levelSectionKey } from './schoolLevels';
import { fold } from './search';

// ── La cola ─────────────────────────────────────────────────────────────────

export const CHECKIN_KIND = 'checkin';
export const CHECKIN_NOTE_KIND = 'checkin-note';

export const checkinQueueKey = (eventId: string, batch: string) =>
  `checkin:${eventId}:${batch}`;
export const noteQueueKey = (eventId: string, registrationId: string) =>
  `checkin-note:${eventId}:${registrationId}`;

/** Lo que va en la cola: el cuerpo del POST tal cual, siempre con su hora. */
export type CheckinPayload = Required<CheckinBody>;
export interface NotePayload {
  registrationId: string;
  note: string;
}

const isMine = (e: OutboxEntry, eventId: string) => e.meta.eventId === eventId;
/** Lo que el servidor rechazó (403, validación): no se reintenta solo ni se pinta como hecho. */
export const isRejected = (e: OutboxEntry) =>
  e.status === 'failed' && e.error?.auto === false;
const live = (e: OutboxEntry) => e.status !== 'applied' && !isRejected(e);

/** Las tandas de este evento que aún no han subido (en el orden de la cola). */
export function queuedCheckins(
  entries: readonly OutboxEntry[],
  eventId: string,
): OutboxEntry<CheckinPayload>[] {
  return entries.filter(
    (e) =>
      e.kind === CHECKIN_KIND && isMine(e, eventId) && e.status !== 'applied',
  ) as OutboxEntry<CheckinPayload>[];
}

/**
 * Lo que hay que hacer en la cola para marcar `ids`: sacarlos de las tandas
 * que aún no han subido (las que se quedan vacías, fuera) y añadir la tanda
 * nueva al final.
 */
export function planCheckin(
  entries: readonly OutboxEntry[],
  eventId: string,
  ids: readonly string[],
): {
  update: { key: string; payload: CheckinPayload }[];
  remove: string[];
} {
  const wanted = new Set(ids);
  const update: { key: string; payload: CheckinPayload }[] = [];
  const remove: string[] = [];
  for (const e of queuedCheckins(entries, eventId)) {
    const rest = e.payload.registrationIds.filter((id) => !wanted.has(id));
    if (rest.length === e.payload.registrationIds.length) continue;
    if (rest.length === 0) remove.push(e.key);
    else
      update.push({
        key: e.key,
        payload: { ...e.payload, registrationIds: rest },
      });
  }
  return { update, remove };
}

/** Lo pendiente de una inscripción en la cola del móvil. */
export interface PendingChange {
  to?: CheckinTarget;
  at?: string;
  note?: string;
}

/**
 * Lo que la cola tiene de cada inscripción de este evento (lo último gana).
 * Lo rechazado no cuenta: no es verdad en el servidor.
 */
export function pendingByRegistration(
  entries: readonly OutboxEntry[],
  eventId: string,
): Map<string, PendingChange> {
  const out = new Map<string, PendingChange>();
  for (const e of entries) {
    if (!isMine(e, eventId) || !live(e)) continue;
    if (e.kind === CHECKIN_KIND) {
      const p = e.payload as CheckinPayload;
      for (const id of p.registrationIds) {
        out.set(id, { ...out.get(id), to: p.to, at: p.at });
      }
    } else if (e.kind === CHECKIN_NOTE_KIND) {
      const p = e.payload as NotePayload;
      out.set(p.registrationId, { ...out.get(p.registrationId), note: p.note });
    }
  }
  return out;
}

/** Lo de este evento que el servidor ha rechazado (para el aviso y «Descartar»). */
export const rejectedEntries = (
  entries: readonly OutboxEntry[],
  eventId: string,
) =>
  entries.filter(
    (e) =>
      isMine(e, eventId) &&
      (e.kind === CHECKIN_KIND || e.kind === CHECKIN_NOTE_KIND) &&
      isRejected(e),
  );

/** Cuántos cambios de este evento esperan para subir (marcas y notas). */
export function unsentCount(
  entries: readonly OutboxEntry[],
  eventId: string,
): number {
  return pendingByRegistration(entries, eventId).size;
}

// ── Lo del servidor ─────────────────────────────────────────────────────────

const t = (iso: string) => Date.parse(iso) || 0;

/**
 * Mezcla lo que llega (sondeo o respuesta de una escritura) con lo que se
 * tenía: por inscripción, gana lo más reciente (`updatedAt`); a igual hora, lo
 * que llega. El sondeo repite filas (margen de 15 s): no pasa nada.
 */
export function mergeCheckins(
  base: readonly CheckinState[],
  incoming: readonly CheckinState[],
): CheckinState[] {
  const byId = new Map(base.map((c) => [c.registrationId, c]));
  for (const c of incoming) {
    const prev = byId.get(c.registrationId);
    if (!prev || t(c.updatedAt) >= t(prev.updatedAt)) {
      byId.set(c.registrationId, c);
    }
  }
  return [...byId.values()];
}

/** El detalle con lo nuevo mezclado y, si llega, el `since` siguiente. */
export function withCheckins(
  detail: ManagedEventDetail,
  incoming: readonly CheckinState[],
  since?: string,
): ManagedEventDetail {
  const checkins = mergeCheckins(detail.checkins, incoming);
  const nextSince = since && t(since) >= t(detail.since) ? since : detail.since;
  return { ...detail, checkins, since: nextSince };
}

// ── Cómo se ve ──────────────────────────────────────────────────────────────

export type CheckinStatus = 'in' | 'absent' | 'pending';

export interface Effective {
  status: CheckinStatus;
  arrivedAt?: string;
  arrivedBy?: string;
  note?: string;
  noteBy?: string;
  roomId?: string;
  /** Hay algo de esta persona en la cola del móvil. */
  queued: boolean;
}

export const statusOf = (
  c: Pick<CheckinState, 'arrivedAt' | 'absent'> | undefined,
): CheckinStatus => (c?.arrivedAt ? 'in' : c?.absent ? 'absent' : 'pending');

/**
 * El estado que se pinta de cada inscripción: el del servidor y, encima, lo
 * de la cola. `me` = cómo firma quien marca en este móvil.
 */
export function effectiveCheckins(
  detail: Pick<ManagedEventDetail, 'registrations' | 'checkins'>,
  pending: ReadonlyMap<string, PendingChange>,
  me?: string,
): Map<string, Effective> {
  const server = new Map(detail.checkins.map((c) => [c.registrationId, c]));
  const out = new Map<string, Effective>();
  for (const r of detail.registrations) {
    const id = r.registrationId;
    const s = server.get(id);
    const p = pending.get(id);
    const status: CheckinStatus = p?.to
      ? p.to === 'in'
        ? 'in'
        : p.to
      : statusOf(s);
    const arrivedAt =
      status !== 'in' ? undefined : p?.to === 'in' ? p.at : s?.arrivedAt;
    const arrivedBy =
      status !== 'in' ? undefined : p?.to === 'in' ? me : s?.arrivedBy;
    const note = p && p.note !== undefined ? p.note || undefined : s?.note;
    out.set(id, {
      status,
      ...(arrivedAt ? { arrivedAt } : {}),
      ...(arrivedBy ? { arrivedBy } : {}),
      ...(note ? { note } : {}),
      ...(note && !(p && p.note !== undefined) && s?.noteBy
        ? { noteBy: s.noteBy }
        : note && p?.note && me
          ? { noteBy: me }
          : {}),
      ...(s?.roomId ? { roomId: s.roomId } : {}),
      queued: !!p,
    });
  }
  return out;
}

export interface CheckinStats {
  /** Inscripciones activas (sin las canceladas). */
  total: number;
  arrived: number;
  absent: number;
  /** Faltan: ni han llegado ni se sabe que no vienen. */
  pending: number;
  withNote: number;
}

export function checkinStats(
  registrations: readonly ManagedRegistration[],
  eff: ReadonlyMap<string, Effective>,
): CheckinStats {
  const s: CheckinStats = {
    total: 0,
    arrived: 0,
    absent: 0,
    pending: 0,
    withNote: 0,
  };
  for (const r of registrations) {
    if (r.registrationStatus) continue;
    const e = eff.get(r.registrationId);
    s.total += 1;
    if (e?.status === 'in') s.arrived += 1;
    else if (e?.status === 'absent') s.absent += 1;
    else s.pending += 1;
    if (e?.note) s.withNote += 1;
  }
  return s;
}

/** «87 / 120 han llegado»: el número, la frase y el % de la barra (0-1). */
export function arrivedHeadline(s: Pick<CheckinStats, 'arrived' | 'total'>) {
  return {
    figure: `${s.arrived} / ${s.total}`,
    text: s.arrived === 1 && s.total === 1 ? 'ha llegado' : 'han llegado',
    ratio: s.total > 0 ? Math.min(1, s.arrived / s.total) : 0,
  };
}

/** «12 faltan · 3 no vienen». */
export function restLine(s: Pick<CheckinStats, 'pending' | 'absent'>) {
  return [
    s.pending > 0
      ? `${s.pending} ${s.pending === 1 ? 'falta' : 'faltan'}`
      : null,
    s.absent > 0
      ? `${s.absent} ${s.absent === 1 ? 'no viene' : 'no vienen'}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

// ── Filtros, buscador y grupos ──────────────────────────────────────────────

export const CHECKIN_FILTERS = [
  'all',
  'pending',
  'in',
  'absent',
  'note',
] as const;
export type CheckinFilter = (typeof CHECKIN_FILTERS)[number];

export const FILTER_LABEL: Record<CheckinFilter, string> = {
  all: 'Todos',
  pending: 'Faltan',
  in: 'Están',
  absent: 'No vienen',
  note: 'Con nota',
};

export const GROUP_BYS = [
  'name',
  'delegation',
  'course',
  'role',
  'room',
] as const;
export type CheckinGroupBy = (typeof GROUP_BYS)[number];

export const GROUP_BY_LABEL: Record<CheckinGroupBy, string> = {
  name: 'Nombre',
  delegation: 'Delegación',
  course: 'Curso',
  role: 'Papel',
  room: 'Habitación',
};

/** Por habitación solo si el evento tiene habitaciones. */
export const groupBysFor = (rooms: readonly ManagedRoom[]): CheckinGroupBy[] =>
  GROUP_BYS.filter((g) => g !== 'room' || rooms.length > 0);

export const ROLE_LABEL = {
  participant: 'Participante',
  monitor: 'Monitor/a',
  team: 'Equipo',
} as const;

const ROLE_SECTION = {
  participant: 'Participantes',
  monitor: 'Monitores',
  team: 'Equipo',
} as const;

export interface CheckinRowModel {
  id: string;
  reg: ManagedRegistration;
  eff: Effective;
  room: ManagedRoom | null;
  /** «Monitor/a · 1 ESO · Villaclara». */
  line: string;
  /** Lo que mira el buscador, ya sin acentos. */
  haystack: string;
  sortKey: string;
  /** Cancelada: sale aparte y no se marca. */
  out: boolean;
  /** «Cancelada»… (solo las que no van). */
  outLabel?: string;
}

/** La hora de llegada como se lee en la fila: «10:32». */
export const arrivedTime = (iso?: string) => (iso ? madridTime(iso) : '');

/** «Habitación 12» (la sección) y «Hab. 12» (al lado del nombre). */
export const roomHeading = (r: ManagedRoom, manyVenues: boolean) =>
  [
    `Habitación ${r.code}`,
    r.floor ? `planta ${r.floor}` : null,
    manyVenues ? r.venue : null,
  ]
    .filter(Boolean)
    .join(' · ');
export const roomShort = (r: Pick<ManagedRoom, 'code'>) => `Hab. ${r.code}`;

export function checkinRows(
  detail: Pick<ManagedEventDetail, 'registrations' | 'rooms'>,
  eff: ReadonlyMap<string, Effective>,
): CheckinRowModel[] {
  const rooms = new Map(detail.rooms.map((r) => [r.id, r]));
  return detail.registrations.map((reg) => {
    const e = eff.get(reg.registrationId) ?? {
      status: 'pending' as const,
      queued: false,
    };
    const room = (e.roomId && rooms.get(e.roomId)) || null;
    const line = [
      reg.role !== 'participant' ? ROLE_LABEL[reg.role] : null,
      reg.schoolLevel?.label ?? null,
      reg.delegation?.name ?? null,
    ]
      .filter(Boolean)
      .join(' · ');
    return {
      id: reg.registrationId,
      reg,
      eff: e,
      room,
      line,
      haystack: fold(
        [
          reg.firstName,
          reg.lastName,
          reg.schoolLevel?.label,
          reg.delegation?.name,
          ROLE_LABEL[reg.role],
          room ? `hab ${room.code} habitacion ${room.code}` : null,
          e.note,
        ]
          .filter(Boolean)
          .join(' '),
      ),
      sortKey: nameKey(reg.lastName, reg.firstName),
      out: !!reg.registrationStatus,
      ...(reg.registrationStatus
        ? { outLabel: NOT_GOING_LABEL[reg.registrationStatus] }
        : {}),
    };
  });
}

/** Busca por trozos y sin tildes: «lu gar» encuentra a «Lucía García». */
export function matchesQuery(haystack: string, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  return words.every((w) => haystack.includes(w));
}

const passes = (r: CheckinRowModel, f: CheckinFilter) =>
  f === 'all' ||
  (f === 'note'
    ? !!r.eff.note
    : !r.out && (f === 'in' ? r.eff.status === 'in' : f === r.eff.status));

/** Los chips, con cuántos hay en cada uno (las canceladas no cuentan, salvo con nota). */
export function filterChips(
  rows: readonly CheckinRowModel[],
): { key: CheckinFilter; label: string; count: number }[] {
  const active = rows.filter((r) => !r.out);
  return CHECKIN_FILTERS.map((key) => ({
    key,
    label: FILTER_LABEL[key],
    count:
      key === 'all'
        ? active.length
        : key === 'note'
          ? rows.filter((r) => passes(r, key)).length
          : active.filter((r) => passes(r, key)).length,
  }));
}

export interface CheckinSection {
  key: string;
  title: string;
  count: number;
  /** Las que no van: apagadas y sin botón. */
  out?: boolean;
  rows: CheckinRowModel[];
}

const bySort = (a: CheckinRowModel, b: CheckinRowModel) =>
  a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0;

/**
 * Las secciones de la lista: lo que pasa el filtro y el buscador, agrupado.
 * Las inscripciones canceladas, al final y aparte («No van»), solo con
 * «Todos» o «Con nota».
 */
export function checkinSections(
  rows: readonly CheckinRowModel[],
  {
    filter = 'all',
    query = '',
    groupBy = 'name',
    event,
    rooms = [],
  }: {
    filter?: CheckinFilter;
    query?: string;
    groupBy?: CheckinGroupBy;
    event?: Pick<ManagedEventSummary, 'delegation'>;
    rooms?: readonly ManagedRoom[];
  },
): CheckinSection[] {
  const shown = rows.filter(
    (r) => passes(r, filter) && matchesQuery(r.haystack, query),
  );
  const going = shown.filter((r) => !r.out).sort(bySort);
  const gone = shown.filter((r) => r.out).sort(bySort);
  const sections: CheckinSection[] = [];
  const push = (key: string, title: string, list: CheckinRowModel[]) => {
    if (list.length > 0) {
      sections.push({ key, title, count: list.length, rows: list });
    }
  };

  if (groupBy === 'name') {
    push('all', 'Inscritos', going);
  } else if (groupBy === 'delegation') {
    const by = new Map<string, { name: string; list: CheckinRowModel[] }>();
    for (const r of going) {
      const d = r.reg.delegation;
      const k = d?.id ?? '';
      const g = by.get(k) ?? { name: d?.name ?? 'Sin delegación', list: [] };
      g.list.push(r);
      by.set(k, g);
    }
    const owner = event?.delegation.id;
    [...by.entries()]
      .sort(([ka, a], [kb, b]) =>
        ka === owner
          ? -1
          : kb === owner
            ? 1
            : !ka
              ? 1
              : !kb
                ? -1
                : a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }),
      )
      .forEach(([k, g]) => push(`d:${k || 'none'}`, g.name, g.list));
  } else if (groupBy === 'course') {
    const kids = going.filter((r) => r.reg.role === 'participant');
    const by = new Map<string, CheckinRowModel[]>();
    [...kids]
      .sort(
        (a, b) =>
          levelOrder(a.reg.schoolLevel) - levelOrder(b.reg.schoolLevel) ||
          bySort(a, b),
      )
      .forEach((r) => {
        const k = levelSectionKey(r.reg.schoolLevel);
        by.set(k, [...(by.get(k) ?? []), r]);
      });
    for (const [k, list] of by) {
      push(`c:${k}`, list[0].reg.schoolLevel?.label ?? 'Sin curso', list);
    }
    push(
      'c:monitors',
      'Monitores y equipo',
      going.filter((r) => r.reg.role !== 'participant'),
    );
  } else if (groupBy === 'role') {
    for (const role of ['participant', 'monitor', 'team'] as const) {
      push(
        `r:${role}`,
        ROLE_SECTION[role],
        going.filter((r) => r.reg.role === role),
      );
    }
  } else {
    const manyVenues = new Set(rooms.map((r) => r.venue)).size > 1;
    for (const room of rooms) {
      push(
        `h:${room.id}`,
        roomHeading(room, manyVenues),
        going.filter((r) => r.room?.id === room.id),
      );
    }
    push(
      'h:none',
      'Sin habitación',
      going.filter((r) => !r.room),
    );
  }

  if (gone.length > 0 && (filter === 'all' || filter === 'note')) {
    sections.push({
      key: 'out',
      title: 'No van',
      count: gone.length,
      out: true,
      rows: gone,
    });
  }
  return sections;
}

/** Los que se ven y aún faltan (para «Seleccionar los que se ven»). */
export const pendingIn = (sections: readonly CheckinSection[]) =>
  sections
    .filter((s) => !s.out)
    .flatMap((s) => s.rows)
    .filter((r) => r.eff.status === 'pending')
    .map((r) => r.id);

// ── Notas ───────────────────────────────────────────────────────────────────

/** Como la limpia el servidor (y Comunica Tools): espacios de más fuera y hasta 300. */
export const cleanNote = (note: string) =>
  note.replace(/\s+/g, ' ').trim().slice(0, MANAGED_NOTE_MAX);

// ── La lista de eventos ─────────────────────────────────────────────────────

export interface ManagedBuckets {
  today: ManagedEventSummary[];
  upcoming: ManagedEventSummary[];
  past: ManagedEventSummary[];
}

/** Hoy (en marcha), próximos (el más cercano arriba) y pasados (el más reciente arriba). */
export function classifyManaged(
  events: readonly ManagedEventSummary[],
  today: string,
): ManagedBuckets {
  const out: ManagedBuckets = { today: [], upcoming: [], past: [] };
  for (const e of events) {
    if (e.startDate <= today && e.endDate >= today) out.today.push(e);
    else if (e.startDate > today) out.upcoming.push(e);
    else out.past.push(e);
  }
  const asc = (a: ManagedEventSummary, b: ManagedEventSummary) =>
    a.startDate < b.startDate
      ? -1
      : a.startDate > b.startDate
        ? 1
        : a.name.localeCompare(b.name, 'es');
  out.today.sort(asc);
  out.upcoming.sort(asc);
  out.past.sort((a, b) => -asc(a, b));
  return out;
}

/** «87/120 han llegado» en la lista de eventos. */
export const arrivedOf = (
  e: Pick<ManagedEventSummary, 'arrived' | 'registered'>,
) =>
  e.registered === 0
    ? 'Sin inscritos'
    : `${e.arrived}/${e.registered} ${e.arrived === 1 && e.registered === 1 ? 'ha llegado' : 'han llegado'}`;
