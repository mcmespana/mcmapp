// utils/comunica/monitorDetail.ts
//
// La FICHA DEL MONITOR (plan 06, regla 12; `single_stic_pasar_lista_monitor.php`,
// `sticpa_pl_att_track`, `…_listas_track` y `…_monitor_bloques` del plugin),
// sin React. Tres pistas que NO se promedian: las reuniones son tres o cuatro
// al año y juntarlas con los sábados esconde justo lo que se viene a mirar.

import type { MonitorDetail, Square } from '@/services/comunica/contract';
import { shortDate } from './sessions';
import { MARK_LABEL } from './marks';
import { monitorTrack } from './monitorAlert';
import { memberLine } from './monitorsRoll';

type Monitor = MonitorDetail['monitor'];

/** «C1 · C2 · 4 ESO · 23 años · monitor/a desde 2019». */
export function identityLine(m: Monitor): string {
  return [
    m.groupCodes.length ? memberLine(m) : null,
    m.age !== undefined ? `${m.age} años` : null,
    m.monitorSinceYear ? `monitor/a desde ${m.monitorSinceYear}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

type Compliance = MonitorDetail['paperwork']['compliance'];

/**
 * La pastilla de arriba: los requisitos OBLIGATORIOS que faltan, los dos
 * primeros por su nombre y «y N más». LOPD e imágenes son permisos: no
 * cuentan. Todo en regla: nada (una cajita verde fija enseña a no mirarla).
 */
export function missingRequirements(compliance: Compliance): string | null {
  const missing = compliance
    .filter((c) => c.required && !c.ok)
    .map((c) => c.label);
  if (missing.length === 0) return null;
  const shown = missing.slice(0, 2).join(' · ');
  return missing.length > 2
    ? `Falta: ${shown} y ${missing.length - 2} más`
    : `Falta: ${shown}`;
}

/** La cabecera de «En regla»: «falta 1», «faltan 3» o «todo en regla». */
export function complianceFlag(compliance: Compliance): {
  text: string;
  ok: boolean;
} {
  const n = compliance.filter((c) => c.required && !c.ok).length;
  if (n === 0) return { text: 'todo en regla', ok: true };
  return { text: n === 1 ? 'falta 1' : `faltan ${n}`, ok: false };
}

/** La nota de una fila de «En regla»: la suya, o «No lo ha autorizado». */
export const complianceNote = (c: Compliance[number]) =>
  c.note ?? (!c.ok && !c.required ? 'No lo ha autorizado' : undefined);

export type TrackView =
  | { kind: 'message'; text: string }
  | {
      kind: 'track';
      score: string;
      /** El marcador va en gris («sin datos»). */
      scoreMuted?: boolean;
      foot: string;
      squares: Square[];
      /** Las faltas a reuniones, con su porqué (la más reciente arriba). */
      absences?: { what: string; why: string }[];
    };

/** Sábados: % (o «sin datos») y «Vino a X de Y · N sábados sin marcar…». */
export function weeklyTrack(weekly: MonitorDetail['weekly']): TrackView | null {
  if (!weekly) return null;
  if (!weekly.registered) {
    return {
      kind: 'message',
      text: 'No está inscrito al evento de sesiones, así que no hay asistencias suyas todavía.',
    };
  }
  const t = monitorTrack(weekly.squares.map((s) => s.mark));
  let foot = `Vino a ${t.attended} de ${t.counted}`;
  if (t.unknown > 0) {
    foot += ` · ${
      t.unknown === 1
        ? '1 sábado sin marcar, fuera de la cuenta'
        : `${t.unknown} sábados sin marcar, fuera de la cuenta`
    }`;
  }
  return {
    kind: 'track',
    score: t.pct === null ? 'sin datos' : `${t.pct} %`,
    scoreMuted: t.pct === null,
    foot,
    squares: weekly.squares,
  };
}

/** Reuniones: fracción («2 de 4»), NUNCA %, y cada falta con su porqué. */
export function meetingsTrack(
  meetings: MonitorDetail['meetings'],
): TrackView | null {
  if (!meetings) return null;
  if (meetings.squares.length === 0) {
    return {
      kind: 'message',
      text: 'Todavía no ha habido ninguna reunión de programación.',
    };
  }
  if (!meetings.registered) {
    return {
      kind: 'message',
      text: 'Todavía no aparece en ninguna lista de reunión.',
    };
  }
  const t = monitorTrack(meetings.squares.map((s) => s.mark));
  const absences = meetings.squares
    .filter((s) => s.mark === 'no_justified' || s.mark === 'no_unjustified')
    .reverse()
    .map((s) => ({
      what: [shortDate(s.date), s.name].filter(Boolean).join(' · '),
      why: `${MARK_LABEL[s.mark!]}: ${s.reason?.trim() || 'sin motivo'}`,
    }));
  return {
    kind: 'track',
    score: `${t.attended} de ${t.counted}`,
    foot:
      t.unknown > 0
        ? t.unknown === 1
          ? '1 reunión sin marcar'
          : `${t.unknown} reuniones sin marcar`
        : '',
    squares: meetings.squares,
    absences,
  };
}

export type ListSquareState = 'mine' | 'other' | 'skipped' | 'missing';

export const LIST_SQUARE_LABEL: Record<ListSquareState, string> = {
  mine: 'La pasó',
  other: 'La pasó otra persona',
  skipped: 'No hubo sesión',
  missing: 'Sin lista',
};

/**
 * «Listas del C2»: con lista / las que tocaban (los «no hubo sesión» fuera), y
 * el reparto solo cuando lo hay.
 */
export function rollCallTrack(squares: readonly { state: ListSquareState }[]): {
  score: string;
  foot: string;
} {
  const n = (s: ListSquareState) => squares.filter((q) => q.state === s).length;
  const mine = n('mine');
  const other = n('other');
  const skipped = n('skipped');
  const withList = mine + other;
  const expected = squares.length - skipped;
  let foot = '';
  if (mine > 0 && other > 0) foot = `${mine} suyas, ${other} de otra persona`;
  else if (other > 0)
    foot = other === 1 ? 'La pasó otra persona' : 'Las pasó otra persona';
  else if (mine > 0) {
    const missing = Math.max(0, expected - withList);
    foot =
      missing === 0
        ? 'Las ha pasado siempre'
        : `${missing === 1 ? 'Falta 1' : `Faltan ${missing}`} · ${
            withList === 1 ? 'la que hay es suya' : 'las que hay son suyas'
          }`;
  }
  if (skipped > 0) {
    foot += `${foot ? ' · ' : ''}${
      skipped === 1 ? '1 sábado sin sesión' : `${skipped} sábados sin sesión`
    }`;
  }
  return { score: `${withList} de ${expected}`, foot };
}

export const ROLL_CALL_FOOTNOTE =
  'La lista de un grupo la puede pasar quien cubra ese sábado, así que esta fila se lee junto a la de arriba.';

/** «Ana, Luis y Marta»; con más de 4, «Ana, Luis, Marta y 3 más». */
export function withNames(names: readonly string[], max = 4): string {
  if (names.length === 0) return '';
  let list = [...names];
  if (list.length > max) {
    const rest = list.length - (max - 1);
    list = [...list.slice(0, max - 1), `${rest} más`];
  }
  if (list.length === 1) return list[0];
  return `${list.slice(0, -1).join(', ')} y ${list[list.length - 1]}`;
}

type GroupEntry = MonitorDetail['groups'][number];

/** «12 chavalines · 2 monitores · desde 2024». */
export function groupMeta(g: GroupEntry): string {
  const bits: string[] = [];
  const p = g.counts.participants;
  if (p) bits.push(p === 1 ? '1 chavalín' : `${p} chavalines`);
  const m = g.counts.monitors;
  if (m) bits.push(m === 1 ? '1 monitor' : `${m} monitores`);
  if (g.since) bits.push(`desde ${g.since.slice(0, 4)}`);
  return bits.join(' · ');
}

/** La línea de un cuadradito en su hoja: «12 sep · Justificada · Examen». */
export function squareLine(s: Square): string {
  return [
    shortDate(s.date),
    s.name,
    s.mark ? MARK_LABEL[s.mark] : 'Sin marcar',
    s.mark ? s.reason : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** La solapa de «Formación»: lo que tiene, sin desplegar. */
export function trainingSummary(
  training: MonitorDetail['paperwork']['training'],
): string {
  return training
    .filter((t) => t.ok)
    .map((t) => t.label.split(' · ')[0])
    .join(' · ');
}
