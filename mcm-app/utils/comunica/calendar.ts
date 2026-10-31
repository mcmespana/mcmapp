// utils/comunica/calendar.ts
//
// El calendario de familias (plan 16), puro. El plan 11 adelanta lo que
// necesita la portada: `upcomingAgendaItems`, la agenda «Próximas
// actividades». El 16 añade aquí el resto (colores, bandas, puntitos).
//
// Regla de la agenda (`sticpa_home_agenda_items`, `inc/stic-calendar.php`):
// los eventos ABIERTOS a inscripción para el perfil activo que empiezan hoy o
// después, por fecha, cinco como mucho. ⚠️ El plugin dejó de listar las
// sesiones el 24/10/2026 («te apuntas al evento, no a sus sesiones»; a un
// monitor le enseñaba las de los chavales) y manda el código: el plan 11 y el
// 16, escritos antes, decían «luego las sesiones próximas».

import type { CalendarData } from '@/services/comunica/contract';

export interface AgendaItem {
  /** Por ahora solo hay abiertos (ver arriba). */
  kind: 'open';
  /** El id del evento: su ficha es el destino. */
  eventId: string;
  title: string;
  /** `YYYY-MM-DD`, el día en que empieza. */
  day: string;
}

/** Cuántas filas tiene la agenda de la portada. */
export const AGENDA_LIMIT = 5;

export function upcomingAgendaItems(
  data: Pick<CalendarData, 'openEvents'>,
  today: string,
  limit = AGENDA_LIMIT,
): AgendaItem[] {
  return data.openEvents
    .filter((e) => e.startDate >= today)
    .sort(
      (a, b) =>
        a.startDate.localeCompare(b.startDate) ||
        a.name.localeCompare(b.name, 'es'),
    )
    .slice(0, Math.max(1, limit))
    .map((e) => ({
      kind: 'open' as const,
      eventId: e.id,
      title: e.name,
      day: e.startDate,
    }));
}
