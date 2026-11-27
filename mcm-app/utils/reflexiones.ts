/**
 * Compartiendo (reflexiones de un evento): el modelo, sin UI.
 *
 * El nodo vive en `<evento>/compartiendo` con la forma `{ updatedAt, data }`.
 * `data` llega como objeto indexado por la key de `push()` (o como array en los
 * datos más antiguos del Jubileo). Todo lo que la pantalla necesita saber de
 * esa lista —orden, color de cada tarjeta, a qué día pertenece, quién ha
 * escrito— se decide aquí, para que se pueda probar sin montar nada.
 *
 * Documentación: `docs/funcionalidades/COMPARTIENDO.md` (raíz del monorepo).
 */
import colors from '@/constants/colors';
import { localISO, offsetISODate } from '@/utils/localDate';

export interface Reflexion {
  id: string;
  titulo?: string;
  contenido: string;
  /** Día al que se refiere, `YYYY-MM-DD` (los antiguos pueden traer hora). */
  fecha: string;
  grupal: boolean;
  grupo?: string;
  autor?: string;
  /**
   * Color de la tarjeta, elegido al escribir. Opcional: las anteriores a
   * noviembre de 2026 no lo traen y se les asigna uno estable por su id.
   */
  tono?: ReflexionTone;
}

// ── Tonos ────────────────────────────────────────────────────────────────────

/**
 * Los colores de las tarjetas: los del logo de MCM (`brand`), nada inventado.
 * Se guarda la CLAVE, no el hex, para que la paleta pueda afinarse sin migrar
 * datos.
 */
export const REFLEXION_TONES = [
  'primary',
  'accent',
  'info',
  'green',
  'yellow',
  'purple',
] as const;
export type ReflexionTone = (typeof REFLEXION_TONES)[number];

/** Nombre del tono para lectores de pantalla. */
export const REFLEXION_TONE_LABELS: Record<ReflexionTone, string> = {
  primary: 'Azul MCM',
  accent: 'Rojo',
  info: 'Celeste',
  green: 'Verde',
  yellow: 'Amarillo',
  purple: 'Morado',
};

export function isReflexionTone(v: unknown): v is ReflexionTone {
  return (
    typeof v === 'string' && (REFLEXION_TONES as readonly string[]).includes(v)
  );
}

export function toneColor(tone: ReflexionTone): string {
  return colors[tone];
}

/** Hash estable (djb2 a 32 bits) para repartir colores por id. */
export function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** El tono elegido; si no hay, uno estable derivado del id. */
export function reflexionTone(
  r: Pick<Reflexion, 'id' | 'tono'>,
): ReflexionTone {
  if (isReflexionTone(r.tono)) return r.tono;
  return REFLEXION_TONES[hashString(r.id || 'x') % REFLEXION_TONES.length];
}

// ── Normalizar y ordenar ─────────────────────────────────────────────────────

/**
 * Lo que llega de Firebase → lista limpia. Descarta huecos (arrays antiguos con
 * `null`) y entradas sin texto, y rellena el `id` con la key si faltase.
 */
export function normalizeReflexiones(raw: unknown): Reflexion[] {
  if (!raw || typeof raw !== 'object') return [];
  const entries: [string, unknown][] = Array.isArray(raw)
    ? raw.map((v, i) => [String(i), v])
    : Object.entries(raw as Record<string, unknown>);
  const out: Reflexion[] = [];
  for (const [key, value] of entries) {
    if (!value || typeof value !== 'object') continue;
    const r = value as Partial<Reflexion>;
    if (typeof r.contenido !== 'string' || !r.contenido.trim()) continue;
    out.push({
      ...(r as Reflexion),
      id: typeof r.id === 'string' && r.id ? r.id : key,
      fecha: typeof r.fecha === 'string' ? r.fecha : '',
      grupal: !!r.grupal,
    });
  }
  return out;
}

