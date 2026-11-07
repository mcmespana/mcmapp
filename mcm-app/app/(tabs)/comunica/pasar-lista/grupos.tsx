// El árbol de grupos de Pasar Lista (plan 04). `?seccion=MIC|COM:com_1|COM|LC|?`;
// sin ella, entero.

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import GroupsTreeScreen from '@/components/comunica/pasar-lista/GroupsTreeScreen';

export default function PasarListaGrupos() {
  const { seccion } = useLocalSearchParams<{ seccion?: string }>();
  return <GroupsTreeScreen section={seccion} />;
}
