/**
 * Helpers puros de fecha/hora para el calendario ICS.
 *
 * El pecado que estos helpers evitan es mezclar sistemas horarios en la misma
 * operación: parsear `'YYYY-MM-DD'` como medianoche UTC, avanzar días con
 * `setDate()` (hora de pared LOCAL) y formatear con `toISOString()` (UTC otra
 * vez). Al cruzar el cambio de hora, el instante retrocede una hora y la fecha
 * UTC cae en el día anterior: un evento del 28-mar al 2-abr emitía
 * `28, 29, 29, 31…` — un día duplicado, otro desaparecido y el final un día
 * antes. Justo la ventana de Semana Santa y los retiros.
 */
import { localISO } from '@/utils/localDate';

/**
 * Suma `n` días a una fecha `'YYYY-MM-DD'` sin pasar en ningún momento por la
 * hora local: parseo, incremento y formato ocurren todos en UTC, así que el
 * cambio de hora no puede desplazar el resultado.
 */
export function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const nd = new Date(Date.UTC(y, m - 1, d + n));
  const mm = String(nd.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(nd.getUTCDate()).padStart(2, '0');
  return `${nd.getUTCFullYear()}-${mm}-${dd}`;
}

/**
 * Tope de seguridad para la expansión de un rango: un ICS corrupto con un
 * `DTEND` en el año 3000 haría un bucle de cientos de miles de iteraciones.
 * Ningún evento real de este calendario dura más de un año.
 */
export const MAX_EVENT_DAYS = 366;

/**
 * Claves `'YYYY-MM-DD'` que ocupa un evento: una por cada día de su rango
 * (ambos extremos incluidos). La comparación lexicográfica de `'YYYY-MM-DD'`
 * coincide con el orden cronológico, así que no hace falta ningún `Date`.
 */
export function eventDateKeys(ev: {
  startDate: string;
  endDate?: string;
  isSingleDay?: boolean;
}): string[] {
  if (!ev.endDate || ev.isSingleDay) return [ev.startDate];
  if (ev.endDate < ev.startDate) return [ev.startDate];

  const keys: string[] = [];
  let cur = ev.startDate;
  while (cur <= ev.endDate && keys.length < MAX_EVENT_DAYS) {
    keys.push(cur);
    cur = addDaysISO(cur, 1);
  }
  return keys;
}

/** Resultado de parsear el valor de un `DTSTART`/`DTEND`. */
export interface IcsDateTime {
  /** `'YYYY-MM-DD'` en hora LOCAL del dispositivo. */
  date?: string;
  /** `'HH:MM'` en hora LOCAL. Ausente en valores de solo fecha. */
  time?: string;
  /** `true` si el valor era solo fecha (`YYYYMMDD`) → evento de día entero. */
  isDateOnly: boolean;
}

/**
 * Parsea el VALOR de un `DTSTART`/`DTEND` de ICS (lo que va tras el primer
 * `:`) a fecha y hora locales:
 *
 * - `YYYYMMDD` → día entero. No se convierte nada: una fecha suelta no tiene
 *   instante que trasladar.
 * - `YYYYMMDDTHHMMSSZ` → instante **UTC**, que es lo que emite el feed real de
 *   Google (`basic.ics`). Se convierte a fecha y hora locales; antes se tomaba
 *   el `HHMM` literal, así que en España se mostraban 1-2 h **antes** de la
 *   hora real, y un evento de las 23:00 UTC aparecía además en el día
 *   equivocado.
 * - `YYYYMMDDTHHMMSS` sin `Z` → hora "flotante" (o cualificada con `;TZID=`,
 *   que este feed no usa). Se toma **tal cual**, exactamente como hasta ahora:
 *   convertirla incondicionalmente rompería los feeds que hoy funcionan.
 */
export function parseIcsDateTimeValue(value: string): IcsDateTime {
  const v = value.trim();

  const utc = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?Z$/.exec(v);
  if (utc) {
    const [, y, mo, d, h, mi, s] = utc;
    const instant = new Date(
      Date.UTC(
        Number(y),
        Number(mo) - 1,
        Number(d),
        Number(h),
        Number(mi),
        Number(s ?? '0'),
      ),
    );
    const hh = String(instant.getHours()).padStart(2, '0');
    const mm = String(instant.getMinutes()).padStart(2, '0');
    return { date: localISO(instant), time: `${hh}:${mm}`, isDateOnly: false };
  }

  const datePart = v.replace(/T.*$/, '');
  if (!/^\d{8}$/.test(datePart)) return { isDateOnly: false };

  const date = `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}`;
  const isDateOnly = !v.includes('T');
  if (isDateOnly) return { date, isDateOnly: true };

  // Flotante: el HHMM se toma literal, sin traslado de zona.
  const timeMatch = v.match(/T(\d{2})(\d{2})/);
  return {
    date,
    time: timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : undefined,
    isDateOnly: false,
  };
}
