// Lo que la app deja escrito para los widgets de Contigo
// (docs/planes/PLAN_WIDGET_CONTIGO.md §2).
//
// Un widget no ejecuta JS ni habla con Firebase: pinta lo que la app le dejó
// en el contenedor compartido (App Group en iOS, SharedPreferences en
// Android). Este módulo construye ese paquete y es PURO: la parte nativa que
// lo escribe llegará con la build dedicada de los widgets. Así el formato ya
// está fijado y probado antes de tocar Swift.
//
// **El formato es un contrato con el código nativo.** Si cambia la forma, se
// sube `version` y el widget tiene que saber leer las dos.

import type { DayRecord } from '@/contexts/ContigoHabitsContext';
import type { DailyReadings } from '@/hooks/useDailyReadings';
import { computeStreak } from '@/utils/contigoStreak';
import { offsetISODate } from '@/utils/localDate';

export const WIDGET_PAYLOAD_VERSION = 1;

/** Días de evangelio que se dejan escritos, contando hoy. */
export const GOSPEL_DAYS_AHEAD = 3;

/** Largo máximo de la frase de gancho del evangelio (widget mediano). */
export const GOSPEL_HOOK_MAX = 90;

/**
 * Tramo de la racha: el widget cambia de aspecto al cruzar cada uno
 * (PLAN_WIDGET_CONTIGO §3.2). Los nombres son los de los recursos gráficos.
 */
export type StreakTier = 'apagado' | 'chispa' | 'llama' | 'hoguera' | 'leyenda';

export function streakTier(days: number): StreakTier {
  if (!Number.isFinite(days) || days <= 0) return 'apagado';
  if (days <= 2) return 'chispa';
  if (days <= 6) return 'llama';
  if (days <= 29) return 'hoguera';
  return 'leyenda';
}

export interface WidgetGospelDay {
  /** `YYYY-MM-DD`. */
  date: string;
  /** "Lc 15, 1-10". */
  ref: string;
  /** Título del día, si lo hay. */
  title: string | null;
  /** Primera frase del evangelio, recortada. */
  hook: string | null;
}

export interface ContigoWidgetPayload {
  version: typeof WIDGET_PAYLOAD_VERSION;
  /** Cuándo se escribió, en ms. El widget lo enseña si el dato se ha quedado viejo. */
  generatedAt: number;
  /** El "hoy" del que hablan `habits` y `streak`. */
  date: string;
  habits: { reading: boolean; prayer: boolean; revision: boolean };
  /** 0-3, para el "2/3" del widget de hábitos. */
  doneCount: number;
  /** Racha de ORACIÓN: la que preside la pantalla de Contigo. */
  streak: number;
  streakTier: StreakTier;
  /**
   * Hoy y los próximos días que haya descargados, en orden. Así el widget
   * cambia de evangelio a medianoche aunque nadie abra la app.
   */
  gospel: WidgetGospelDay[];
}

/**
 * Quita marcas (HTML, BBCode) y espacios de más. Las lecturas llegan del
 * scraper con etiquetas, y en una línea de widget se verían tal cual.
 */
function plainText(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * La frase de gancho: la primera oración del evangelio o, si es muy larga, un
 * corte limpio por palabra con puntos suspensivos. Nunca parte una palabra.
 */
export function gospelHook(
  texto: string | undefined,
  max = GOSPEL_HOOK_MAX,
): string | null {
  if (!texto) return null;
  const clean = plainText(texto);
  if (!clean) return null;
  // Fin de frase de verdad: . ! ? (con la comilla que cierre detrás). Ni `:`
  // ni `;`: casi todo evangelio empieza "En aquel tiempo, dijo Jesús:", y
  // cortar ahí deja un gancho que no dice nada.
  const firstSentence = clean.match(/^(.+?[.!?][»"”’)]*)(\s|$)/)?.[1] ?? clean;
  if (firstSentence.length <= max) return firstSentence;
  const cut = firstSentence.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const base = (lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).replace(
    /[\s,;:.]+$/,
    '',
  );
  return `${base}…`;
}

function gospelDay(
  date: string,
  readings: DailyReadings | null | undefined,
): WidgetGospelDay | null {
  const ref = readings?.evangelio?.cita?.trim();
  if (!ref) return null;
  const title = readings?.info?.titulo?.trim() || null;
  return { date, ref, title, hook: gospelHook(readings?.evangelio?.texto) };
}

export function buildContigoWidgetPayload({
  records,
  today,
  readingsByDate,
  now = Date.now(),
}: {
  records: Record<string, DayRecord>;
  today: string;
  /** Las lecturas que la app tenga en caché, por fecha. */
  readingsByDate: Record<string, DailyReadings | null | undefined>;
  now?: number;
}): ContigoWidgetPayload {
  const rec = records[today];
  const habits = {
    reading: !!rec?.readingDone,
    prayer: !!rec?.prayerDone,
    revision: !!rec?.revisionDone,
  };
  const streak = computeStreak(records, 'prayer', today);

  const gospel: WidgetGospelDay[] = [];
  for (let i = 0; i < GOSPEL_DAYS_AHEAD; i++) {
    const date = offsetISODate(today, i);
    const day = gospelDay(date, readingsByDate[date]);
    // Un hueco corta la serie: el widget no puede saltar de hoy a pasado
    // mañana y enseñar el de pasado mañana como si fuera el de mañana.
    if (!day) break;
    gospel.push(day);
  }

  return {
    version: WIDGET_PAYLOAD_VERSION,
    generatedAt: now,
    date: today,
    habits,
    doneCount:
      Number(habits.reading) + Number(habits.prayer) + Number(habits.revision),
    streak,
    streakTier: streakTier(streak),
    gospel,
  };
}
