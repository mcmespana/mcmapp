// El check-in de un evento que gestionas (plan 18).

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import CheckinScreen from '@/components/comunica/gestor/CheckinScreen';

export default function Checkin() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  return <CheckinScreen eventId={String(eventId)} />;
}
