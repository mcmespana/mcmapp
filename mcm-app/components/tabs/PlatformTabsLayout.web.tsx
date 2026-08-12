// Layout de pestañas en WEB: la barra clásica de expo-router.
//
// Metro resuelve este fichero (sufijo `.web.tsx`) en lugar de
// `PlatformTabsLayout.tsx`, así que el bundle de web NO contiene los layouts
// nativos y, con ellos, tampoco `expo-native-compact-tabs` — que llama a
// `requireNativeViewManager()` al cargarse y no tiene equivalente en web.
//
// `barTabs` se acepta y se ignora a propósito: mantiene la misma firma que la
// versión nativa para que `app/(tabs)/_layout.tsx` no tenga que saber en qué
// plataforma está.
import React from 'react';

import WebTabsLayout from '@/components/tabs/WebTabsLayout';
import type { TabConfig } from '@/constants/tabsCatalog';

export default function PlatformTabsLayout(_props: { barTabs: TabConfig[] }) {
  return <WebTabsLayout />;
}
