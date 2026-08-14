/**
 * Etiquetas del cantoral — modelo de datos y utilidades puras.
 *
 * Las etiquetas nacen en el repo del cantoral (`mcmapp-cantoral`) como una
 * directiva `{tags: ...}` en el `.cho`, igual que `{arr: ...}`. El generador
 * las vuelca a `tags: string[]` en cada canción de `songs/data` y publica un
 * catálogo OPCIONAL de metadatos en `songs/tags`.
 *
 * Tres propiedades que definen el diseño (ver `docs/funcionalidades/ETIQUETAS.md`):
 *
 * 1. **Libres** — una etiqueta que aparece en un `.cho` y NO está en el
 *    catálogo funciona igual: se muestra con el slug capitalizado y sin emoji.
 * 2. **Transversales** — no viven dentro de una categoría, la cruzan. Por eso
 *    la pantalla de una etiqueta va agrupada POR categoría.
 * 3. **Sin nodo nuevo que proteger** — el índice inverso se construye en la
 *    app sobre los datos ya descargados; no hay caché nueva ni reglas nuevas.
 *
 * Todo lo de aquí es PURO: se testea en `__tests__/songTags.test.ts`.
 */
import type { SongsData } from '@/utils/filterSongsData';

/** Prefijo de la categoría virtual de una etiqueta (hermano de `__ALL__`). */
export const TAG_CATEGORY_PREFIX = '__TAG__:';

/** Separador de etiquetas cuando se cruzan varias (AND). */
const TAG_JOIN = '+';

/** Metadatos opcionales de una etiqueta, tal y como viven en `songs/tags`. */
export interface TagCatalogEntry {
  /** Nombre bonito, con acentos y mayúsculas. */
  label?: string;
  /** Emoji del chip. Opcional a propósito: sin emoji el chip es más corto. */
  emoji?: string;
  /** Orden manual entre las destacadas. */
  orden?: number;
  /** Si la etiqueta merece salir destacada. */
  destacada?: boolean;
  /** Slugs que se colapsan sobre esta etiqueta (higiene del vocabulario). */
  alias?: string[];
}

/** Catálogo ya normalizado: entradas por slug canónico + mapa de alias. */
export interface NormalizedTagCatalog {
  entries: Record<string, TagCatalogEntry>;
  /** slug alias → slug canónico. */
  aliases: Record<string, string>;
}

/** Una etiqueta lista para pintar, con su recuento REAL en la app. */
export interface ResolvedTag {
  slug: string;
  label: string;
  emoji?: string;
  /** Canciones visibles con esta etiqueta (sobre los datos ya filtrados). */
  count: number;
  orden?: number;
  destacada: boolean;
}

export interface SongTagIndex {
  /** Etiquetas con al menos una canción, de más a menos usadas. */
  tags: ResolvedTag[];
  bySlug: Map<string, ResolvedTag>;
  /** slug alias → slug canónico (para leer las etiquetas de una canción). */
  aliases: Record<string, string>;
}

export const EMPTY_TAG_INDEX: SongTagIndex = {
  tags: [],
  bySlug: new Map(),
  aliases: {},
};

/**
 * `Domingo de Ramos` → `domingo-de-ramos`. Sin acentos, minúsculas, guiones.
 * El slug es el identificador estable; el label solo es presentación.
 */
