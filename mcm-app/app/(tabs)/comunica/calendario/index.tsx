// «Calendario» de familias (plan 16): Mes o Agenda (`view=agenda`, el
// destino de «Mis sesiones», `list_stic_sessions`).

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import CalendarScreen from '@/components/comunica/calendario/CalendarScreen';

export default function ComunicaCalendario() {
  const { view } = useLocalSearchParams<{ view?: string }>();
  return (
    <CalendarScreen initialView={view === 'agenda' ? 'agenda' : 'month'} />
  );
}
