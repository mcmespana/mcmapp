// app/(tabs)/comunica/web.tsx
//
// El legado: la WebView del plugin tal cual. Desde aquí se abre a propósito
// (para comparar con la nativa, o para lo poco que no se haga en nativo; el
// salto con la sesión puesta es el plan 10 §2).

import React from 'react';
import ComunicaScreen from '@/app/screens/ComunicaScreen';

export default function ComunicaLegacy() {
  return <ComunicaScreen />;
}
