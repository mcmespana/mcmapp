// utils/comunica/rooms.ts
//
// Las habitaciones de un evento que se gestiona (plan 18), sin React. Es el
// mismo modelo que Comunica Tools (`comunicatools:src/domain/lodging.ts` y
// `checkin.ts`), con lo que trae el middleware:
//
//   · La OCUPACIÓN de una habitación: las inscripciones que cuentan (todas
//     menos las canceladas; quien «no viene» sigue ocupando su cama, como
//     allí) más lo puesto a mano en Comunica Tools (`roomExtras`: alguien no
//     inscrito o plazas reservadas). Con lo que hay en la cola del móvil
//     encima: un cambio se ve al momento.
//   · El ORDEN: por alojamiento (en el orden en que llegan), planta y código,
//     los dos en orden natural («2» antes que «10»; sin planta, al final).
//   · Para ELEGIR rápido: la última usada arriba (si cabe), luego las que ya
//     tienen gente y hueco (se llenan antes de abrir otra), las vacías y, al
//     final, las que no caben. Pasarse se deja: se ve en rojo.
//   · Chicas y chicos dentro, como en Comunica Tools, NO: el contrato no trae
//     el sexo de los inscritos (`ManagedRegistration`). En su lugar, quién hay.

import type {
  ManagedEventDetail,
  ManagedRegistration,
  ManagedRoom,
  RoomExtra,
} from '@/services/comunica/contract';
import type { Effective } from './checkin';
import { nameKey } from './nameKey';
import { fold } from './search';

/** «2» antes que «10», sin mayúsculas ni acentos. */
export const naturalCompare = (a: string, b: string) =>
  a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });

/** Un código para buscar: sin espacios, mayúsculas ni acentos («B 10» = «b10»). */
const codeKey = (s: string) => fold(s).replace(/\s+/g, '');

/** «Planta 1», «Baja» (tal cual si no es un número) y «Sin planta». */
export function floorLabel(floor: string | null | undefined): string {
  if (!floor) return 'Sin planta';
  return /^-?\d+$/.test(floor) ? `Planta ${floor}` : floor;
}

/** «P1» de «1»; otra planta («Baja»), tal cual; sin planta, nada. */
export const floorShort = (floor: string | null | undefined) =>
  !floor ? '' : /^-?\d+$/.test(floor) ? `P${floor}` : floor;

/**
 * Lo puesto a mano en las habitaciones. Un evento guardado en el móvil antes
 * de que existiera no lo trae (el esquema le pone `[]` al leer, pero lo
 * guardado no vuelve a pasar por él).
 */
export const roomExtrasOf = (d: Pick<ManagedEventDetail, 'roomExtras'>) =>
  ((d.roomExtras as RoomExtra[] | undefined) ?? []).filter((x) => x.seats > 0);

/** Los alojamientos, en el orden en que llegan sus habitaciones. */
export const venuesOf = (rooms: readonly ManagedRoom[]) => [
  ...new Set(rooms.map((r) => r.venue)),
];

const floorCmp = (a: string | null, b: string | null) =>
  !a ? (b ? 1 : 0) : !b ? -1 : naturalCompare(a, b);

/** Por alojamiento (su orden de llegada), planta y código. */
export function sortRooms<T extends ManagedRoom>(rooms: readonly T[]): T[] {
  const venue = new Map(venuesOf(rooms).map((v, i) => [v, i]));
  return [...rooms].sort(
    (a, b) =>
      venue.get(a.venue)! - venue.get(b.venue)! ||
      floorCmp(a.floor, b.floor) ||
      naturalCompare(a.code, b.code),
  );
}

/** «Hab. 101» (al lado del nombre). */
export const roomShort = (r: Pick<ManagedRoom, 'code'>) => `Hab. ${r.code}`;

/** «Habitación 101 · Planta 1 · Casa X» (el alojamiento, solo si hay varios). */
export const roomHeading = (r: ManagedRoom, manyVenues: boolean) =>
  [
    `Habitación ${r.code}`,
    r.floor ? floorLabel(r.floor) : null,
    manyVenues ? r.venue : null,
  ]
    .filter(Boolean)
    .join(' · ');

// ── Ocupación ───────────────────────────────────────────────────────────────

export type RoomTone = 'empty' | 'free' | 'full' | 'over';

/** Vacía, con hueco, llena o pasada. Capacidad 0 con alguien dentro: pasada. */
export function roomTone(taken: number, capacity: number): RoomTone {
  if (taken > capacity) return 'over';
  if (taken === 0) return 'empty';
  return taken === capacity ? 'full' : 'free';
}

