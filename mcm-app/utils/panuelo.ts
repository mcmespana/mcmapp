/**
 * El pañuelo virtual — lógica pura (sin React, sin Firebase, sin three.js).
 *
 * Tres cosas viven aquí: sanear lo que llega de fuera (el catálogo del Panel,
 * lo que el usuario tenía guardado), decidir qué piezas se consiguen y cómo, y
 * mover piezas por el pañuelo. Todo son funciones que reciben un estado y
 * devuelven otro: así se prueban sin montar nada.
 *
 * Documentación: `docs/funcionalidades/PANUELO.md`. Contrato de datos con el
 * Panel: `docs/contratos/PANUELO_CONTRATO.md`.
 */
import { PANUELO_GLYPHS } from '@/constants/panueloGlyphs';
import type { PanueloTutorialSection } from '@/constants/panueloTutorial';
import {
  PANUELO_COLORS,
  type PanueloAttendanceMark,
  type PanueloAward,
  type PanueloCatalog,
  type PanueloColor,
  type PanueloGrant,
  type PanueloItemDef,
  type PanueloItemKind,
  type PanueloLook,
  type PanueloMemory,
  type PanueloOwned,
  type PanueloPlacement,
  type PanueloRarity,
  type PanueloUserState,
  type PanueloVia,
  type PanueloViewerState,
} from '@/types/panuelo';
import {
  clampToFlap,
  DEFAULT_REACH,
  itemReach,
  nextFreeSlot,
  normalizeRotation,
} from '@/utils/panueloPlacement';
import { sha256Hex } from '@/utils/sha256';

export const EMPTY_PANUELO: PanueloUserState = {
  color: null,
  items: {},
  layout: {},
  layoutAt: 0,
};

/** Cuántos pañuelos anteriores se guardan: los más recientes. */
export const MAX_PANUELO_HISTORY = 12;
/** Tope de piezas de un recuerdo: nadie lleva tantas, es para que un nodo
 *  mal escrito no engorde el estado. */
const MAX_MEMORY_PIECES = 100;

/** El pañuelo que se enseña a quien todavía no ha elegido el suyo. */
export const DEFAULT_PANUELO_COLOR: PanueloColor = 'green';

export const KIND_LABEL: Record<PanueloItemKind, string> = {
  chapa: 'Chapa',
  pin: 'Pin',
  cinta: 'Cinta',
  parche: 'Parche',
  medalla: 'Medalla',
  pulsera: 'Pulsera',
  troncho: 'Troncho',
};

export const RARITY_LABEL: Record<PanueloRarity, string> = {
  comun: 'Común',
  especial: 'Especial',
  unica: 'Única',
};

/** Los pañuelos, con el nombre de su etapa. */
export const COLOR_LABEL: Record<
  PanueloColor,
  { name: string; stage: string }
> = {
  red: { name: 'Rojo', stage: 'Etapa infantil' },
  green: { name: 'Verde', stage: 'Conocimiento' },
  blue: { name: 'Azul', stage: 'Incorporación y crecimiento' },
  yellow: { name: 'Amarillo', stage: 'Opción responsable' },
};

// ── Sanear ─────────────────────────────────────────────────────────────────

const KINDS: readonly PanueloItemKind[] = [
  'chapa',
  'pin',
  'cinta',
  'parche',
  'medalla',
  'pulsera',
  'troncho',
];
const RARITIES: readonly PanueloRarity[] = ['comun', 'especial', 'unica'];
const VIAS: readonly PanueloVia[] = [
  'all',
  'code',
  'manual',
  'demo',
  'trade',
  'attendance',
];
const ATTENDANCE_MARKS: readonly PanueloAttendanceMark[] = [
  'yes',
  'partial',
  'no_justified',
  'no_unjustified',
];
/** Tope de eventos de una pieza por asistencia (contrato). */
export const MAX_ATTENDANCE_EVENTS = 50;
/** Un id de pieza: `kebab-case`, de 1 a 64 caracteres (contrato). */
export const PANUELO_ITEM_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const PARCHE_SHAPES = ['circle', 'shield', 'arrow', 'rect'] as const;
const METALS = ['oro', 'plata', 'cobre', 'negro'] as const;

const isObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
const str = (x: unknown): string | undefined =>
  typeof x === 'string' && x.trim() !== '' ? x.trim() : undefined;
const num = (x: unknown): number | undefined =>
  typeof x === 'number' && Number.isFinite(x) ? x : undefined;

