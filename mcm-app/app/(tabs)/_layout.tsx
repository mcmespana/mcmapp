// app/(tabs)/_layout.tsx — selector de layout de pestañas por plataforma.
//
// Tres ramas (antes eran dos):
//   - iOS y Android → barra flotante nativa (`expo-native-compact-tabs`),
//     que al compactarse mantiene todos los iconos visibles.
//   - Web           → barra clásica de expo-router, sin cambios.
//
// La metadata de cada tab vive en `constants/tabsCatalog.ts` (TABS_CONFIG
// define el ORDEN de la barra) y qué tabs se ven lo decide
// `hooks/useVisibleTabs.ts` a partir del perfil.

import React from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { useColorScheme } from '@/hooks/useColorScheme';
import { useVisibleTabs } from '@/hooks/useVisibleTabs';
import { splitTabsForBar } from '@/constants/tabsCatalog';
import IOSTabsLayout from '@/components/tabs/IOSTabsLayout';
import AndroidTabsLayout from '@/components/tabs/AndroidTabsLayout';
import WebTabsLayout from '@/components/tabs/WebTabsLayout';

export default function TabsLayout() {
  const scheme = useColorScheme();
  const visibleTabs = useVisibleTabs();
  const { mainTabs } = splitTabsForBar(visibleTabs);

  return (
    <>
      {Platform.OS === 'web' ? (
        <WebTabsLayout />
      ) : Platform.OS === 'ios' ? (
        <IOSTabsLayout barTabs={mainTabs} />
      ) : (
        <AndroidTabsLayout barTabs={mainTabs} />
      )}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}
