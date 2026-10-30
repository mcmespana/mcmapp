// utils/comunica/summary.ts
//
// El RESUMEN DE GRUPOS y la línea de «Resumen de grupos» en Coordinación
// (plan 06, regla 10; `single_stic_pasar_lista_resumen.php`,
// `sticpa_pl_tiras_por_etapa`, `…_ultima_sesion_estado` y `…_recuento_fresco`
// del plugin), sin React. Una sola cuenta para las dos pantallas: si contaran
// por separado, dirían números distintos del mismo sábado.
//
//   · «Sin registro» cuenta como hecha: una lista cerrada a conciencia no falta.
//   · La pastilla dice cómo está la ÚLTIMA sesión; «Al día» solo sin ningún
//     hueco.
//   · La tarjeta de etapa suma ENTERA o nada: si a un grupo le falta el
//     recuento al día (≤ 3 días, y no del futuro), no hay número de chavales.
//   · Si las etapas tienen su última sesión en días distintos, no se inventa
//     una fecha común.

import type { ChipTone } from '@/components/comunica/comun/theme';
import type { RollCell, Stage, StageStrip } from '@/services/comunica/contract';
import { shortDayMonth } from './dates';
import { participantsLabel } from './marks';
import { monitorsCountText } from './monitorsRoll';
import { STAGE_TEXT } from './scope';

export type CellMark = 'ok' | 'skip' | 'gap';

export const cellMark = (c: RollCell): CellMark =>
  c === 'taken' ? 'ok' : c === 'skipped' ? 'skip' : 'gap';

export type StripRow = StageStrip['rows'][number];

export interface RowState {
  last: CellMark | null;
  gaps: number;
  badge: { label: string; tone: ChipTone };
  /** «todas pasadas» / «2 sin pasar». */
  note: string;
}

/** La pastilla y la cuenta de huecos de un grupo. */
export function stripRowState(row: Pick<StripRow, 'cells'>): RowState {
  const marks = row.cells.map(cellMark);
  const gaps = marks.filter((m) => m === 'gap').length;
  const last = marks.length ? marks[marks.length - 1] : null;
  const badge =
    last === 'gap'
      ? { label: 'Falta', tone: 'warning' as const }
      : last === 'skip'
        ? { label: 'Sin registro', tone: 'neutral' as const }
        : gaps > 0
          ? { label: 'Pasada', tone: 'neutral' as const }
          : { label: 'Al día', tone: 'positive' as const };
  return {
    last,
    gaps,
    badge,
    note: gaps === 0 ? 'todas pasadas' : `${gaps} sin pasar`,
  };
}

export interface LastSessionStatus {
  done: number;
  total: number;
  /** El día de la última sesión de cada etapa (sin repetir). */
  dates: string[];
  missing: { groupId: string; code: string; sessionId: string; stage: Stage }[];
}

/** «¿Pasaron lista el sábado?», contestado con nombres. */
export function lastSessionStatus(
  strips: readonly StageStrip[],
): LastSessionStatus {
  const out: LastSessionStatus = { done: 0, total: 0, dates: [], missing: [] };
  for (const strip of strips) {
    const last = strip.sessions[strip.sessions.length - 1];
    if (!last) continue;
    for (const row of strip.rows) {
      if (row.cells.length === 0) continue;
      out.total += 1;
      const m = cellMark(row.cells[row.cells.length - 1]);
      if (m === 'gap') {
        out.missing.push({
          groupId: row.group.id,
          code: row.group.code?.trim() || row.group.name,
          sessionId: last.id,
          stage: strip.stage,
        });
      } else out.done += 1;
    }
    if (!out.dates.includes(last.date)) out.dates.push(last.date);
  }
  return out;
}

export const pctOf = (s: Pick<LastSessionStatus, 'done' | 'total'>) =>
  s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;

/** «Última sesión · sáb 15 nov» o «Última sesión de cada etapa». */
export const lastSessionWhen = (s: LastSessionStatus) =>
  s.dates.length === 1
    ? `Última sesión · ${shortDayMonth(s.dates[0])}`
    : 'Última sesión de cada etapa';

export const listsText = (s: Pick<LastSessionStatus, 'done' | 'total'>) =>
  `${s.done} de ${s.total} listas`;

