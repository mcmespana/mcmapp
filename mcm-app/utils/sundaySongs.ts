/**
 * «Cantos para este domingo»: el motor de sugerencia. Lógica PURA y
 * determinista (sin React, sin red, sin azar): la misma fecha da la misma misa
 * en todos los móviles. Ver `docs/funcionalidades/CANTOS_DOMINGO.md`.
 *
 * Por cada momento de la misa (`constants/massMoments.ts`):
 *   1. candidatas = canciones de sus categorías (+ las que lleven su etiqueta);
 *   2. filtros duros (reglas litúrgicas, no puntos): sin Aleluya en Cuaresma,
 *      sin canciones de otro tiempo o de otra fiesta, sin las de etiquetas
 *      ocultas;
 *   3. puntuación: fiesta del día +5, tiempo del día +3, neutra 0;
 *   4. desempate: rotación determinista por semana dentro de cada tramo de
 *      puntos, así que el domingo siguiente sale otra y una canción vuelve
 *      cuando el tramo da la vuelta;
 *   5. sin repetir canción en dos momentos de la misma misa.
 *
 * Una canción SIN etiqueta de tiempo es «neutra» y vale siempre: si el cantoral
 * aún no está etiquetado, la función degrada a sugerir neutras (no falla).
 */
import {
  ACCLAMATION_LABEL,
  ACCLAMATION_TAG,
  MASS_MOMENTS,
  NO_ALLELUIA_SEASONS,
  SEASON_TAGS,
  type LiturgicalMark,
  type MassMomentId,
} from '@/constants/massMoments';
import type { SongEntry, SongsData } from '@/utils/filterSongsData';
import {
  weekdayOf,
  weekIndexOf,
  type LiturgicalDay,
  type SeasonId,
} from '@/utils/liturgicalDay';
import { foldForSearch, songTagSlugs } from '@/utils/songTags';

/** Puntos por coincidir con la fiesta / el tiempo del día. */
export const FEAST_POINTS = 5;
export const SEASON_POINTS = 3;

/** Valor que se guarda por momento cuando la persona lo quita de la misa. */
export const REMOVED = 'quitado';

/** Lo que se recuerda por momento: el filename elegido o `REMOVED`. */
export type MassPicks = Partial<Record<MassMomentId, string>>;

export interface SundayCandidate {
  filename: string;
  title: string;
  /** Clave de la categoría de `songs/data` de la que sale. */
  categoryKey: string;
  score: number;
  /** Por qué sube («Cuaresma», «Jesucristo, Rey del Universo»). */
  reasons: string[];
  song: SongEntry;
}

export interface MomentSuggestion {
  moment: MassMomentId;
  /** «Aclamación» en Cuaresma, no «Aleluya». */
  label: string;
  /** Candidatas por orden de ranking, sin las ya usadas en momentos anteriores. */
  candidates: SundayCandidate[];
  /** Índice en `candidates` de la elegida; −1 si no hay o se quitó. */
  chosenIndex: number;
  removed: boolean;
  emptyReason?: string;
}

export interface SuggestOptions {
  /** Etiquetas (slug) ocultas por la persona. */
  hiddenSlugs?: ReadonlySet<string>;
  /** `settings.hideHiddenTagSongs`: sin las canciones de esas etiquetas. */
  hideHiddenTagSongs?: boolean;
  /** slug alias → canónico (`tagIndex.aliases`). */
  aliases?: Record<string, string>;
  /** Lo que la persona cambió o quitó en esta fecha. */
  picks?: MassPicks;
}

const SEASON_LABELS: Record<SeasonId, string> = {
  adviento: 'Adviento',
  navidad: 'Navidad',
  cuaresma: 'Cuaresma',
  semana_santa: 'Semana Santa',
  pascua: 'Pascua',
  ordinario: 'Tiempo Ordinario',
};

/** Ids de fiesta del calendario → id canónico de `SEASON_TAGS` (junta fechas). */
export function canonicalFeastId(id: string | undefined): string | undefined {
  if (!id) return undefined;
  if (id.startsWith('ascension')) return 'ascension';
  if (id.startsWith('corpus_christi')) return 'corpus';
  return id;
}

// ── Qué marca una canción ───────────────────────────────────────────────────

export interface SongMarks {
  seasons: Set<SeasonId>;
  feasts: Set<string>;
}

const LITURGICAL_TIME_KEYS = Object.keys(SEASON_TAGS).map((slug) => ({
  mark: SEASON_TAGS[slug],
  // `semana-santa` → /\bsemana santa\b/ sobre el texto sin tildes.
  re: new RegExp(`\\b${slug.replace(/-/g, ' ')}\\b`),
}));

