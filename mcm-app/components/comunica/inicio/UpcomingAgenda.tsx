// «Próximas actividades» de la portada de familias (plan 11, punto 4): lo más cercano del calendario, entre «Actividades» y «Tu perfil».
// Solo se pinta si se enseña Calendario y hay algo (sin datos, sin conexión o vacío: nada, para no estropear la portada). Una fila por actividad
// (los abiertos a inscripción primero, luego las próximas sesiones; `upcomingAgendaItems`) y «Ver calendario» al pie.

import React from 'react';
import { useRouter } from 'expo-router';
import { comunicaNow } from '@/services/comunica';
import { useActiveProfile } from '@/hooks/comunica/useActiveProfile';
import { useCalendar } from '@/hooks/comunica/useCalendar';
import {
  type AgendaItem,
  upcomingAgendaItems,
} from '@/utils/comunica/calendar';
import { madridDay } from '@/utils/comunica/madrid';
import NavRow from '../comun/NavRow';
import Section from '../comun/Section';
import { useToneColor } from '../calendario/CalendarParts';

/** Cuántas actividades como mucho. */
const AGENDA_MAX = 5;

export default function UpcomingAgenda() {
  const toneColor = useToneColor();
  const router = useRouter();
  const { active } = useActiveProfile();
  const q = useCalendar(active?.id);
  if (!q.data) return null;
  const now = comunicaNow();
  const items = upcomingAgendaItems(
    q.data,
    madridDay(now),
    AGENDA_MAX,
    now.getTime(),
  );
  if (items.length === 0) return null;

  const open = (i: AgendaItem) => {
    if (i.kind === 'session')
      router.push({
        pathname: '/comunica/calendario/sesion/[id]',
        params: { id: i.id },
      } as never);
    else
      router.push({
        pathname: '/comunica/actividades/[eventId]',
        params: { eventId: i.eventId },
      } as never);
  };

  return (
    <Section title="Próximas actividades">
      {items.map((i) => (
        <NavRow
          key={`${i.kind}-${i.id}`}
          dot={i.kind === 'open' ? toneColor('accent') : toneColor('info')}
          title={i.title}
          subtitle={i.line}
          onPress={() => open(i)}
        />
      ))}
      <NavRow
        icon="calendar"
        title="Ver calendario"
        onPress={() => router.push('/comunica/calendario' as never)}
      />
    </Section>
  );
}
