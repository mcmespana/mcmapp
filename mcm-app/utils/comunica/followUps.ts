// utils/comunica/followUps.ts
//
// Los SEGUIMIENTOS de un monitor (plan 06, regla 13; `PASAR-LISTA-SEGUIMIENTOS.md`
// §5 y §7 del plugin; `sticpa_pl_seg_*`), sin React. Es la parte más delicada
// del área: un filtro mal puesto no enseña un dato de más, enseña a una
// persona lo que otra escribió sobre ella. La tabla la usan el servidor falso
// y la pantalla (el segundo cierre).
//
//   · Incidencias y valoraciones: las escribe coordinación y las leen
//     coordinación y acompañamiento.
//   · Acompañamiento: solo acompañamiento (ni coordinación ni la persona).
//   · Nadie ve los suyos: sobre uno mismo, nada, tampoco coordinando.
//   · Un tipo desconocido no se enseña.
//   · Por defecto, solo los de este curso; un botón suma el anterior sin
//     pedir nada. Sin fecha, sale siempre (esconderlo sería perderlo).

import type {
  FollowUp,
  FollowUpType,
  Role,
} from '@/services/comunica/contract';
import { FOLLOW_UP_TYPES } from '@/services/comunica/contract';
import type { ChipTone } from '@/components/comunica/comun/theme';

type SeatRole = 'coordination' | 'accompaniment';

export const FOLLOW_UP_META: Record<
  FollowUpType,
  {
    label: string;
    help: string;
    read: readonly SeatRole[];
    write: readonly SeatRole[];
    /** Color por CLAVE (⚠️ provisional, `territorio`). */
    tone: ChipTone;
  }
> = {
  incident: {
    label: 'Incidencia',
    help: 'Algo concreto que pasó un día',
    read: ['coordination', 'accompaniment'],
    write: ['coordination'],
    tone: 'warning',
  },
  assessment: {
    label: 'Valoración de trimestre',
    help: 'Cómo ha ido el trimestre',
    read: ['coordination', 'accompaniment'],
    write: ['coordination'],
    tone: 'info',
  },
  accompaniment: {
    label: 'Acompañamiento',
    help: 'Solo lo ve quien acompaña',
    // La única que NO ve coordinación: por eso existe el papel aparte.
    read: ['accompaniment'],
    write: ['accompaniment'],
    tone: 'accent',
  },
};

const seats = (roles: readonly Role[]): SeatRole[] =>
  roles.filter(
    (r): r is SeatRole => r === 'coordination' || r === 'accompaniment',
  );

/** Los tipos que estos papeles pueden LEER (sin papeles, ninguno). */
export function readableTypes(roles: readonly Role[]): FollowUpType[] {
  const mine = seats(roles);
  return FOLLOW_UP_TYPES.filter((t) =>
    FOLLOW_UP_META[t].read.some((r) => mine.includes(r)),
  );
}

/** Los tipos que estos papeles pueden ESCRIBIR. */
export function writableTypes(roles: readonly Role[]): FollowUpType[] {
  const mine = seats(roles);
  return FOLLOW_UP_TYPES.filter((t) =>
    FOLLOW_UP_META[t].write.some((r) => mine.includes(r)),
  );
}

/** Lo que ve quien mira de quien es mirado. Sobre uno mismo, nada. */
export function followUpPermissions(
  roles: readonly Role[],
  viewerId: string,
  subjectId: string,
): { readable: FollowUpType[]; writable: FollowUpType[] } {
  if (viewerId && viewerId === subjectId) return { readable: [], writable: [] };
  return { readable: readableTypes(roles), writable: writableTypes(roles) };
}

/**
 * La última puerta: aunque el servidor ya filtre, se vuelve a filtrar con lo
 * legible. Lo que tenga un tipo que no se conoce, fuera.
 */
export function visibleFollowUps<T extends { type: string }>(
  items: readonly T[],
  readable: readonly string[],
): T[] {
  return items.filter(
    (i) =>
      (FOLLOW_UP_TYPES as readonly string[]).includes(i.type) &&
      readable.includes(i.type),
  );
}

/** El curso de un día: arranca el 1 de septiembre («2026-2027»). */
export function seasonOf(day: string): string {
  const [y, m] = day.split('-').map(Number);
  const start = m >= 9 ? y : y - 1;
  return `${start}-${start + 1}`;
}

/** «2025-2026» del «2026-2027». */
export function previousSeason(label: string): string {
  const m = /^(\d{4})-(\d{4})$/.exec(label);
  return m ? `${Number(m[1]) - 1}-${Number(m[2]) - 1}` : '';
}

/** Los de esos cursos; los que no tienen fecha, siempre. */
export function inSeasons<T extends Pick<FollowUp, 'date'>>(
  items: readonly T[],
  seasons: readonly string[],
): T[] {
  return items.filter((i) => !i.date || seasons.includes(seasonOf(i.date)));
}

/** Más reciente arriba; sin fecha, al final. */
export function sortFollowUps<T extends Pick<FollowUp, 'date'>>(
  items: readonly T[],
): T[] {
  return [...items].sort((a, b) => {
    if (a.date === b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date < b.date ? 1 : -1;
  });
}

export interface FollowUpsView<T> {
  items: T[];
  /** «Ver también los de 2025-2026» / «Ver solo los de 2026-2027», o nada. */
  toggle: string | null;
  empty: string;
}

/** Lo que enseña la sección con el curso de hoy y el botón del anterior. */
export function followUpsView<T extends Pick<FollowUp, 'date'>>(
  items: readonly T[],
  today: string,
  showPrevious: boolean,
): FollowUpsView<T> {
  const current = seasonOf(today);
  const previous = previousSeason(current);
  const seasons = showPrevious ? [current, previous] : [current];
  const shown = sortFollowUps(inSeasons(items, seasons));
  const hasOlder = items.length > inSeasons(items, [current]).length;
  return {
    items: shown,
    toggle: showPrevious
      ? `Ver solo los de ${current}`
      : hasOlder
        ? `Ver también los de ${previous}`
        : null,
    empty: showPrevious
      ? 'Nada apuntado en estos dos cursos.'
      : 'Nada apuntado este curso.',
  };
}

export const ACCOMPANIMENT_WARNING =
  'Las notas de acompañamiento solo las ve quien acompaña. Ni coordinación ni la propia persona.';
