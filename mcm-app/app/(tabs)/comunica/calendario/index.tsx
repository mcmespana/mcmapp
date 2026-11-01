// app/(tabs)/comunica/calendario/index.tsx — «Calendario» (plan 16): Mes / Agenda. `vista=agenda` abre la agenda (el enlace de `list_stic_sessions`).

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import CalendarScreen from '@/components/comunica/calendario/CalendarScreen';

export default function ComunicaCalendar() {
  const { vista } = useLocalSearchParams<{ vista?: string }>();
  return (
    <CalendarScreen initialView={vista === 'agenda' ? 'agenda' : 'month'} />
  );
}
