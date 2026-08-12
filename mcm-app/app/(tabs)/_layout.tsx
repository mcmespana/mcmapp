// app/(tabs)/_layout.tsx — selector de layout de pestañas por plataforma.
//
// Tres ramas (antes eran dos):
//   - iOS y Android → barra flotante nativa (`expo-native-compact-tabs`),
//     que al compactarse mantiene todos los iconos visibles.
//   - Web           → barra clásica de expo-router, sin cambios.
//
// La rama la resuelve METRO por sufijo de fichero (`PlatformTabsLayout.web.tsx`),
// no un `if` aquí: importar los layouts nativos desde web arrastraba
// `expo-native-compact-tabs`, que llama a `requireNativeViewManager()` al
// cargarse, y eso tumbaba `expo export --platform web` entero.
//
// La metadata de cada tab vive en `constants/tabsCatalog.ts` (TABS_CONFIG
// define el ORDEN de la barra) y qué tabs se ven lo decide
// `hooks/useVisibleTabs.ts` a partir del perfil.

import React from 'react';
import { StatusBar } from 'expo-status-bar';

import { useColorScheme } from '@/hooks/useColorScheme';
import { useVisibleTabs } from '@/hooks/useVisibleTabs';
import { splitTabsForBar } from '@/constants/tabsCatalog';
import PlatformTabsLayout from '@/components/tabs/PlatformTabsLayout';

export default function TabsLayout() {
  const scheme = useColorScheme();
  const visibleTabs = useVisibleTabs();
  const { mainTabs } = splitTabsForBar(visibleTabs);

  return (
    <>
      <PlatformTabsLayout barTabs={mainTabs} />
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}
