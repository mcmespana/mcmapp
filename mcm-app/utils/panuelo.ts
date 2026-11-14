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
import {
  PANUELO_COLORS,
  type PanueloCatalog,
  type PanueloColor,
  type PanueloGrant,
  type PanueloItemDef,
  type PanueloItemKind,
  type PanueloLook,
  type PanueloOwned,
  type PanueloPlacement,
  type PanueloRarity,
  type PanueloUserState,
  type PanueloVia,
  type PanueloViewerState,
} from '@/types/panuelo';
import {
  clampToFlap,
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

/** El pañuelo que se enseña a quien todavía no ha elegido el suyo. */
export const DEFAULT_PANUELO_COLOR: PanueloColor = 'green';

export const KIND_LABEL: Record<PanueloItemKind, string> = {
  chapa: 'Chapa',
  pin: 'Pin',
  cinta: 'Cinta',
  parche: 'Parche',
  medalla: 'Medalla',
  pulsera: 'Pulsera',
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
];
const RARITIES: readonly PanueloRarity[] = ['comun', 'especial', 'unica'];
const VIAS: readonly PanueloVia[] = ['all', 'code', 'manual', 'demo', 'trade'];
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
  return undefined;
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
    if (!isObject(value) || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) continue;
    const kind = KINDS.find((k) => k === value.kind);
    const name = str(value.name);
    if (!kind || !name) continue;
    const look = sanitizeLook(kind, value.look);
    if (!look) continue;
    const size = num(value.size);
    out[id] = compact<PanueloItemDef>({
      id,
      kind,
      name,
      origin: str(value.origin),
      description: str(value.description),
      rarity: RARITIES.find((r) => r === value.rarity),
      size: size === undefined ? undefined : Math.min(1.5, Math.max(0.7, size)),
      look: compact(look),
      grant: sanitizeGrant(value.grant),
      order: num(value.order),
      secret: value.secret === true || undefined,
      tradeable:
        typeof value.tradeable === 'boolean' ? value.tradeable : undefined,
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
  return withGone(
    {
      color: PANUELO_COLORS.find((c) => c === raw.color) ?? null,
      items,
      layout,
      layoutAt: num(raw.layoutAt) ?? 0,
    },
    gone,
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
 *
 * `upload` dice si la nube se queda atrás y hay que subirle la mezcla.
 */
export function mergePanuelo(
  local: PanueloUserState,
  remote: PanueloUserState,
): { merged: PanueloUserState; upload: boolean } {
  const items: Record<string, PanueloOwned> = { ...remote.items };
  let upload = false;
  for (const [id, mine] of Object.entries(local.items)) {
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
  // Lo que cualquiera de los dos lados dio en un intercambio, se queda dado.
  const gone: Record<string, number> = { ...remote.gone };
  for (const [id, at] of Object.entries(local.gone ?? {})) {
    if (!(gone[id] >= at)) {
      gone[id] = at;
      upload = true;
    }
  }
  return {
    merged: withGone(
      {
        color: winner.color ?? local.color ?? remote.color,
        items,
        layout,
        layoutAt: winner.layoutAt,
      },
      gone,
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

// ── Decorar ────────────────────────────────────────────────────────────────

/** Cose una pieza en el primer hueco libre. Sin tenerla, no se puede. */
export function placeItem(
  state: PanueloUserState,
  id: string,
  now: number,
): PanueloUserState {
  if (!state.items[id] || state.layout[id]) return state;
  const slot = nextFreeSlot(Object.values(state.layout));
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
  const items = Object.entries(state.layout)
    .filter(([id]) => catalog[id] && state.items[id])
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
  return { color: state.color ?? DEFAULT_PANUELO_COLOR, items };
}

/** «12 de abril de 2027». */
export function formatOwnedDate(at: number): string {
  const months = [
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
  const d = new Date(at);
  return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
}

/**
 * ¿Se puede intercambiar esta pieza? Lo que diga el catálogo; si no dice
 * nada, solo las pulseras (son las que se cambian de mano en los encuentros).
 */
export function isTradeable(item: PanueloItemDef): boolean {
  return item.tradeable ?? item.kind === 'pulsera';
}