export interface RoomUse {
  room: ManagedRoom;
  /** Las inscripciones que la ocupan (por apellidos). */
  people: ManagedRegistration[];
  extras: RoomExtra[];
  /** Plazas ocupadas: personas más lo puesto a mano. */
  taken: number;
  capacity: number;
  tone: RoomTone;
}

/** «queda 1», «quedan 3», «llena», «se pasa 1». */
export function freeLabel(u: Pick<RoomUse, 'taken' | 'capacity'>): string {
  const left = u.capacity - u.taken;
  return left > 1
    ? `quedan ${left}`
    : left === 1
      ? 'queda 1'
      : left === 0
        ? 'llena'
        : `se pasa ${-left}`;
}

const byName = (a: ManagedRegistration, b: ManagedRegistration) => {
  const x = nameKey(a.lastName, a.firstName);
  const y = nameKey(b.lastName, b.firstName);
  return x < y ? -1 : x > y ? 1 : 0;
};

/**
 * Cuántos hay en cada habitación del evento, con la habitación de cada uno
 * tal y como se pinta (servidor y cola, `eff`). Las canceladas no ocupan; una
 * habitación que ya no es del evento no cuenta.
 */
export function roomOccupancy(
  detail: Pick<ManagedEventDetail, 'registrations' | 'rooms' | 'roomExtras'>,
  eff: ReadonlyMap<string, Pick<Effective, 'roomId'>>,
): Map<string, RoomUse> {
  const out = new Map<string, RoomUse>();
  for (const room of detail.rooms) {
    out.set(room.id, {
      room,
      people: [],
      extras: [],
      taken: 0,
      capacity: room.capacity,
      tone: 'empty',
    });
  }
  for (const x of roomExtrasOf(detail)) {
    const u = out.get(x.roomId);
    if (!u) continue;
    u.extras.push(x);
    u.taken += x.seats;
  }
  for (const r of detail.registrations) {
    if (r.registrationStatus) continue;
    const id = eff.get(r.registrationId)?.roomId;
    const u = id ? out.get(id) : undefined;
    if (!u) continue;
    u.people.push(r);
    u.taken += 1;
  }
  for (const u of out.values()) {
    u.people.sort(byName);
    u.tone = roomTone(u.taken, u.capacity);
  }
  return out;
}

export interface RoomStats {
  rooms: number;
  /** Plazas de todas las habitaciones. */
  beds: number;
  /** Plazas ocupadas (personas y lo puesto a mano). */
  taken: number;
  /** Inscritos que cuentan con habitación. */
  placed: number;
  /** Inscritos que cuentan sin habitación y que no han dicho que no vienen. */
  unplaced: number;
  /** Habitaciones pasadas de su capacidad. */
  over: number;
}

export function roomStats(
  detail: Pick<ManagedEventDetail, 'registrations' | 'rooms'>,
  eff: ReadonlyMap<string, Pick<Effective, 'roomId' | 'status'>>,
  occ: ReadonlyMap<string, RoomUse>,
): RoomStats {
  const live = detail.registrations.filter((r) => !r.registrationStatus);
  const has = (r: ManagedRegistration) => {
    const id = eff.get(r.registrationId)?.roomId;
    return !!id && occ.has(id);
  };
  const uses = [...occ.values()];
  return {
    rooms: detail.rooms.length,
    beds: detail.rooms.reduce((n, r) => n + r.capacity, 0),
    taken: uses.reduce((n, u) => n + u.taken, 0),
    placed: live.filter(has).length,
    unplaced: live.filter(
      (r) => !has(r) && eff.get(r.registrationId)?.status !== 'absent',
    ).length,
    over: uses.filter((u) => u.tone === 'over').length,
  };
}

/** Los que cuentan y aún no tienen habitación (sin los que no vienen), por apellidos. */
export function unplacedPeople(
  detail: Pick<ManagedEventDetail, 'registrations'>,
  eff: ReadonlyMap<string, Pick<Effective, 'roomId' | 'status'>>,
  occ: ReadonlyMap<string, RoomUse>,
): ManagedRegistration[] {
  return detail.registrations
    .filter((r) => {
      if (r.registrationStatus) return false;
      const e = eff.get(r.registrationId);
      return !(e?.roomId && occ.has(e.roomId)) && e?.status !== 'absent';
    })
    .sort(byName);
}

// ── Elegir habitación ───────────────────────────────────────────────────────

export interface RoomOption {
  use: RoomUse;
  /** Cuántos habría después de poner a los de ahora. */
  after: number;
  fits: boolean;
  /** Es la suya (cambiar de habitación). */
  current: boolean;
  /** La última que se ha usado en esta pantalla (si cabe). */
  last: boolean;
}

