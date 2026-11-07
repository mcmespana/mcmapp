// La ficha del participante (plan 05). `?groupId=` (de qué grupo se viene:
// anterior/siguiente), `?sessionId=` (desde marcar, para el aviso) y
// `?from=` (de qué lista se viene; solo se aceptan valores conocidos).

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import ParticipantScreen from '@/components/comunica/grupos/ParticipantScreen';

const FROM = ['group', 'roll', 'courses', 'az', 'groups'];

export default function Persona() {
  const { personId, groupId, sessionId, from } = useLocalSearchParams<{
    personId: string;
    groupId?: string;
    sessionId?: string;
    from?: string;
  }>();
  return (
    <ParticipantScreen
      // Al pasar a la siguiente, la ficha empieza de cero (hojas cerradas).
      key={String(personId)}
      personId={String(personId)}
      groupId={groupId || undefined}
      sessionId={sessionId || undefined}
      from={from && FROM.includes(from) ? from : undefined}
    />
  );
}