/** Un color CSS de los que el visor sabe pintar: `#rgb` o `#rrggbb`. */
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const color = (x: unknown): string | undefined => {
  const s = str(x);
  return s && HEX.test(s) ? s : undefined;
};
/** Solo `https`: lo carga el visor, y no queremos `javascript:` ni `file:`. */
const url = (x: unknown): string | undefined => {
  const s = str(x);
  return s && /^https:\/\/[^\s"'<>]+$/i.test(s) ? s : undefined;
};
const glyph = (x: unknown) => {
  const s = str(x);
  return s && s in PANUELO_GLYPHS
    ? (s as keyof typeof PANUELO_GLYPHS)
    : undefined;
};
const metal = (x: unknown) =>
  METALS.find((m) => m === x) as (typeof METALS)[number] | undefined;
const colors = (x: unknown): string[] =>
  (Array.isArray(x) ? x : [])
    .map(color)
    .filter((c): c is string => Boolean(c))
    .slice(0, 7);

/** El aspecto de una pieza, o `null` si no se puede dibujar. */
function sanitizeLook(kind: PanueloItemKind, raw: unknown): PanueloLook | null {
  if (!isObject(raw)) return null;
  switch (kind) {
    case 'chapa': {
      const bg = color(raw.bg);
      if (!bg) return null;
      return {
        kind,
        bg,
        ring: color(raw.ring),
        ink: color(raw.ink),
        glyph: glyph(raw.glyph),
        logo: raw.logo === true || undefined,
        text: str(raw.text)?.slice(0, 24),
        textBottom: str(raw.textBottom)?.slice(0, 24),
        image: url(raw.image),
        glb: url(raw.glb),
      };
    }
    case 'pin': {
      const shape = glyph(raw.shape);
      const enamel = color(raw.enamel);
      if (!shape || !enamel) return null;
      return {
        kind,
        shape,
        enamel,
        enamel2: color(raw.enamel2),
        metal: metal(raw.metal),
        image: url(raw.image),
        glb: url(raw.glb),
      };
    }
    case 'cinta': {
      const list = colors(raw.colors);
      return list.length > 0 ? { kind, colors: list } : null;
    }
    case 'parche': {
      const shape = PARCHE_SHAPES.find((s) => s === raw.shape);
      const bg = color(raw.bg);
      const border = color(raw.border);
      if (!shape || !bg || !border) return null;
      return {
        kind,
        shape,
        bg,
        border,
        ink: color(raw.ink),
        glyph: glyph(raw.glyph),
        text: str(raw.text)?.slice(0, 14),
      };
    }
    case 'pulsera': {
      const list = colors(raw.colors).slice(0, 6);
      if (list.length === 0) return null;
      return {
        kind,
        colors: list,
        pattern: (['chevron', 'stripes', 'solid'] as const).find(
          (p) => p === raw.pattern,
        ),
        text: str(raw.text)?.slice(0, 16),
        ink: color(raw.ink),
      };
    }
    case 'troncho':
      return {
        kind,
        leather: color(raw.leather),
        ink: color(raw.ink),
        image: url(raw.image),
        glb: url(raw.glb),
      };
    case 'medalla': {
      const ribbon = colors(raw.ribbon);
      if (ribbon.length === 0) return null;
      return {
        kind,
        ribbon,
        metal: metal(raw.metal),
        glyph: glyph(raw.glyph),
        logo: raw.logo === true || undefined,
        image: url(raw.image),
        glb: url(raw.glb),
      };
    }
  }
}

function sanitizeGrant(raw: unknown): PanueloGrant | undefined {
  if (!isObject(raw)) return undefined;
  const window = { from: num(raw.from), to: num(raw.to) };
  if (raw.type === 'all') return { type: 'all', ...window };
  if (raw.type === 'manual') return { type: 'manual' };
  if (raw.type === 'code') {
    const hash = str(raw.hash)?.toLowerCase();
    return hash && /^[0-9a-f]{64}$/.test(hash)
      ? { type: 'code', hash, ...window }
      : undefined;
  }
  if (raw.type === 'attendance') {
    // Sin `from`/`to`: manda la asistencia. Sin eventos no hay forma de
    // conseguirla: la concesión se descarta (la pieza queda sin `grant`).
    const events = [
      ...new Set(
        (Array.isArray(raw.events) ? raw.events : [])
          .map(str)
          .filter((e): e is string => Boolean(e)),
      ),
    ].slice(0, MAX_ATTENDANCE_EVENTS);
    if (events.length === 0) return undefined;
    const marks = (Array.isArray(raw.marks) ? raw.marks : []).filter(
      (m): m is PanueloAttendanceMark =>
        ATTENDANCE_MARKS.includes(m as PanueloAttendanceMark),
    );
    const minDays = num(raw.minDays);
    return compact({
      type: 'attendance' as const,
      events,
      marks: marks.length > 0 ? [...new Set(marks)] : undefined,
      minDays:
        minDays !== undefined && minDays >= 1 ? Math.floor(minDays) : undefined,
    });
  }
  return undefined;
}

/** ¿Se consigue por asistencia? */
export function isAttendancePiece(item: PanueloItemDef | undefined): boolean {
  return item?.grant?.type === 'attendance';
}

/** Quita las claves `undefined`: Firebase las rechaza y ensucian los tests. */
function compact<T extends object>(obj: T): T {
  const out = {} as Record<string, unknown>;
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as T;
}

/**
 * El catálogo, saneado. Una pieza mal escrita se descarta entera en vez de
 * tumbar el pañuelo: el Panel se puede equivocar, la pantalla no puede romperse.
 * Acepta el nodo `data` (`{ items: {...} }`) o directamente el mapa de piezas.
 */
export function sanitizeCatalog(raw: unknown): PanueloCatalog {
  const source = isObject(raw) && isObject(raw.items) ? raw.items : raw;
  const out: PanueloCatalog = {};
  if (!isObject(source)) return out;
  for (const [id, value] of Object.entries(source)) {
    if (!isObject(value) || !PANUELO_ITEM_ID.test(id)) continue;
    const kind = KINDS.find((k) => k === value.kind);
    const name = str(value.name);
    if (!kind || !name) continue;
    const look = sanitizeLook(kind, value.look);
    if (!look) continue;
    const size = num(value.size);
    const grant = sanitizeGrant(value.grant);
    out[id] = compact<PanueloItemDef>({
      id,
      kind,
      name,
      origin: str(value.origin),
      description: str(value.description),
      rarity: RARITIES.find((r) => r === value.rarity),
      size: size === undefined ? undefined : Math.min(1.5, Math.max(0.7, size)),
      look: compact(look),
      grant,
      order: num(value.order),
      secret: value.secret === true || undefined,
      // Una pieza por asistencia nunca se cambia: si se corrige la lista hay
      // que poder quitarla, y tras un intercambio no tendría arreglo.
      tradeable:
        grant?.type === 'attendance'
          ? false
          : typeof value.tradeable === 'boolean'
            ? value.tradeable
            : undefined,
    });
  }
  return out;
}

function sanitizePlacement(raw: unknown): PanueloPlacement | null {
  if (!isObject(raw)) return null;
  const u = num(raw.u);
  const v = num(raw.v);
  if (u === undefined || v === undefined) return null;
  const [cu, cv] = clampToFlap(u, v);
  return { u: cu, v: cv, rot: normalizeRotation(num(raw.rot) ?? 0) };
}

/** Un recuerdo, o `null` si no se puede volver a pintar. La clave manda sobre
 *  el `at` de dentro: es lo que dos móviles comparten para no duplicarlo. */
function sanitizeMemory(key: string, raw: unknown): PanueloMemory | null {
  if (!isObject(raw)) return null;
  const color = PANUELO_COLORS.find((c) => c === raw.color);
  const at = Number(key) > 0 ? Number(key) : num(raw.at);
  if (!color || at === undefined || !Number.isFinite(at)) return null;
  const layout: Record<string, PanueloPlacement> = {};
  if (isObject(raw.layout)) {
    for (const [id, value] of Object.entries(raw.layout)) {
      if (Object.keys(layout).length >= MAX_MEMORY_PIECES) break;
      const placement = sanitizePlacement(value);
      if (placement) layout[id] = placement;
    }
  }
  return { color, at, layout };
}

/** Se queda con los `MAX_PANUELO_HISTORY` recuerdos más recientes. */
function capHistory(
  history: Record<string, PanueloMemory>,
): Record<string, PanueloMemory> {
  const keep = Object.values(history)
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_PANUELO_HISTORY);
  const out: Record<string, PanueloMemory> = {};
  for (const memory of keep) out[String(memory.at)] = memory;
  return out;
}

