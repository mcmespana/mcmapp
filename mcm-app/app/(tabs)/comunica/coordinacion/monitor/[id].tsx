// La ficha del monitor (plan 06). `?desde=grupo:<id>`: anterior/siguiente
// sobre los monitores de ese grupo; sin él, sobre «Tu equipo».

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import MonitorScreen from '@/components/comunica/coordinacion/MonitorScreen';

export default function Monitor() {
  const { id, desde } = useLocalSearchParams<{ id: string; desde?: string }>();
  return <MonitorScreen monitorId={String(id)} from={desde || undefined} />;
}