/** «todas pasadas» o «6 grupos sin pasarla todavía». */
export function missingText(s: LastSessionStatus): string {
  const n = s.total - s.done;
  if (n === 0) return 'todas pasadas';
  return n === 1
    ? '1 grupo sin pasarla todavía'
    : `${n} grupos sin pasarla todavía`;
}

/**
 * La línea de «Resumen de grupos» en Coordinación: «sáb 15 nov · 1 de 2
 * listas · falta C2» (hasta 4 códigos y «y N más»). Sin listas que tocaran,
 * lo que es la pantalla.
 */
export function coordinationSummaryLine(s: LastSessionStatus): string {
  if (s.total === 0) return 'Qué listas faltan y datos por revisar';
  const bits: string[] = [];
  if (s.dates.length === 1) bits.push(shortDayMonth(s.dates[0]));
  bits.push(listsText(s));
  if (s.missing.length === 0) bits.push('todas pasadas');
  else {
    const codes = s.missing.map((m) => m.code);
    let txt = codes.slice(0, 4).join(', ');
    if (codes.length > 4) txt += ` y ${codes.length - 4} más`;
    bits.push(`${codes.length === 1 ? 'falta' : 'faltan'} ${txt}`);
  }
  return bits.join(' · ');
}

const DAY_MS = 24 * 60 * 60_000;
/** Lo que se fía de un recuento nocturno: tres días (puede fallar una noche). */
export const HEADCOUNT_MAX_AGE_DAYS = 3;

/** ¿Se puede confiar en el recuento? (≤ 3 días, y no del futuro). */
export function headcountFresh(
  countedAt: string | null | undefined,
  now: Date,
): boolean {
  if (!countedAt) return false;
  const t = new Date(countedAt).getTime();
  if (Number.isNaN(t)) return false;
  if (t > now.getTime() + DAY_MS) return false;
  return now.getTime() - t <= HEADCOUNT_MAX_AGE_DAYS * DAY_MS;
}

export interface StageCard {
  stage: Stage;
  label: string;
  /** El número grande y su unidad («93 chavalines» o «8 grupos»). */
  value: number;
  unit: string;
  /** Una línea por dato: «8 grupos», «12 monitores» o «2 sin recuento». */
  meta: string[];
}

const groupsText = (n: number) => (n === 1 ? '1 grupo' : `${n} grupos`);

/** La tarjeta de una etapa: la suma entera, o nada. */
export function stageCard(strip: StageStrip, now: Date): StageCard {
  const n = strip.rows.length;
  let participants = 0;
  let monitors = 0;
  let fresh = 0;
  for (const r of strip.rows) {
    if (!r.headcount || !headcountFresh(r.headcount.countedAt, now)) continue;
    fresh += 1;
    participants += r.headcount.participants;
    monitors += r.headcount.monitors;
  }
  const complete = n > 0 && fresh === n;
  if (complete) {
    const label = participantsLabel(participants);
    return {
      stage: strip.stage,
      label: STAGE_TEXT[strip.stage],
      value: participants,
      unit: label.slice(String(participants).length + 1),
      meta: [
        groupsText(n),
        ...(monitors > 0 ? [monitorsCountText(monitors)] : []),
      ],
    };
  }
  return {
    stage: strip.stage,
    label: STAGE_TEXT[strip.stage],
    value: n,
    unit: n === 1 ? 'grupo' : 'grupos',
    meta: [fresh === 0 ? 'sin recuento' : `${n - fresh} sin recuento`],
  };
}

/** El pie de la tira: lo que SE VE, no el tope configurado. */
export function stripFootnote(
  strips: readonly StageStrip[],
  stripLimit: number,
): string {
  const shown = Math.max(0, ...strips.map((s) => s.sessions.length));
  if (shown < stripLimit)
    return 'La tira enseña las sesiones del curso hasta hoy.';
  return stripLimit === 1
    ? 'La tira enseña la última sesión.'
    : `La tira enseña las últimas ${stripLimit} sesiones.`;
}

/** Cuántos grupos hay en unas tiras («El resto de la delegación · 3 grupos»). */
export const rowGroupCount = (strips: readonly StageStrip[]) =>
  strips.reduce((n, s) => n + s.rows.length, 0);