function sanitizeHistory(raw: unknown): Record<string, PanueloMemory> {
  const out: Record<string, PanueloMemory> = {};
  if (!isObject(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    const memory = sanitizeMemory(key, value);
    if (memory) out[String(memory.at)] = memory;
  }
  return capHistory(out);
}

/** El estado con su historial; la clave solo existe si hay algo. */
function withHistory(
  state: PanueloUserState,
  history: Record<string, PanueloMemory>,
): PanueloUserState {
  if (Object.keys(history).length === 0) {
    if (!state.history) return state;
    const rest = { ...state };
    delete rest.history;
    return rest;
  }
  return { ...state, history };
}

/** Lo que el usuario tenía guardado (en el móvil o en la nube), saneado. */
export function sanitizeUserState(raw: unknown): PanueloUserState {
  if (!isObject(raw)) return EMPTY_PANUELO;
  const items: Record<string, PanueloOwned> = {};
  if (isObject(raw.items)) {
    for (const [id, value] of Object.entries(raw.items)) {
      if (!isObject(value)) continue;
      const at = num(value.at);
      if (at === undefined) continue;
      items[id] = { at, via: VIAS.find((v) => v === value.via) ?? 'manual' };
    }
  }
  const layout: Record<string, PanueloPlacement> = {};
  if (isObject(raw.layout)) {
    for (const [id, value] of Object.entries(raw.layout)) {
      const placement = sanitizePlacement(value);
      // Solo se puede llevar puesto lo que se tiene.
      if (placement && items[id]) layout[id] = placement;
    }
  }
  const gone: Record<string, number> = {};
  if (isObject(raw.gone)) {
    for (const [id, value] of Object.entries(raw.gone)) {
      const at = num(value);
      if (at !== undefined) gone[id] = at;
    }
  }
  return withHistory(
    withGone(
      {
        color: PANUELO_COLORS.find((c) => c === raw.color) ?? null,
        items,
        layout,
        layoutAt: num(raw.layoutAt) ?? 0,
      },
      gone,
    ),
    sanitizeHistory(raw.history),
  );
}

/**
 * Aplica el registro de piezas dadas: fuera las que se dieron después de
 * conseguirlas (y su sitio en el pañuelo). El registro solo se guarda si
 * tiene algo.
 */
function withGone(
  state: PanueloUserState,
  gone: Record<string, number>,
): PanueloUserState {
  if (Object.keys(gone).length === 0) return state;
  const items: Record<string, PanueloOwned> = {};
  for (const [id, owned] of Object.entries(state.items)) {
    if (!(gone[id] >= owned.at)) items[id] = owned;
  }
  const layout: Record<string, PanueloPlacement> = {};
  for (const [id, placement] of Object.entries(state.layout)) {
    if (items[id]) layout[id] = placement;
  }
  return { ...state, items, layout, gone };
}

// ── Fusionar móvil y nube ──────────────────────────────────────────────────

/**
 * Junta lo del móvil con lo de la nube.
 *
 * - **Las piezas se SUMAN** (unión): lo conseguido no se pierde nunca, y de
 *   una pieza repetida queda la fecha más antigua.
 * - **El color y la colocación son de quien los tocó el último** (`layoutAt`):
 *   mezclar dos colocaciones pieza a pieza deja un pañuelo que nadie hizo.
 * - **Lo dado en un intercambio se queda dado** (`gone`), venga de donde
 *   venga: si no, la suma de piezas lo resucitaría.
 * - **Los recuerdos se SUMAN** (`history`): un pañuelo que se dejó no se
 *   pierde porque el otro lado no lo tuviera, y el mismo `at` no se duplica.
 *
 * `upload` dice si la nube se queda atrás y hay que subirle la mezcla.
 */
export function mergePanuelo(
  local: PanueloUserState,
  remote: PanueloUserState,
): { merged: PanueloUserState; upload: boolean } {
  let upload = false;
  // Lo que cualquiera de los dos lados dio en un intercambio, se queda dado.
  const gone: Record<string, number> = { ...remote.gone };
  for (const [id, at] of Object.entries(local.gone ?? {})) {
    if (!(gone[id] >= at)) {
      gone[id] = at;
      upload = true;
    }
  }
  // Una copia de antes de darla ya no vale (`at <= gone`): si no se descarta
  // antes de elegir la más antigua, recuperar una pieza dada la borraría
  // (PLAN_PANUELO_INTERCAMBIOS §1.1).
  const alive = (id: string, owned: PanueloOwned | undefined) =>
    owned && !(gone[id] >= owned.at) ? owned : undefined;
  const items: Record<string, PanueloOwned> = {};
  for (const [id, theirs] of Object.entries(remote.items)) {
    const kept = alive(id, theirs);
    if (kept) items[id] = kept;
  }
  for (const [id, raw] of Object.entries(local.items)) {
    const mine = alive(id, raw);
    if (!mine) continue;
    const theirs = items[id];
    if (!theirs || mine.at < theirs.at) {
      items[id] = mine;
      upload = true;
    }
  }
  const localWins = local.layoutAt > remote.layoutAt;
  const winner = localWins ? local : remote;
  if (localWins) upload = true;
  const layout: Record<string, PanueloPlacement> = {};
  for (const [id, placement] of Object.entries(winner.layout)) {
    if (items[id]) layout[id] = placement;
  }
  const history: Record<string, PanueloMemory> = { ...remote.history };
  for (const [key, memory] of Object.entries(local.history ?? {})) {
    if (!history[key]) {
      history[key] = memory;
      upload = true;
    }
  }
  return {
    merged: withHistory(
      withGone(
        {
          color: winner.color ?? local.color ?? remote.color,
          items,
          layout,
          layoutAt: winner.layoutAt,
        },
        gone,
      ),
      capHistory(history),
    ),
    upload,
  };
}

// ── Conseguir piezas ───────────────────────────────────────────────────────

function inWindow(
  grant: { from?: number; to?: number },
  now: number,
): 'early' | 'open' | 'late' {
  if (grant.from !== undefined && now < grant.from) return 'early';
  if (grant.to !== undefined && now > grant.to) return 'late';
  return 'open';
}

/**
 * Un código tal como se compara: sin espacios, guiones ni tildes y en
 * mayúsculas. «pascua-27», «Pascua 27» y «PASCUA27» son el mismo.
 */
export function normalizeCode(code: string): string {
  return code
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
}

/**
 * El hash que guarda el catálogo para una pieza de código. Lleva el `id` de la
 * pieza dentro para que el mismo código en dos piezas no dé el mismo hash (y
 * para que el hash de una no sirva de pista para otra).
 */
export function hashPanueloCode(code: string, itemId: string): string {
  return sha256Hex(`${itemId}:${normalizeCode(code)}`);
}

export type RedeemResult =
  | { ok: true; item: PanueloItemDef; already: boolean }
  | { ok: false; reason: 'empty' | 'unknown' | 'early' | 'late' };

/** Qué pieza abre un código, si abre alguna. */
export function redeemCode(
  catalog: PanueloCatalog,
  state: PanueloUserState,
  code: string,
  now: number,
): RedeemResult {
  if (normalizeCode(code) === '') return { ok: false, reason: 'empty' };
  let closed: 'early' | 'late' | null = null;
  for (const item of Object.values(catalog)) {
    if (item.grant?.type !== 'code') continue;
    if (hashPanueloCode(code, item.id) !== item.grant.hash) continue;
    if (state.items[item.id]) return { ok: true, item, already: true };
    const when = inWindow(item.grant, now);
    if (when === 'open') return { ok: true, item, already: false };
    closed = when;
  }
  return { ok: false, reason: closed ?? 'unknown' };
}

/** Las piezas «para todo el mundo» que están abiertas y aún no se tienen. */
export function pendingAutoGrants(
  catalog: PanueloCatalog,
  state: PanueloUserState,
  now: number,
): PanueloItemDef[] {
  return sortCatalog(catalog).filter(
    (item) =>
      item.grant?.type === 'all' &&
      !state.items[item.id] &&
      inWindow(item.grant, now) === 'open',
  );
}

/** Añade una pieza a la colección. Si ya estaba, no cambia nada. */
export function grantItem(
  state: PanueloUserState,
  id: string,
  via: PanueloVia,
  now: number,
): PanueloUserState {
  if (state.items[id]) return state;
  return { ...state, items: { ...state.items, [id]: { at: now, via } } };
}

// ── Piezas por asistencia ─────────────────────────────────────────────────

/**
 * Lo concedido por asistencia (`/panueloAwards/{personId}`), saneado. Lo que
 * no tiene fecha o evento se descarta.
 */
export function sanitizeAwards(raw: unknown): Record<string, PanueloAward> {
  const out: Record<string, PanueloAward> = {};
  if (!isObject(raw)) return out;
  for (const [id, value] of Object.entries(raw)) {
    if (!PANUELO_ITEM_ID.test(id) || !isObject(value)) continue;
    const at = num(value.at);
    const eventId = str(value.eventId);
    if (at === undefined || !eventId) continue;
    out[id] = {
      at,
      via: 'attendance',
      eventId,
      grantedAt: num(value.grantedAt) ?? at,
    };
  }
  return out;
}

/**
 * ¿La gobierna lo concedido por asistencia? Las que llegaron por asistencia
 * y cualquier pieza `attendance` del catálogo, salvo las de muestra del
 * Laboratorio (`demo`). Que el reflejo diga «attendance» no basta: tiene que
 * estar en `awards`.
 */
function followsAwards(
  owned: PanueloOwned,
  item: PanueloItemDef | undefined,
): boolean {
  return (
    owned.via === 'attendance' ||
    (isAttendancePiece(item) && owned.via !== 'demo')
  );
}

/**
 * Refleja en el estado de la persona lo que dice el servidor de sus piezas
 * por asistencia (`PLAN_PANUELO_ASISTENCIA.md` §2.1). La pieza **sigue
 * siempre a la asistencia**:
 *
 * - Lo concedido que no se tenía entra en la colección (`via: attendance`,
 *   con su fecha) **sin coserse**: espera en la caja a que se desvele.
 * - Lo que ya no está respaldado sale de la colección y, si estaba cosido,
 *   **se descose** (las demás piezas no se mueven).
 * - Si luego vuelve, entra como nueva y otra vez a la caja.
 *
 * Quien llama decide qué es «sin poder leer»: entonces NO se llama (sin red
 * no se quita nada). Devuelve el mismo objeto si no cambia nada.
 */
export function reconcileAwards(
  state: PanueloUserState,
  awards: Record<string, PanueloAward>,
  catalog: PanueloCatalog,
  now: number,
): { state: PanueloUserState; granted: string[]; revoked: string[] } {
  const items = { ...state.items };
  const layout = { ...state.layout };
  const granted: string[] = [];
  const revoked: string[] = [];
  let unsewn = false;
  for (const [id, owned] of Object.entries(state.items)) {
    if (awards[id] || !followsAwards(owned, catalog[id])) continue;
    delete items[id];
    if (layout[id]) {
      delete layout[id];
      unsewn = true;
    }
    revoked.push(id);
  }
  for (const [id, award] of Object.entries(awards)) {
    if (items[id] || !isAttendancePiece(catalog[id])) continue;
    items[id] = { at: award.at, via: 'attendance' };
    granted.push(id);
  }
  if (granted.length === 0 && revoked.length === 0) {
    return { state, granted, revoked };
  }
  return {
    state: {
      ...state,
      items,
      layout,
      layoutAt: unsewn ? now : state.layoutAt,
    },
    granted: granted.sort(),
    revoked: revoked.sort(),
  };
}

/**
 * Las piezas que esperan su desvelado: llegaron por asistencia, aún no se
 * han presentado en este móvil y están en la caja. Por fecha.
 */
export function newPiecesQueue(
  catalog: PanueloCatalog,
  state: PanueloUserState,
  unseen: readonly string[],
): string[] {
  return unseen.filter(
    (id) =>
      catalog[id] && state.items[id]?.via === 'attendance' && !state.layout[id],
  );
}

/** Una pieza por asistencia que se quitó y hay que avisar (una vez). */
export interface RevokedPiece {
  id: string;
  name: string;
  origin?: string;
}

/**
 * La línea discreta de lo retirado: «Ya no tienes «Chapa de Pascua»: se
 * corrigió la lista de Pascua Joven 2027.» `null` si no hay nada.
 */
export function revokedNoticeText(
  pieces: readonly RevokedPiece[],
): string | null {
  if (pieces.length === 0) return null;
  if (pieces.length === 1) {
    const [only] = pieces;
    return only.origin
      ? `Ya no tienes «${only.name}»: se corrigió la lista de ${only.origin}.`
      : `Ya no tienes «${only.name}»: se corrigió la lista.`;
  }
  const names = pieces.map((p) => `«${p.name}»`);
  return `Ya no tienes ${names.slice(0, -1).join(', ')} ni ${names.at(-1)}: se corrigieron las listas.`;
}

/** El primer color de una pieza: el del confeti cuando se desvela. */
export function pieceAccent(look: PanueloLook): string | undefined {
  switch (look.kind) {
    case 'chapa':
    case 'parche':
      return look.bg;
    case 'pin':
      return look.enamel;
    case 'medalla':
      return look.ribbon[0];
    case 'cinta':
    case 'pulsera':
      return look.colors[0];
    case 'troncho':
      return look.leather;
  }
}

/** «Por ir a Pascua Joven · Abril 2027.» */
export function newPieceReason(item: PanueloItemDef): string {
  if (isAttendancePiece(item)) {
    return item.origin ? `Por ir a ${item.origin}.` : 'Por ir a una actividad.';
  }
  return item.origin ? `${item.origin}.` : 'Una pieza nueva para tu pañuelo.';
}

/**
 * Las páginas del desvelado, una por pieza nueva: se pintan con el mismo
 * componente que el tutorial (`PanueloTutorial`). El visor enseña el pañuelo
 * de la persona con la pieza presentándose (`example.reveal`); la pieza solo
 * se cose de mentira mientras dura la página: luego espera en la caja.
 */
export function newPiecesSections(
  catalog: PanueloCatalog,
  state: PanueloUserState,
  ids: readonly string[],
): PanueloTutorialSection[] {
  const color = state.color ?? DEFAULT_PANUELO_COLOR;
  return ids
    .filter((id) => catalog[id] && state.items[id])
    .map((id, i, list) => {
      const item = catalog[id];
      const kind = item.rarity
        ? `${KIND_LABEL[item.kind]} · ${RARITY_LABEL[item.rarity]}`
        : KIND_LABEL[item.kind];
      const last = i === list.length - 1;
      return {
        id: `nueva-${id}`,
        title: item.name,
        body: newPieceReason(item),
        rows: [
          { icon: 'category', title: kind, text: item.description },
          {
            icon: 'event',
            title: `La conseguiste el ${formatOwnedDate(state.items[id].at)}`,
          },
          ...(last
            ? [
                {
                  icon: 'inventory-2' as const,
                  title:
                    list.length === 1
                      ? 'Te espera en tu colección'
                      : 'Te esperan en tu colección',
                  text: 'Las colocas en tu pañuelo cuando quieras, en «Sin poner».',
                },
              ]
            : []),
        ],
        example: { color, pieces: [id], reveal: id },
      };
    });
}

// ── Decorar ────────────────────────────────────────────────────────────────

/** Piezas con sitio propio fuera del triángulo: hoy, solo el troncho. */
export function isFixed(item: PanueloItemDef | undefined): boolean {
  return item?.kind === 'troncho';
}

/** Lo que se apunta en `layout` para una pieza de sitio fijo. */
const FIXED_PLACEMENT: PanueloPlacement = { u: 0, v: 0, rot: 0 };

/**
 * Cose una pieza en el primer hueco libre. Sin tenerla, no se puede. Con el
 * catálogo delante, el hueco se busca sabiendo lo que ocupa cada pieza (una
 * medalla pide más sitio que un pin).
 */
export function placeItem(
  state: PanueloUserState,
  id: string,
  now: number,
  catalog?: PanueloCatalog,
): PanueloUserState {
  if (!state.items[id] || state.layout[id]) return state;
  const reachOf = (itemId: string) => {
    const def = catalog?.[itemId];
    return def ? itemReach(def.kind, def.size) : DEFAULT_REACH;
  };
  // El troncho no se cose en el triángulo: va sobre el nudo. Se apunta en
  // `layout` (para saber que se lleva puesto) sin gastar un hueco.
  const slot = isFixed(catalog?.[id])
    ? FIXED_PLACEMENT
    : nextFreeSlot(
        Object.entries(state.layout)
          .filter(([itemId]) => !isFixed(catalog?.[itemId]))
          .map(([itemId, p]) => ({
            u: p.u,
            v: p.v,
            reach: reachOf(itemId),
          })),
        reachOf(id),
      );
  return {
    ...state,
    layout: { ...state.layout, [id]: slot },
    layoutAt: now,
  };
}

/** Descose una pieza: vuelve a la caja, no se pierde. */
export function unplaceItem(
  state: PanueloUserState,
  id: string,
  now: number,
): PanueloUserState {
  if (!state.layout[id]) return state;
  const layout = { ...state.layout };
  delete layout[id];
  return { ...state, layout, layoutAt: now };
}

export function moveItem(
  state: PanueloUserState,
  id: string,
  u: number,
  v: number,
  now: number,
): PanueloUserState {
  const current = state.layout[id];
  if (!current) return state;
  const [cu, cv] = clampToFlap(u, v);
  return {
    ...state,
    layout: { ...state.layout, [id]: { ...current, u: cu, v: cv } },
    layoutAt: now,
  };
}

export function rotateItem(
  state: PanueloUserState,
  id: string,
  degrees: number,
  now: number,
): PanueloUserState {
  const current = state.layout[id];
  if (!current) return state;
  return {
    ...state,
    layout: {
      ...state.layout,
      [id]: { ...current, rot: normalizeRotation(current.rot + degrees) },
    },
    layoutAt: now,
  };
}

export function setPanueloColor(
  state: PanueloUserState,
  next: PanueloColor,
  now: number,
): PanueloUserState {
  if (state.color === next) return state;
  return { ...state, color: next, layoutAt: now };
}

// ── Cambiar de etapa ───────────────────────────────────────────────────────

/**
 * Guarda el pañuelo de ahora en el historial. Un pañuelo sin ninguna pieza
 * cosida no es un recuerdo: no se guarda nada. Los recuerdos son del tamaño
 * que dice `MAX_PANUELO_HISTORY`: al pasarse, salen los más antiguos.
 */
export function archivePanuelo(
  state: PanueloUserState,
  now: number,
): PanueloUserState {
  if (Object.keys(state.layout).length === 0) return state;
  const history = { ...state.history };
  // Dos recuerdos no comparten clave: si coincide el milisegundo, el siguiente.
  let at = now;
  while (history[String(at)]) at += 1;
  history[String(at)] = {
    color: state.color ?? DEFAULT_PANUELO_COLOR,
    at,
    layout: { ...state.layout },
  };
  return { ...state, history: capHistory(history) };
}

/**
 * Cambio de etapa: se archiva el pañuelo de ahora y se pasa al color nuevo.
 * Con `keepPieces` las piezas se quedan cosidas donde estaban; sin él se
 * descosen todas (vuelven a la colección: siguen siendo tuyas).
 */
export function changeStage(
  state: PanueloUserState,
  next: PanueloColor,
  keepPieces: boolean,
  now: number,
): PanueloUserState {
  if (next === (state.color ?? DEFAULT_PANUELO_COLOR)) return state;
  const archived = archivePanuelo(state, now);
  return {
    ...archived,
    color: next,
    layout: keepPieces ? archived.layout : {},
    layoutAt: now,
  };
}

/**
 * «Recolocar»: reparte solas todas las piezas cosidas, sin que se pisen y
 * esquivando el logo. Parte de un pañuelo vacío y va colocando de mayor a
 * menor (`itemReach`): las grandes (medallas, pulseras) se llevan los huecos
 * buenos y las pequeñas rellenan, que reparte mejor que por orden de
 * llegada. A igualdad, por id, para que el resultado sea siempre el mismo.
 * Todas a rotación 0. Las piezas en la caja se quedan en la caja.
 */
export function autoArrange(
  state: PanueloUserState,
  catalog: PanueloCatalog,
  now: number,
): PanueloUserState {
  const reachOf = (id: string) => {
    const def = catalog[id];
    return def ? itemReach(def.kind, def.size) : DEFAULT_REACH;
  };
  const ids = Object.keys(state.layout)
    .filter((id) => state.items[id])
    .sort((a, b) => reachOf(b) - reachOf(a) || a.localeCompare(b));
  if (ids.length === 0) return state;
  const layout: Record<string, PanueloPlacement> = {};
  const taken: { u: number; v: number; reach: number }[] = [];
  for (const id of ids) {
    if (isFixed(catalog[id])) {
      layout[id] = FIXED_PLACEMENT;
      continue;
    }
    const reach = reachOf(id);
    const slot = nextFreeSlot(taken, reach);
    layout[id] = { u: slot.u, v: slot.v, rot: 0 };
    taken.push({ u: slot.u, v: slot.v, reach });
  }
  return { ...state, layout, layoutAt: now };
}

/** Los colores que Comunica sabe darnos como pañuelo (los otros no son un color). */
export function comunicaScarfColor(scarf: unknown): PanueloColor | null {
  return PANUELO_COLORS.find((c) => c === scarf) ?? null;
}

/**
 * Qué hacer con el pañuelo que dice Comunica (`mcm.scarf`):
 * - `manual`: Comunica no da color (`none`, `unknown`, `cross`, nada): se elige
 *   a mano, como siempre.
 * - `same`: coincide con el guardado: el color es de Comunica y no hay nada
 *   que preguntar.
 * - `assign`: nunca se eligió color (el verde que se veía era el de por
 *   defecto, no el suyo): se asigna sin preguntar ni celebrar. Las piezas
 *   cosidas que pueda haber son la de bienvenida: no hay etapa que despedir.
 * - `change`: había uno guardado y Comunica dice otro: etapa nueva.
 */
export type ScarfDecision =
  | { kind: 'manual' }
  | { kind: 'same' | 'assign' | 'change'; color: PanueloColor };

export function decideScarfStage(
  scarf: unknown,
  state: PanueloUserState,
): ScarfDecision {
  const color = comunicaScarfColor(scarf);
  if (!color) return { kind: 'manual' };
  if (state.color === null) return { kind: 'assign', color };
  return { kind: state.color === color ? 'same' : 'change', color };
}

/**
 * El pañuelo de ejemplo del tutorial: un color y unas piezas del catálogo
 * (cosidas en los primeros huecos). No es de nadie: no se guarda.
 *
 * Con `base` (el desvelado) parte del pañuelo de la persona tal como lo
 * lleva y cose las piezas en los huecos que queden libres.
 */
export function exampleViewerState(
  catalog: PanueloCatalog,
  color: PanueloColor,
  pieceIds: readonly string[],
  base?: PanueloUserState,
): PanueloViewerState {
  let s: PanueloUserState = { ...(base ?? EMPTY_PANUELO), color };
  for (const id of pieceIds) {
    if (!catalog[id]) continue;
    s = placeItem(grantItem(s, id, 'demo', 0), id, 0, catalog);
  }
  return toViewerState(catalog, s);
}

/** Los recuerdos de `after` que `before` no tenía (los que hay que subir). */
export function newMemories(
  before: PanueloUserState,
  after: PanueloUserState,
): PanueloMemory[] {
  return Object.entries(after.history ?? {})
    .filter(([key]) => !before.history?.[key])
    .map(([, memory]) => memory);
}

/** El historial, del más reciente al más antiguo. */
export function listMemories(state: PanueloUserState): PanueloMemory[] {
  return Object.values(state.history ?? {}).sort((a, b) => b.at - a.at);
}

// ── Leer ───────────────────────────────────────────────────────────────────

/** El catálogo en el orden en que se enseña: por `order` y luego por nombre. */
export function sortCatalog(catalog: PanueloCatalog): PanueloItemDef[] {
  return Object.values(catalog).sort(
    (a, b) =>
      (a.order ?? 1000) - (b.order ?? 1000) ||
      a.name.localeCompare(b.name, 'es'),
  );
}

export interface PanueloCollectionEntry {
  item: PanueloItemDef;
  owned: PanueloOwned | null;
  placed: boolean;
}

/**
 * La colección tal como se enseña: primero lo que se tiene (lo último
 * conseguido, delante) y después lo que falta. Las piezas secretas no salen
 * hasta que se consiguen.
 */
export function buildCollection(
  catalog: PanueloCatalog,
  state: PanueloUserState,
): PanueloCollectionEntry[] {
  const entries = sortCatalog(catalog)
    .map((item) => ({
      item,
      owned: state.items[item.id] ?? null,
      placed: Boolean(state.layout[item.id]),
    }))
    .filter((e) => e.owned || !e.item.secret);
  const mine = entries
    .filter((e) => e.owned)
    .sort((a, b) => (b.owned?.at ?? 0) - (a.owned?.at ?? 0));
  return [...mine, ...entries.filter((e) => !e.owned)];
}

export function summarizePanuelo(
  catalog: PanueloCatalog,
  state: PanueloUserState,
): { owned: number; total: number; placed: number } {
  const collection = buildCollection(catalog, state);
  return {
    owned: collection.filter((e) => e.owned).length,
    total: collection.length,
    placed: collection.filter((e) => e.placed).length,
  };
}

/** Lo que se le manda al visor 3D: el color y las piezas cosidas. */
export function toViewerState(
  catalog: PanueloCatalog,
  state: PanueloUserState,
): PanueloViewerState {
  const worn = Object.entries(state.layout).filter(
    ([id]) => catalog[id] && state.items[id],
  );
  const fixed = worn.find(([id]) => isFixed(catalog[id]));
  const troncho = fixed ? catalog[fixed[0]].look : undefined;
  const items = worn
    .filter(([id]) => !isFixed(catalog[id]))
    // Orden estable: el visor reconstruye lo que cambia de sitio en la lista.
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, placement]) => {
      const def = catalog[id];
      return compact({
        id,
        kind: def.kind,
        look: def.look,
        size: def.size,
        ...placement,
      });
    });
  return compact({
    color: state.color ?? DEFAULT_PANUELO_COLOR,
    items,
    troncho: troncho?.kind === 'troncho' ? troncho : undefined,
  });
}

