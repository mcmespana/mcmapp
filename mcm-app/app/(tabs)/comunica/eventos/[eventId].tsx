// Un evento (plan 07): `view` (`list` o la clave de una pestaña de grupos),
// `by` (pasar lista por esa pestaña), `group` (con ese grupo ya elegido) y
// `session` (otro día).

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import EventScreen from '@/components/comunica/eventos/EventScreen';

export default function Evento() {
  const { eventId, view, by, group, session } = useLocalSearchParams<{
    eventId: string;
    view?: string;
    by?: string;
    group?: string;
    session?: string;
  }>();
  return (
    <EventScreen
      eventId={String(eventId)}
      view={view || undefined}
      by={by || undefined}
      group={group || undefined}
      session={session || undefined}
    />
  );
}
