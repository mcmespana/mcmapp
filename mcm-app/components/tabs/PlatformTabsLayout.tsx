// Layout de pestañas para iOS y Android: barra flotante nativa.
//
// Este fichero existe para que el grafo de módulos de WEB no llegue nunca a
// `expo-native-compact-tabs`. Ese paquete llama a `requireNativeViewManager()`
// a nivel de módulo y no trae shim web, así que basta con IMPORTARLO —aunque
// sea en una rama de `Platform.OS` que nunca se ejecuta— para que reviente con
// «requireNativeViewManager is not available on web». Y reventaba: el
// renderizado estático de `expo export --platform web` evalúa
// `app/(tabs)/_layout.tsx` en Node, donde no hay módulos nativos, y ahí moría
// la exportación entera.
//
// La rama por plataforma la resuelve ahora Metro con el sufijo `.web.tsx`
// (misma convención que el resto del repo), no un `if` en tiempo de ejecución:
// en web se empaqueta `PlatformTabsLayout.web.tsx` y estos imports no existen.
import React from 'react';
import { Platform } from 'react-native';

import IOSTabsLayout from '@/components/tabs/IOSTabsLayout';
import AndroidTabsLayout from '@/components/tabs/AndroidTabsLayout';
import type { TabConfig } from '@/constants/tabsCatalog';

export default function PlatformTabsLayout({
  barTabs,
}: {
  barTabs: TabConfig[];
}) {
  return Platform.OS === 'ios' ? (
    <IOSTabsLayout barTabs={barTabs} />
  ) : (
    <AndroidTabsLayout barTabs={barTabs} />
  );
}
