// app/(tabs)/comunica/datos/[pid].tsx — «Mis datos» y «Datos de Lucía»
// (plan 12). `pid` es uno concreto, `actual` (el perfil que se ve) o `yo`
// (quien ha entrado); `completar=pago`, el rebote del pago (plan 15).

import React from 'react';
import PersonDetailsScreen from '@/components/comunica/datos/PersonDetailsScreen';

export default function ComunicaPersonDetails() {
  return <PersonDetailsScreen />;
}
