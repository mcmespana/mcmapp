// La lista de monitores (plan 06): `?tipo=semanal|reunion`, `?sesion=<id>` y,
// en la semanal, `?etapa=mic|com|lc` (una lista por etapa, cada una sobre su
// evento). Cambiar de fecha o de etapa es `setParams` (no apila).

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import MonitorsRollScreen from '@/components/comunica/coordinacion/MonitorsRollScreen';
import { STAGES, type Stage } from '@/services/comunica/contract';

export default function Monitores() {
  const { tipo, sesion, etapa } = useLocalSearchParams<{
    tipo?: string;
    sesion?: string;
    etapa?: string;
  }>();
  const stage = (STAGES as readonly string[]).includes(etapa ?? '')
    ? (etapa as Stage)
    : undefined;
  return (
    <MonitorsRollScreen
      kind={tipo === 'reunion' ? 'meeting' : 'weekly'}
      sessionId={sesion || undefined}
      stage={stage}
    />
  );
}