/**
 * Un recuerdo tal como se le manda al visor: las piezas que llevaba y que
 * siguen en el catálogo (una que el Panel ya quitó no se pinta).
 */
export function memoryToViewerState(
  catalog: PanueloCatalog,
  memory: PanueloMemory,
): PanueloViewerState {
  const items: Record<string, PanueloOwned> = {};
  for (const id of Object.keys(memory.layout)) {
    items[id] = { at: memory.at, via: 'manual' };
  }
  return toViewerState(catalog, {
    color: memory.color,
    items,
    layout: memory.layout,
    layoutAt: memory.at,
  });
}

/**
 * Las piezas de un recuerdo como entradas de colección, para recorrerlas sin
 * tocar el 3D. Lo que se tiene hoy conserva su fecha; lo que ya no, se
 * enseña igual (se llevaba entonces).
 */
export function buildMemoryCollection(
  catalog: PanueloCatalog,
  state: PanueloUserState,
  memory: PanueloMemory,
): PanueloCollectionEntry[] {
  return sortCatalog(catalog)
    .filter((item) => memory.layout[item.id])
    .map((item) => ({
      item,
      owned: state.items[item.id] ?? { at: memory.at, via: 'manual' as const },
      placed: true,
    }));
}

/** Cuántas piezas de un recuerdo se pueden enseñar (siguen en el catálogo). */
export function memoryPieceCount(
  catalog: PanueloCatalog,
  memory: PanueloMemory,
): number {
  return Object.keys(memory.layout).filter((id) => catalog[id]).length;
}

