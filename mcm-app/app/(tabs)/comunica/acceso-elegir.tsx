// app/(tabs)/comunica/acceso-elegir.tsx — «¿Quién eres?» (plan 02).

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import ChooseScreen from '@/components/comunica/acceso/ChooseScreen';
import { PersonChoice, VerifyRequest } from '@/services/comunica/contract';

export default function ComunicaAccesoElegir() {
  const p = useLocalSearchParams<{ body?: string; choices?: string }>();
  const body = VerifyRequest.safeParse(JSON.parse(p.body ?? 'null'));
  const choices = PersonChoice.array().safeParse(JSON.parse(p.choices ?? '[]'));
  if (!body.success || !choices.success) return null;
  return <ChooseScreen body={body.data} choices={choices.data} />;
}