/**
 * Las habitaciones para elegir, en el orden en que más rápido se reparte:
 * 1. la última usada (si cabe y no es la suya);
 * 2. las que tienen gente y hueco: se llenan antes de abrir otra;
 * 3. las vacías;
 * 4. las que no caben (llenas o pasadas): se pueden elegir, pero al final.
 * Dentro de cada tanda, por alojamiento, planta y código. Con `query`, solo
 * las que encajan: el código (sin espacios ni mayúsculas), el principio de la
 * planta («p1», «planta 1», «baja») o, con varios alojamientos, el del nombre.
 */
export function roomOptions(
  occ: ReadonlyMap<string, RoomUse>,
  {
    adding = 1,
    current = null,
    last = null,
    query = '',
  }: {
    adding?: number;
    current?: string | null;
    last?: string | null;
    query?: string;
  } = {},
): RoomOption[] {
  const uses = [...occ.values()];
  const sorted = sortRooms(uses.map((u) => u.room));
  const many = venuesOf(sorted).length > 1;
  const q = codeKey(query);
  const order = new Map(sorted.map((r, i) => [r.id, i]));
  const out: { opt: RoomOption; tier: number }[] = [];
  for (const use of uses) {
    const { room } = use;
    if (
      q &&
      !(
        codeKey(room.code).includes(q) ||
        codeKey(floorLabel(room.floor)).startsWith(q) ||
        codeKey(floorShort(room.floor)).startsWith(q) ||
        (many && codeKey(room.venue).startsWith(q))
      )
    ) {
      continue;
    }
    const isCurrent = current === room.id;
    const after = use.taken + (isCurrent ? 0 : adding);
    const fits = after <= room.capacity;
    const isLast = !!last && last === room.id && !isCurrent && fits;
    const tier = isLast ? 0 : !fits ? 3 : use.taken === 0 ? 2 : 1;
    out.push({
      opt: { use, after, fits, current: isCurrent, last: isLast },
      tier,
    });
  }
  return out
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        order.get(a.opt.use.room.id)! - order.get(b.opt.use.room.id)!,
    )
    .map((x) => x.opt);
}

/** Lo que dice el lector de una habitación en el selector. */
export function roomOptionLabel(o: RoomOption, manyVenues: boolean): string {
  const { room, taken, capacity, people, extras } = o.use;
  const inside = [
    ...people.map((p) => `${p.firstName} ${p.lastName}`),
    ...extras.map((x) => x.label),
  ];
  return [
    `${roomHeading(room, manyVenues)}: ${taken} de ${capacity}`,
    o.fits ? null : 'no cabe',
    o.current ? 'la de ahora' : null,
    o.last ? 'la de antes' : null,
    inside.length ? `dentro: ${inside.join(', ')}` : 'vacía',
  ]
    .filter(Boolean)
    .join(', ');
}

/**
 * Para deshacer un cambio de habitación de varios: sus habitaciones de antes,
 * agrupadas (cada grupo, una tanda). `null` = no tenían.
 */
export function roomUndoGroups(
  ids: readonly string[],
  eff: ReadonlyMap<string, Pick<Effective, 'roomId'>>,
): { roomId: string | null; ids: string[] }[] {
  const by = new Map<string | null, string[]>();
  for (const id of ids) {
    const prev = eff.get(id)?.roomId ?? null;
    by.set(prev, [...(by.get(prev) ?? []), id]);
  }
  return [...by.entries()].map(([roomId, list]) => ({ roomId, ids: list }));
}

// ── La vista «Habitaciones» ─────────────────────────────────────────────────

export interface RoomFloorSection {
  key: string;
  /** «Planta 1» o, con varios alojamientos, «Casa X · Planta 1». */
  title: string;
  /** Plazas ocupadas y totales de la planta. */
  taken: number;
  capacity: number;
  rooms: RoomUse[];
}

/** Las habitaciones por alojamiento y planta, en su orden. */
export function roomsByFloor(
  occ: ReadonlyMap<string, RoomUse>,
): RoomFloorSection[] {
  const rooms = sortRooms([...occ.values()].map((u) => u.room));
  const many = venuesOf(rooms).length > 1;
  const out: RoomFloorSection[] = [];
  for (const room of rooms) {
    const key = `${room.venue}\u0000${room.floor ?? ''}`;
    let s = out.at(-1);
    if (!s || s.key !== key) {
      s = {
        key,
        title: many
          ? `${room.venue} · ${floorLabel(room.floor)}`
          : floorLabel(room.floor),
        taken: 0,
        capacity: 0,
        rooms: [],
      };
      out.push(s);
    }
    const u = occ.get(room.id)!;
    s.rooms.push(u);
    s.taken += u.taken;
    s.capacity += u.capacity;
  }
  return out;
}
