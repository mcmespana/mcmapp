// app/(tabs)/comunica/datos/[pid].tsx — «Mis datos» (`pid` = uno mismo) o «Datos de Lucía» (plan 12). `completar=pago` es el rebote del pago (plan 15).

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import ProfileDataScreen from '@/components/comunica/datos/ProfileDataScreen';

export default function ComunicaProfileData() {
  const { pid, completar } = useLocalSearchParams<{
    pid: string;
    completar?: string;
  }>();
  return <ProfileDataScreen pid={pid} completar={completar === 'pago'} />;
}
