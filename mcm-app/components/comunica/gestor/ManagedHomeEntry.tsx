// La entrada de «Eventos que gestionas» en la portada del área (plan 18). Sale
// a quien Comunica Tools ha nombrado gestor/a de algún evento (`me.managesEvents`),
// tenga papel de equipo o no: un gestor puede no ser monitor.
//
//   · Un evento en marcha hoy: su tarjeta, que abre el check-in directamente
//     (es lo que se busca en la puerta).
//   · Siempre, la fila «Eventos que gestionas», que lleva a la lista.
//
// Si la lista no llega (sin red y sin nada guardado), queda la fila: nunca se
// esconde la entrada.

import React from 'react';
import { useRouter } from 'expo-router';
import { comunicaNow } from '@/services/comunica';
import { useManagedEvents } from '@/hooks/comunica/managedEvents';
import { useMe } from '@/hooks/comunica/useMe';
import { classifyManaged } from '@/utils/comunica/checkin';
import { madridDay } from '@/utils/comunica/madrid';
import NavRow from '../comun/NavRow';
import Section from '../comun/Section';
import { ManagedTodayCard } from './ManagedEventsScreen';

export default function ManagedHomeEntry() {
  const { me } = useMe();
  if (!me?.managesEvents) return null;
  return <Entry />;
}

function Entry() {
  const router = useRouter();
  const q = useManagedEvents();
  const events = q.data?.events ?? [];
  const today = classifyManaged(events, madridDay(comunicaNow())).today;
  return (
    <>
      {today.length > 0 ? (
        <Section title="Eventos que gestionas" bare>
          {today.map((e) => (
            <ManagedTodayCard key={e.id} event={e} />
          ))}
        </Section>
      ) : null}
      <Section title={today.length > 0 ? undefined : 'Eventos que gestionas'}>
        <NavRow
          icon="person.crop.circle.badge.checkmark"
          title={
            today.length > 0
              ? 'Todos los que gestionas'
              : 'Check-in de tus eventos'
          }
          subtitle="Quién ha llegado, sus fichas y notas"
          trailing={
            events.length === 0
              ? undefined
              : events.length === 1
                ? '1 evento'
                : `${events.length} eventos`
          }
          onPress={() => router.push('/comunica/gestion')}
        />
      </Section>
    </>
  );
}