/** Qué piezas enseña el cajón de la colección. */
export type CollectionFilter = 'all' | 'placed' | 'boxed';

/**
 * «Puestas» = las que tienes y llevas cosidas; «Sin poner» = las que tienes y
 * no (lo útil al decorar); «Todas» incluye las siluetas de las que faltan.
 */
export function filterCollection(
  entries: PanueloCollectionEntry[],
  filter: CollectionFilter,
): PanueloCollectionEntry[] {
  if (filter === 'placed') return entries.filter((e) => e.owned && e.placed);
  if (filter === 'boxed') return entries.filter((e) => e.owned && !e.placed);
  return entries;
}

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** «12 de abril de 2027». */
export function formatOwnedDate(at: number): string {
  const d = new Date(at);
  return `${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
}

/** «noviembre de 2026». */
export function formatMonthYear(at: number): string {
  const d = new Date(at);
  return `${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
}

/**
 * ¿Se puede intercambiar esta pieza? Decisión del propietario (2026-11-16):
 * pulseras y chapas comunes, y **nunca** medallas ni piezas únicas (las
 * únicas son las de un evento: se ganan por haber estado). Lo segundo no lo
 * cambia el catálogo; lo primero sí (`tradeable: false` para quitar una
 * pulsera, `tradeable: true` para sumar un pin o una chapa especial).
 */
export function isTradeable(item: PanueloItemDef): boolean {
  if (item.kind === 'medalla' || item.kind === 'troncho') return false;
  if (isAttendancePiece(item)) return false;
  if (item.rarity === 'unica') return false;
  if (item.tradeable !== undefined) return item.tradeable;
  return (
    item.kind === 'pulsera' ||
    (item.kind === 'chapa' && (item.rarity ?? 'comun') === 'comun')
  );
}
