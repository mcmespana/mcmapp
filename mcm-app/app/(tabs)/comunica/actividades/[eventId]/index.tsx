// app/(tabs)/comunica/actividades/[eventId]/index.tsx — la ficha de un evento (plan 13). Es carpeta porque el plan 14 cuelga de ella `inscribirme`.

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import EventDetailScreen from '@/components/comunica/actividades/EventDetailScreen';

export default function ComunicaActivityDetail() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  return <EventDetailScreen eventId={eventId} />;
}