export function slugifyTag(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Label de emergencia para una etiqueta que no está en el catálogo. */
export function prettyTagLabel(slug: string): string {
  const words = slug.replace(/-/g, ' ').trim();
  if (!words) return '';
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// ── Categoría virtual `__TAG__:` ────────────────────────────────────────────

/** `['viejunas', 'envio']` → `__TAG__:viejunas+envio`. */
export function tagCategoryId(slugs: string[]): string {
  return TAG_CATEGORY_PREFIX + slugs.join(TAG_JOIN);
}

/** Devuelve los slugs de una categoría virtual, o `null` si no lo es. */
export function parseTagCategoryId(categoryId: string): string[] | null {
  if (!categoryId.startsWith(TAG_CATEGORY_PREFIX)) return null;
  const slugs = categoryId
    .slice(TAG_CATEGORY_PREFIX.length)
    .split(TAG_JOIN)
    .map((s) => s.trim())
    .filter(Boolean);
  return slugs.length > 0 ? slugs : null;
}

export function isTagCategoryId(categoryId: string): boolean {
  return parseTagCategoryId(categoryId) !== null;
}

// ── Catálogo ────────────────────────────────────────────────────────────────

function cleanText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Normaliza el catálogo crudo de `songs/tags`. Tolera:
 * - el mapa directo `{ slug: {...} }`
 * - el mapa envuelto `{ tags: { slug: {...} } }`
 * - una entrada que sea solo el label (`{ "viejunas": "Viejunas" }`)
 * - claves sin normalizar (`"Domingo de Ramos"`)
 *
 * Nunca lanza: un catálogo roto degrada a "no hay catálogo", que es un estado
 * perfectamente válido (las etiquetas son libres).
 */
export function normalizeTagCatalog(raw: unknown): NormalizedTagCatalog {
  const empty: NormalizedTagCatalog = { entries: {}, aliases: {} };
  if (!raw || typeof raw !== 'object') return empty;

  const source = raw as Record<string, unknown>;
  const map =
    source.tags && typeof source.tags === 'object'
      ? (source.tags as Record<string, unknown>)
      : source;

  const entries: Record<string, TagCatalogEntry> = {};
  const aliases: Record<string, string> = {};

  for (const [rawKey, rawValue] of Object.entries(map)) {
    const slug = slugifyTag(rawKey);
    if (!slug) continue;

    if (typeof rawValue === 'string') {
      entries[slug] = { label: cleanText(rawValue) ?? prettyTagLabel(slug) };
      continue;
    }
    if (!rawValue || typeof rawValue !== 'object') continue;

    const value = rawValue as Record<string, unknown>;
    const entry: TagCatalogEntry = {
      label: cleanText(value.label),
      emoji: cleanText(value.emoji),
      orden: typeof value.orden === 'number' ? value.orden : undefined,
      destacada: value.destacada === true,
    };

    const rawAlias = value.alias;
    if (Array.isArray(rawAlias)) {
      const list = rawAlias
        .map((a) => (typeof a === 'string' ? slugifyTag(a) : ''))
        .filter((a) => a.length > 0 && a !== slug);
      if (list.length > 0) entry.alias = list;
      list.forEach((a) => {
        aliases[a] = slug;
      });
    }

    entries[slug] = entry;
  }

  // Un alias nunca puede apuntar a una etiqueta declarada: gana la declarada.
  for (const alias of Object.keys(aliases)) {
    if (entries[alias]) delete aliases[alias];
  }

  return { entries, aliases };
}

/** Aplica el mapa de alias hasta el slug canónico (con tope antibucles). */
function canonicalSlug(slug: string, aliases: Record<string, string>): string {
  let current = slug;
  for (let i = 0; i < 5; i += 1) {
    const next = aliases[current];
    if (!next || next === current) break;
    current = next;
  }
  return current;
}

// ── Etiquetas de una canción ────────────────────────────────────────────────

/**
 * Slugs canónicos de una canción, deduplicados y en orden de aparición.
 * Acepta `tags` como array o como string separado por comas (por si el
 * generador cambia de formato en el futuro).
 */
export function songTagSlugs(
  song: { tags?: unknown } | null | undefined,
  aliases: Record<string, string> = {},
): string[] {
  if (!song) return [];
  const raw = song.tags;
  let list: unknown[];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === 'string') list = raw.split(',');
  else return [];

  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== 'string') continue;
    const slug = canonicalSlug(slugifyTag(item), aliases);
    if (slug && !out.includes(slug)) out.push(slug);
  }
  return out;
}