/** Milisegundos de creación si el id es un `Date.now()` (lo es desde siempre). */
export function createdAtOf(r: Pick<Reflexion, 'id'>): number | null {
  return /^\d{12,14}$/.test(r.id) ? Number(r.id) : null;
}

/** `YYYY-MM-DD` del día de la reflexión (los antiguos podían traer hora). */
export function dayOf(r: Pick<Reflexion, 'fecha'>): string {
  return (r.fecha || '').slice(0, 10);
}

/** Más reciente primero: por día y, dentro del día, por hora de creación. */
export function sortReflexiones(list: Reflexion[]): Reflexion[] {
  return [...list].sort((a, b) => {
    const byDay = dayOf(b).localeCompare(dayOf(a));
    if (byDay !== 0) return byDay;
    const ta = createdAtOf(a) ?? 0;
    const tb = createdAtOf(b) ?? 0;
    if (tb !== ta) return tb - ta;
    return b.id.localeCompare(a.id);
  });
}

// ── Forma de la tarjeta ──────────────────────────────────────────────────────

/** Hasta aquí una reflexión es una frase y se pinta como cartel. */
export const POSTER_MAX_CHARS = 140;
/** Hasta aquí, el cartel va con la letra más grande. */
export const POSTER_XL_MAX_CHARS = 60;
/** A partir de aquí, la tarjeta se corta y se lee entera en historias. */
export const NOTE_CLAMP_CHARS = 420;

export type ReflexionShape = 'poster' | 'note';

/**
 * Una frase corta y sin título es un CARTEL (color de fondo, letra grande); lo
 * demás es una NOTA (superficie neutra, letra de lectura). Así el muro alterna
 * solo, según lo que la gente escribe, y nadie tiene que elegir el formato.
 */
export function reflexionShape(
  r: Pick<Reflexion, 'titulo' | 'contenido'>,
): ReflexionShape {
  const text = r.contenido.trim();
  if (r.titulo?.trim()) return 'note';
  if (text.length > POSTER_MAX_CHARS) return 'note';
  if (text.split('\n').length > 4) return 'note';
  return 'poster';
}

// ── Autoría ──────────────────────────────────────────────────────────────────

/** Iniciales (dos como mucho) del nombre visible. */
export function initialsOf(name?: string): string {
  const main = splitAuthor(name).name;
  if (!main) return '';
  return main
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/**
 * La firma se guarda como `Nombre · Delegación` (la arma el perfil). Para
 * pintarla se separa: el nombre manda, la delegación acompaña.
 */
export function splitAuthor(author?: string): {
  name: string;
  detail: string;
} {
  const [name = '', ...rest] = (author ?? '').split(' · ');
  return { name: name.trim(), detail: rest.join(' · ').trim() };
}

// ── Días y tiempos ───────────────────────────────────────────────────────────

const WEEKDAYS = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];
const MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

