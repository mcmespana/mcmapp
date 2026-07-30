// app/(tabs)/comunica.tsx
//
// Tab "Comunica": portal de comunicación (WebView a
// comunica.movimientoconsolacion.com). Hasta ahora Comunica sólo existía como
// pantalla dentro del stack de "Más"; el catálogo de tabs ya la contemplaba
// pero la ruta no existía, así que ponerla en `tabs` no funcionaba.
//
// La pantalla se pinta a pantalla completa y se gestiona su propia zona segura
// (barra glass en el notch en iOS, franja lisa en Android), por eso el tab va
// con `headerShown: false` en `TABS_CONFIG`.

import React from 'react';
import ComunicaScreen from '../screens/ComunicaScreen';

export default function ComunicaTab() {
  return <ComunicaScreen />;
}
