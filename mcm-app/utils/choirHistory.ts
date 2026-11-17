/**
 * Historial de lo cantado por un coro: cuántas veces ha salido cada canción
 * este curso y en qué semanas recientes. Puro, sin Firebase.
 *
 * La fuente son las playlists que el coro ha ido subiendo: cada guardado deja
 * una entrada en `/choirs/{id}/log` (día + código → ficheros). Para lo de antes
 * de que existiera el registro se usa el índice de playlists con su contenido.
 */

export interface SungEntry {
  /** Cuándo se guardó (ms). Es lo más parecido a «cuándo se cantó». */
  at: number;
  /** Código de la playlist. */
  code: string;
  /** Ficheros de las canciones. */
  songs: string[];
}

export interface SongHistory {
  /** Veces este curso (desde el 1 de septiembre). */
  course: number;
  /** Últimas semanas, de la más antigua a esta: ¿se cantó? */
  weeks: boolean[];
  /** Última vez (ms), o null. */
  lastAt: number | null;
}

export const HISTORY_WEEKS = 8;
const DAY = 86_400_000;
const WEEK = 7 * DAY;

/** El curso empieza el 1 de septiembre. */
export function schoolYearStart(now: number): number {
  const d = new Date(now);
  const year = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1;
  return new Date(year, 8, 1).getTime();
}

/** Clave del registro: un guardado por día y playlist. */
export function sungLogKey(at: number, code: string): string {
  const d = new Date(at);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${code}`;
}

/**
 * Junta el registro con las playlists del índice que no tienen ninguna
 * entrada (las de antes del registro). Quita repetidos por clave.
 */
export function mergeSungEntries(
  log: SungEntry[],
  legacy: SungEntry[],
): SungEntry[] {
  const logged = new Set(log.map((e) => e.code));
  const byKey = new Map<string, SungEntry>();
  for (const e of [...legacy.filter((l) => !logged.has(l.code)), ...log]) {
    if (!e.at || !Array.isArray(e.songs)) continue;
    byKey.set(sungLogKey(e.at, e.code), e);
  }
  return [...byKey.values()].sort((a, b) => a.at - b.at);
}

/**
 * Historial por canción. Una canción cuenta una vez por día aunque esté en
 * dos playlists de ese día (la de la misa de 11 y la de 12).
 */
export function buildSongHistory(
  entries: SungEntry[],
  now: number,
): Map<string, SongHistory> {
  const since = schoolYearStart(now);
  const days = new Map<string, Set<number>>();
  for (const e of entries) {
    if (e.at > now + DAY) continue;
    const day = Math.floor(e.at / DAY);
    for (const f of e.songs) {
      let set = days.get(f);
      if (!set) days.set(f, (set = new Set()));
      set.add(day);
    }
  }
  const out = new Map<string, SongHistory>();
  for (const [filename, set] of days) {
    const weeks = new Array<boolean>(HISTORY_WEEKS).fill(false);
    let course = 0;
    let lastAt: number | null = null;
    for (const day of set) {
      const at = day * DAY;
      if (at + DAY > since) course += 1;
      if (lastAt === null || at > lastAt) lastAt = at;
      const ago = Math.floor((now - at) / WEEK);
      if (ago >= 0 && ago < HISTORY_WEEKS)
        weeks[HISTORY_WEEKS - 1 - ago] = true;
    }
    out.set(filename, { course, weeks, lastAt });
  }
  return out;
}

/** Para el lector de pantalla: «3 veces este curso, la última hace 2 semanas». */
export function describeSongHistory(h: SongHistory | undefined, now: number) {
  if (!h || (!h.course && !h.lastAt)) return 'Sin cantar este curso';
  const times = h.course === 1 ? '1 vez' : `${h.course} veces`;
  if (!h.lastAt) return `${times} este curso`;
  const weeksAgo = Math.floor((now - h.lastAt) / WEEK);
  const last =
    weeksAgo <= 0
      ? 'esta semana'
      : weeksAgo === 1
        ? 'hace 1 semana'
        : `hace ${weeksAgo} semanas`;
  return `${times} este curso, la última ${last}`;
}
