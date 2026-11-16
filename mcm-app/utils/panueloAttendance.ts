/**
 * Piezas del pañuelo por asistencia — la regla, pura.
 *
 * **Sin imports de la app, a propósito**: el día que exista la Cloud Function
 * `panueloClaimAttendance` (fase F2 de `docs/planes/PLAN_PANUELO_ASISTENCIA.md`)
 * este fichero se copia tal cual a `functions/` (como `utils/icsParser.ts`).
 * Por eso los tipos de abajo son estructurales: encajan con los de
 * `types/panuelo.ts` sin importarlos (lo comprueba
 * `__tests__/panueloAttendance.test.ts`).
 *
 * La regla, decidida por el propietario (2026-11-16): **la pieza sigue
 * siempre a la asistencia**, sin plazos. Existe si y solo si la asistencia la
 * respalda hoy: llega cuando se marca (aunque sea tarde) y se quita si se
 * corrige (aunque haga dos años).
 */

export type AttendanceMark =
  'yes' | 'partial' | 'no_justified' | 'no_unjustified';

/** La concesión `attendance` de una pieza del catálogo. */
export interface AttendanceGrant {
  type: 'attendance';
  events: string[];
  marks?: AttendanceMark[];
  minDays?: number;
}

/** Lo justo de una pieza del catálogo para esta regla. */
export interface AttendanceCatalogItem {
  grant?: { type: string } | AttendanceGrant;
}

/** Un día con marca: `day` es `AAAA-MM-DD`, como lo da el CRM. */
export interface AttendanceDay {
  day: string;
  mark: AttendanceMark;
}

/** Las marcas de una persona, por id de evento. */
export type AttendedEvents = Record<string, AttendanceDay[]>;

export interface AttendanceAward {
  at: number;
  via: 'attendance';
  eventId: string;
  grantedAt: number;
}

/** Lo que cuenta como «ha ido» si la pieza no dice otra cosa. */
export const DEFAULT_ATTENDANCE_MARKS: readonly AttendanceMark[] = [
  'yes',
  'partial',
];

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Un día `AAAA-MM-DD` en ms, a mediodía UTC: así la fecha no se corre de día
 * en ningún huso de España (ni en Canarias). `NaN` si no es un día.
 */
export function dayToMs(day: string): number {
  const m = DAY.exec(day);
  if (!m) return NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
}

function isAttendance(
  grant: AttendanceCatalogItem['grant'],
): grant is AttendanceGrant {
  return grant?.type === 'attendance';
}

/** Los ids de evento que mira el catálogo entero, sin repetir y ordenados. */
export function attendanceEventIds(
  catalog: Record<string, AttendanceCatalogItem>,
): string[] {
  const out = new Set<string>();
  for (const item of Object.values(catalog)) {
    if (isAttendance(item.grant)) item.grant.events.forEach((e) => out.add(e));
  }
  return [...out].sort();
}

/**
 * ¿Bastan estas marcas (las de UN evento) para la pieza? Cuenta los días
 * distintos con una marca de las que valen; hacen falta `minDays` (1 por
 * defecto). Devuelve el primer día que cuenta, o `null`.
 */
export function qualifies(
  grant: Pick<AttendanceGrant, 'marks' | 'minDays'>,
  days: readonly AttendanceDay[],
): string | null {
  const valid = grant.marks?.length ? grant.marks : DEFAULT_ATTENDANCE_MARKS;
  const counted = [
    ...new Set(
      days
        .filter((d) => valid.includes(d.mark) && DAY.test(d.day))
        .map((d) => d.day),
    ),
  ].sort();
  return counted.length >= Math.max(1, grant.minDays ?? 1) ? counted[0] : null;
}

/**
 * Qué piezas respalda hoy la asistencia, comparado con lo que ya había.
 *
 * - `awards`: lo que debe quedar escrito (TODO lo respaldado; lo demás fuera).
 * - `granted`: lo nuevo. `revoked`: lo que había y ya no se sostiene.
 *
 * Una pieza que se mantiene conserva su `at` y su `grantedAt` (no se vuelve a
 * presentar). Con varios eventos, gana el que tiene el primer día más
 * temprano. Las marcas de eventos que el catálogo no pide no cuentan.
 */
export function computeAwards(
  catalog: Record<string, AttendanceCatalogItem>,
  attended: AttendedEvents,
  existing: Record<string, AttendanceAward>,
  now: number,
): {
  awards: Record<string, AttendanceAward>;
  granted: string[];
  revoked: string[];
} {
  const awards: Record<string, AttendanceAward> = {};
  const granted: string[] = [];
  for (const [id, item] of Object.entries(catalog)) {
    if (!isAttendance(item.grant)) continue;
    let best: { eventId: string; day: string } | null = null;
    for (const eventId of item.grant.events) {
      const day = qualifies(item.grant, attended[eventId] ?? []);
      if (day && (!best || day < best.day)) best = { eventId, day };
    }
    if (!best) continue;
    const before = existing[id];
    awards[id] = before
      ? { ...before, eventId: best.eventId }
      : {
          at: dayToMs(best.day),
          via: 'attendance',
          eventId: best.eventId,
          grantedAt: now,
        };
    if (!before) granted.push(id);
  }
  const revoked = Object.keys(existing).filter((id) => !awards[id]);
  return { awards, granted: granted.sort(), revoked: revoked.sort() };
}