/** ¿La canción lleva TODAS las etiquetas pedidas? (cruce AND) */
export function songHasAllTags(
  song: { tags?: unknown } | null | undefined,
  slugs: string[],
  aliases: Record<string, string> = {},
): boolean {
  if (slugs.length === 0) return false;
  const own = songTagSlugs(song, aliases);
  if (own.length === 0) return false;
  return slugs.every((slug) => own.includes(slug));
}

// ── Índice inverso ──────────────────────────────────────────────────────────

/**
 * Construye el índice de etiquetas sobre los datos YA filtrados de la app
 * (sin borradores ni pendientes), así que los recuentos que se ven son los
 * reales de la app y no los del generador.
 *
 * Solo salen etiquetas con al menos una canción: una etiqueta declarada en el
 * catálogo pero sin usar todavía no es descubrimiento, es ruido.
 */
export function buildTagIndex(
  songsData: SongsData | null | undefined,
  rawCatalog?: unknown,
): SongTagIndex {
  const catalog = normalizeTagCatalog(rawCatalog);
  if (!songsData) {
    return { tags: [], bySlug: new Map(), aliases: catalog.aliases };
  }

  const counts = new Map<string, number>();
  for (const category of Object.values(songsData)) {
    const songs = Array.isArray(category?.songs) ? category.songs : [];
    for (const song of songs) {
      for (const slug of songTagSlugs(song, catalog.aliases)) {
        counts.set(slug, (counts.get(slug) ?? 0) + 1);
      }
    }
  }

  const tags: ResolvedTag[] = [];
  for (const [slug, count] of counts) {
    const entry = catalog.entries[slug];
    tags.push({
      slug,
      label: entry?.label ?? prettyTagLabel(slug),
      emoji: entry?.emoji,
      count,
      orden: entry?.orden,
      destacada: entry?.destacada === true,
    });
  }

  // Orden por uso y punto: una etiqueta se reconoce por el nombre, y quien
  // busca un nombre concreto tiene el buscador.
  tags.sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es'),
  );

  const bySlug = new Map(tags.map((t) => [t.slug, t]));
  return { tags, bySlug, aliases: catalog.aliases };
}

/** Etiqueta resuelta a partir del índice; si no está, se inventa del slug. */
export function resolveTag(slug: string, index: SongTagIndex): ResolvedTag {
  return (
    index.bySlug.get(slug) ?? {
      slug,
      label: prettyTagLabel(slug),
      count: 0,
      destacada: false,
    }
  );
}

/**
 * Tramo de tamaño del chip en la nube (-1, 0, 1). El salto total entre la
 * etiqueta más y la menos usada es de 2 pasos: lo justo para que se note el
 * peso sin que la nube parezca una sopa de letras.
 */
export function tagCloudBucket(
  count: number,
  min: number,
  max: number,
): number {
  if (max <= min) return 0;
  const ratio = (count - min) / (max - min);
  if (ratio > 0.62) return 1;
  if (ratio > 0.24) return 0;
  return -1;
}

/**
 * Etiquetas que COEXISTEN en un conjunto de canciones, para el refinamiento
 * progresivo: nunca se ofrece una etiqueta que daría cero resultados.
 */
export function coOccurringTags(
  songs: { tags?: unknown }[],
  activeSlugs: string[],
  index: SongTagIndex,
  limit = 12,
): ResolvedTag[] {
  const counts = new Map<string, number>();
  for (const song of songs) {
    for (const slug of songTagSlugs(song, index.aliases)) {
      if (activeSlugs.includes(slug)) continue;
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([slug, count]) => ({ ...resolveTag(slug, index), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es'))
    .slice(0, limit);
}

/** Título de pantalla para un cruce de etiquetas: "Viejunas · Infantiles". */
export function tagsTitle(slugs: string[], index: SongTagIndex): string {
  return slugs.map((slug) => resolveTag(slug, index).label).join(' · ');
}