function addMark(marks: SongMarks, mark: LiturgicalMark) {
  if (mark.season) marks.seasons.add(mark.season);
  if (mark.feast) marks.feasts.add(mark.feast);
}

/**
 * Tiempos y fiestas de una canción. MANDAN LAS ETIQUETAS; el campo antiguo
 * `liturgicalTime` (texto libre) solo se lee si las etiquetas no dicen nada,
 * y no se escribe ni se migra.
 */
export function songMarks(
  song: SongEntry,
  aliases: Record<string, string> = {},
): SongMarks {
  const marks: SongMarks = { seasons: new Set(), feasts: new Set() };
  for (const slug of songTagSlugs(song, aliases)) {
    const mark = SEASON_TAGS[slug];
    if (mark) addMark(marks, mark);
  }
  if (marks.seasons.size === 0 && marks.feasts.size === 0) {
    const text =
      typeof song.liturgicalTime === 'string'
        ? foldForSearch(song.liturgicalTime)
        : '';
    if (text) {
      for (const { mark, re } of LITURGICAL_TIME_KEYS) {
        if (re.test(text)) addMark(marks, mark);
      }
    }
  }
  return marks;
}

// ── Reglas duras ────────────────────────────────────────────────────────────

/** ¿Cuenta como «Aleluya» el título? (en Cuaresma no se canta en ningún momento) */
function hasAlleluiaInTitle(title: string | undefined): boolean {
  return /\b(aleluya|aleluia|alleluia|halleluja)\b/.test(
    foldForSearch(title ?? ''),
  );
}

/**
 * ¿Encaja la canción con el día? Regla 2 y 4 del plan:
 *  - marcada con un tiempo, solo entra en ese tiempo (o en su fiesta);
 *  - marcada SOLO con una fiesta, solo entra ese día;
 *  - sin marcas: neutra, vale siempre.
 */
function fitsDay(marks: SongMarks, day: LiturgicalDay): boolean {
  const feast = canonicalFeastId(day.feastId);
  const feastMatch = !!feast && marks.feasts.has(feast);
  if (marks.seasons.size > 0) {
    return marks.seasons.has(day.season) || feastMatch;
  }
  if (marks.feasts.size > 0) return feastMatch;
  return true;
}

// ── Orden determinista ──────────────────────────────────────────────────────

/** FNV-1a de 32 bits: igual en todos los motores JS, sin dependencias. */
function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Orden de un tramo de canciones con los mismos puntos: por hash estable de
 * (canción + momento) y rotado por el número de semana. Misma fecha, mismo
 * orden; la semana siguiente empieza una más allá.
 */
function rotate<T extends { filename: string }>(
  tier: T[],
  moment: MassMomentId,
  week: number,
): T[] {
  if (tier.length < 2) return tier;
  const sorted = [...tier].sort(
    (a, b) =>
      hash32(`${a.filename}|${moment}`) - hash32(`${b.filename}|${moment}`) ||
      a.filename.localeCompare(b.filename),
  );
  const shift = ((week % sorted.length) + sorted.length) % sorted.length;
  return [...sorted.slice(shift), ...sorted.slice(0, shift)];
}

// ── El motor ────────────────────────────────────────────────────────────────

function reasonsFor(
  marks: SongMarks,
  day: LiturgicalDay,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const feast = canonicalFeastId(day.feastId);
  if (feast && marks.feasts.has(feast)) {
    score += FEAST_POINTS;
    reasons.push(day.feastName ?? day.name);
  }
  if (marks.seasons.has(day.season)) {
    score += SEASON_POINTS;
    reasons.push(SEASON_LABELS[day.season]);
  }
  return { score, reasons };
}

/**
 * La misa propuesta para un día: un `MomentSuggestion` por momento, en orden de
 * misa. `songs` son las canciones ya filtradas (`filterSongsData`).
 */