function parseDay(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** «Hoy», «Ayer» o «jueves 26 nov». */
export function dayLabel(dayISO: string, todayISO: string): string {
  if (dayISO === todayISO) return 'Hoy';
  if (dayISO === offsetISODate(todayISO, -1)) return 'Ayer';
  const d = parseDay(dayISO);
  if (!d) return 'Sin fecha';
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** «ahora», «hace 5 min», «hace 2 h»; `null` pasado un día. */
export function relativeTime(createdAt: number | null, now: number) {
  if (createdAt === null) return null;
  const min = Math.floor((now - createdAt) / 60_000);
  // Un reloj adelantado da minutos negativos: también es «ahora».
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `hace ${hours} h`;
  return null;
}

export interface DayGroup {
  day: string;
  items: Reflexion[];
}

/** Agrupa una lista YA ordenada por día, conservando el orden. */
export function groupByDay(sorted: Reflexion[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const r of sorted) {
    const day = dayOf(r);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(r);
    else groups.push({ day, items: [r] });
  }
  return groups;
}

/** Los tres días que se ofrecen al escribir: hoy, ayer y anteayer. */
export function composerDays(today: Date = new Date()) {
  const todayISO = localISO(today);
  return [0, -1, -2].map((delta) => {
    const iso = offsetISODate(todayISO, delta);
    const d = parseDay(iso) as Date;
    const label =
      delta === 0
        ? 'Hoy'
        : delta === -1
          ? 'Ayer'
          : WEEKDAYS[d.getDay()].replace(/^./, (c) => c.toUpperCase());
    return { iso, label };
  });
}

// ── El muro en cifras ────────────────────────────────────────────────────────

export interface WallStats {
  total: number;
  /** Firmas distintas (las anónimas no cuentan). */
  people: number;
  /** Cuándo se creó la más reciente, si se sabe. */
  lastAt: number | null;
  /** Firmas distintas, de la más reciente a la más antigua. */
  recentAuthors: string[];
}

/** Cifras del muro. `sorted` va de la más reciente a la más antigua. */
export function wallStats(
  sorted: Reflexion[],
  authorOf: (r: Reflexion) => string,
): WallStats {
  const seen = new Set<string>();
  const recentAuthors: string[] = [];
  let lastAt: number | null = null;
  for (const r of sorted) {
    const at = createdAtOf(r);
    if (at !== null && (lastAt === null || at > lastAt)) lastAt = at;
    const name = splitAuthor(authorOf(r)).name;
    const key = name.toLocaleLowerCase('es');
    if (name && !seen.has(key)) {
      seen.add(key);
      recentAuthors.push(authorOf(r));
    }
  }
  return { total: sorted.length, people: seen.size, lastAt, recentAuthors };
}

/** «1 reflexión», «12 reflexiones». */
export function countLabel(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}

// ── Escribir ─────────────────────────────────────────────────────────────────

/**
 * Arranques para quien no sabe por dónde empezar. Tocar uno lo deja escrito
 * en la tarjeta y el cursor detrás.
 */
export const REFLEXION_SEEDS = [
  'Me llevo… ',
  'Doy gracias por… ',
  'Hoy he descubierto que… ',
  'Una frase que no quiero olvidar: ',
] as const;

/** Lo que pone la tarjeta vacía, uno distinto cada vez que se abre. */
export const COMPOSER_PROMPTS = [
  '¿Qué te llevas de hoy?',
  'Una frase que te ha tocado',
  'Algo por lo que dar gracias',
  'Un momento que no quieres olvidar',
] as const;

/** Tope de largo de una reflexión (una página de móvil, de sobra). */
export const REFLEXION_MAX_CHARS = 800;

/**
 * La reflexión tal y como se escribe en Firebase. Sin claves `undefined`: RTDB
 * rechaza el `update()` entero si aparece una.
 */
export function newReflexion(input: {
  contenido: string;
  fecha: string;
  autor: string;
  tono: ReflexionTone;
  now: number;
}): Reflexion {
  const autor = input.autor.trim();
  return {
    id: String(input.now),
    contenido: input.contenido.trim(),
    fecha: input.fecha,
    grupal: false,
    tono: input.tono,
    ...(autor ? { autor } : {}),
  };
}

/** Cuánto se queda en pantalla una reflexión en el modo historias. */
export function storyDurationMs(text: string): number {
  return Math.min(15_000, Math.max(5_000, 3_500 + text.length * 45));
}

/**
 * Payload multi-path para publicar una reflexión de forma atómica: escribe
 * la entrada bajo `data/<key>` y toca `updatedAt` en la misma operación
 * (`update()`), de modo que ningún dispositivo pueda ver la entrada nueva
 * sin que `updatedAt` ya haya cambiado (y viceversa). Antes eran dos `set()`
 * separados: si el segundo fallaba (o la app moría entre medias), la
 * reflexión quedaba escrita pero invisible para el resto de dispositivos —
 * `useFirebaseData` solo redescarga `data` cuando `updatedAt` difiere.
 */
export function buildReflexionUpdate(
  key: string,
  reflexion: object,
  now: number,
): Record<string, unknown> {
  return {
    [`data/${key}`]: reflexion,
    updatedAt: String(now),
  };
}
