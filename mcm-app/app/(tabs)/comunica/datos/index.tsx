// app/(tabs)/comunica/datos/index.tsx — «Mis datos» de a quien se ve ahora (o de uno mismo con `yo=1`). Es a donde llegan los enlaces del plugin
// (`single_stic_comunica_perfil`…), que no saben el id de la persona: aquí se resuelve con lo que se está viendo (plan 12).

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import AreaScreen from '@/components/comunica/comun/AreaScreen';
import { AreaSkeleton } from '@/components/comunica/comun/AreaState';
import ProfileDataScreen from '@/components/comunica/datos/ProfileDataScreen';
import { useActiveProfile } from '@/hooks/comunica/useActiveProfile';

export default function ComunicaDataOfActive() {
  const { yo, completar } = useLocalSearchParams<{
    yo?: string;
    completar?: string;
  }>();
  const active = useActiveProfile();
  const pid = yo === '1' ? active.profiles?.self.id : active.active?.id;
  if (!pid) {
    return (
      <AreaScreen>
        <AreaSkeleton kind="cards" />
      </AreaScreen>
    );
  }
  return <ProfileDataScreen pid={pid} completar={completar === 'pago'} />;
}