export function suggestMass(
  day: LiturgicalDay,
  songs: SongsData | null | undefined,
  opts: SuggestOptions = {},
): MomentSuggestion[] {
  const aliases = opts.aliases ?? {};
  const hidden = opts.hiddenSlugs ?? new Set<string>();
  const hideHidden = !!opts.hideHiddenTagSongs && hidden.size > 0;
  const picks = opts.picks ?? {};
  const week = weekIndexOf(day.fecha);
  const noAlleluia = NO_ALLELUIA_SEASONS.includes(day.season);

  // Una sola pasada por el cantoral: marcas y etiquetas de cada canción.
  interface Entry {
    song: SongEntry;
    categoryKey: string;
    slugs: string[];
    marks: SongMarks;
  }
  const entries: Entry[] = [];
  for (const [categoryKey, category] of Object.entries(songs ?? {})) {
    const list = Array.isArray(category?.songs) ? category.songs : [];
    for (const song of list) {
      if (!song?.filename) continue;
      const slugs = songTagSlugs(song, aliases);
      if (hideHidden && slugs.some((s) => hidden.has(s))) continue;
      entries.push({
        song,
        categoryKey,
        slugs,
        marks: songMarks(song, aliases),
      });
    }
  }

  const taken = new Set<string>();
  const out: MomentSuggestion[] = [];

  for (const moment of MASS_MOMENTS) {
    const isAcclamation = moment.id === 'aleluya' && noAlleluia;
    const label = isAcclamation ? ACCLAMATION_LABEL : moment.label;

    // 1. Pertenecen al momento: su categoría o alguna de sus etiquetas.
    const seen = new Set<string>();
    const pool = entries.filter((e) => {
      const belongs =
        moment.categories.includes(e.categoryKey) ||
        moment.tags.some((t) => e.slugs.includes(t));
      if (!belongs || seen.has(e.song.filename!)) return false;
      seen.add(e.song.filename!);
      return true;
    });

    // 2. Filtros duros.
    const fitting = pool.filter((e) => {
      if (!fitsDay(e.marks, day)) return false;
      if (noAlleluia && hasAlleluiaInTitle(e.song.title)) return false;
      if (isAcclamation) {
        // Solo lo etiquetado como aclamación o como de este tiempo; nunca un
        // aleluya «por defecto».
        return (
          e.slugs.includes(ACCLAMATION_TAG) || e.marks.seasons.has(day.season)
        );
      }
      return true;
    });

    // 3 y 4. Puntos, y rotación dentro de cada tramo de puntos.
    const scored = fitting.map((e) => {
      const { score, reasons } = reasonsFor(e.marks, day);
      return {
        filename: e.song.filename!,
        title: e.song.title,
        categoryKey: e.categoryKey,
        score,
        reasons,
        song: e.song,
      } satisfies SundayCandidate;
    });
    const tiers = new Map<number, SundayCandidate[]>();
    for (const c of scored) {
      tiers.set(c.score, [...(tiers.get(c.score) ?? []), c]);
    }
    const ranked = [...tiers.keys()]
      .sort((a, b) => b - a)
      .flatMap((score) => rotate(tiers.get(score)!, moment.id, week));

    // 5. Sin repetir con los momentos anteriores.
    const candidates = ranked.filter((c) => !taken.has(c.filename));

    const pick = picks[moment.id];
    const removed = pick === REMOVED;
    let chosenIndex = -1;
    if (!removed && candidates.length > 0) {
      const wanted = pick
        ? candidates.findIndex((c) => c.filename === pick)
        : -1;
      chosenIndex = wanted >= 0 ? wanted : 0;
    }
    if (chosenIndex >= 0) taken.add(candidates[chosenIndex].filename);

    let emptyReason: string | undefined;
    if (candidates.length === 0) {
      if (isAcclamation) {
        emptyReason = 'Sin aclamación de Cuaresma en el cantoral';
      } else if (pool.length === 0) {
        emptyReason = `No hay canciones de ${label.toLowerCase()} en el cantoral`;
      } else {
        emptyReason = `Ninguna canción de ${label.toLowerCase()} encaja con este domingo`;
      }
    }

    out.push({
      moment: moment.id,
      label,
      candidates,
      chosenIndex,
      removed,
      ...(emptyReason && { emptyReason }),
    });
  }
  return out;
}

/** La canción siguiente del ranking, dando la vuelta («Cambiar»). */
export function nextCandidate(
  suggestion: MomentSuggestion,
): SundayCandidate | undefined {
  const { candidates, chosenIndex } = suggestion;
  if (candidates.length === 0) return undefined;
  return candidates[(chosenIndex + 1) % candidates.length];
}

/**
 * ¿Sale la tarjeta de Inicio? De viernes a domingo y solo con la pestaña del
 * cantoral en el perfil. `fecha` = `YYYY-MM-DD` local.
 */
export function shouldShowSundayCard(
  fecha: string,
  tabs: readonly string[],
): boolean {
  const wd = weekdayOf(fecha);
  return (wd === 5 || wd === 6 || wd === 0) && tabs.includes('cancionero');
}
