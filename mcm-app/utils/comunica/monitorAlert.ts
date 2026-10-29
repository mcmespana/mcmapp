// utils/comunica/monitorAlert.ts
//
// ¿Hay algo que mirar en un monitor? (plan 06, regla 6; `sticpa_pl_att_track`,
// `…_seguimiento_aviso` y `…_seguimiento_umbrales` del plugin). Sin React.
//
//   · Una sesión SIN MARCAR no cuenta en el porcentaje: no es una falta suya,
//     es un dato que no existe.
//   · Con menos de 4 sesiones marcadas no se dice nada: con dos datos, un
//     porcentaje es una anécdota.
//   · Primero las faltas seguidas al final (saltando los huecos; desde 3), y si
//     no, el porcentaje por debajo del 60 %.
//   · El % de la fila, pequeño y gris al final; rojo si es bajo. Solo con 4
//     marcadas o más.

import type { Mark } from '@/services/comunica/contract';
import { isAbsence, isAttendance } from './marks';

/** Los umbrales del plugin (el 3 lo confirmó el propietario el 28/08/2026). */
export const MONITOR_THRESHOLDS = {
  minPct: 60,
  streak: 3,
  minCounted: 4,
} as const;

export interface MonitorTrack {
  attended: number;
  missed: number;
  /** Celebradas sin marcar: fuera de la cuenta. */
  unknown: number;
  counted: number;
  /** 0-100, o `null` sin ninguna marcada («sin datos»). */
  pct: number | null;
}

/** La cuenta de unas marcas (de sesiones ya celebradas). */
export function monitorTrack(marks: readonly Mark[]): MonitorTrack {
  let attended = 0;
  let missed = 0;
  let unknown = 0;
  for (const m of marks) {
    if (isAttendance(m)) attended += 1;
    else if (isAbsence(m)) missed += 1;
    else unknown += 1;
  }
  const counted = attended + missed;
  return {
    attended,
    missed,
    unknown,
    counted,
    pct: counted > 0 ? Math.round((attended / counted) * 100) : null,
  };
}

/** Faltas seguidas al final, mirando hacia atrás y saltándose los huecos. */
export function trailingAbsences(marks: readonly Mark[]): number {
  let n = 0;
  for (let i = marks.length - 1; i >= 0; i--) {
    const m = marks[i];
    if (m === null) continue;
    if (isAttendance(m)) break;
    n += 1;
  }
  return n;
}

/** «3 seguidas sin venir», «55 % de asistencia» o nada (lo normal). */
export function monitorAlert(marks: readonly Mark[]): string | null {
  const t = monitorTrack(marks);
  if (t.counted < MONITOR_THRESHOLDS.minCounted) return null;
  const streak = trailingAbsences(marks);
  if (streak >= MONITOR_THRESHOLDS.streak) {
    return streak === 1
      ? '1 sesión seguida sin venir'
      : `${streak} seguidas sin venir`;
  }
  if (t.pct !== null && t.pct < MONITOR_THRESHOLDS.minPct) {
    return `${t.pct} % de asistencia`;
  }
  return null;
}

/** El % de la fila (solo con 4 marcadas o más) y si es bajo. */
export function rowPct(
  marks: readonly Mark[],
): { pct: number; low: boolean; title: string } | null {
  const t = monitorTrack(marks);
  if (t.pct === null || t.counted < MONITOR_THRESHOLDS.minCounted) return null;
  return {
    pct: t.pct,
    low: t.pct < MONITOR_THRESHOLDS.minPct,
    title: `Vino a ${t.attended} de ${t.counted} sesiones marcadas`,
  };
}
