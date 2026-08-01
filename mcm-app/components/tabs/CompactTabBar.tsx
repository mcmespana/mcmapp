// Barra de pestañas flotante nativa (iOS + Android).
//
// Envuelve `NativeCompactTabBar` de `expo-native-compact-tabs`: en iOS 26+ se
// pinta con Liquid Glass de UIKit, en iOS 16.4–18.x y Android con una píldora
// sólida con cápsula de selección animada. Lo que aporta frente a la barra
// nativa del sistema es que al COMPACTARSE mantiene todos los iconos visibles,
// en vez de colapsar a una píldora que los esconde.
//
// OJO: es un control VISUAL, no un navegador. Quien navega es expo-router
// desde `onTabSelected`; `selectedIndex` se deriva del pathname.

import { useCallback, useMemo } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  NativeCompactTabBar,
  type NativeCompactTabBarItem,
} from 'expo-native-compact-tabs';

import type { TabConfig } from '@/constants/tabsCatalog';
import { TAB_ICONS } from '@/constants/tabIcons';
import { TAB_BAR_HEIGHT, TAB_BAR_COMPACT_HEIGHT } from '@/constants/spacing';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useCarismochito } from '@/contexts/CarismochitoContext';
import { Colors } from '@/constants/colors';
import { tabBarController } from '@/components/tabs/tabBarController';
import { h } from '@/utils/haptics';
import { hrefForTab, selectedIndexFor } from '@/utils/tabRoutes';

/* Verdes del modo carismochito (ver app/(tabs)/_layout.tsx para el detalle). */
const CARISMO_ACTIVE_DARK = '#9DE86B';
const CARISMO_INACTIVE_DARK = '#4E8C5F';
const CARISMO_ACTIVE_LIGHT = '#1B9E4B';
const CARISMO_INACTIVE_LIGHT = '#6FA77E';

interface CompactTabBarProps {
  /** Tabs que van en la barra, ya recortados por `splitTabsForBar`. */
  tabs: TabConfig[];
}

export default function CompactTabBar({ tabs }: CompactTabBarProps) {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const { isActive: carismoActive } = useCarismochito();
  const compact = tabBarController.useCompact();

  const items = useMemo<NativeCompactTabBarItem[]>(
    () =>
      tabs.map((tab) => {
        const icons = TAB_ICONS[tab.name];
        return {
          key: tab.name,
          label: tab.label,
          icon: icons.icon,
          animationFrames: icons.frames,
          accessibilityLabel: tab.label,
        };
      }),
    [tabs],
  );

  const selectedIndex = selectedIndexFor(tabs, pathname);

  const onTabSelected = useCallback(
    ({ nativeEvent }: { nativeEvent: { index: number } }) => {
      const tab = tabs[nativeEvent.index];
      if (!tab) return;

      h.tap();
      tabBarController.expand();

      const href = hrefForTab(tab.name);
      const isReselection = nativeEvent.index === selectedIndex;

      if (isReselection) {
        // Re-tap del tab activo: subir su scroll arriba del todo, que es lo que
        // hace la barra nativa del sistema.
        tabBarController.scrollToTop(tab.name, true);
        return;
      }

      router.navigate(href as never);
    },
    [tabs, selectedIndex],
  );

  const tintColor = carismoActive
    ? isDark
      ? CARISMO_ACTIVE_DARK
      : CARISMO_ACTIVE_LIGHT
    : Colors[scheme ?? 'light'].tint;

  const inactiveTintColor = carismoActive
    ? isDark
      ? CARISMO_INACTIVE_DARK
      : CARISMO_INACTIVE_LIGHT
    : Colors[scheme ?? 'light'].icon;

  return (
    <NativeCompactTabBar
      items={items}
      selectedIndex={selectedIndex}
      compact={compact}
      tintColor={tintColor}
      inactiveTintColor={inactiveTintColor}
      expandedHeight={TAB_BAR_HEIGHT}
      compactHeight={TAB_BAR_COMPACT_HEIGHT}
      onTabSelected={onTabSelected}
      pointerEvents="box-none"
      style={[
        styles.bar,
        {
          // En iOS UIKit ya respeta el home indicator dentro de la propia
          // barra. En Android la app va edge-to-edge desde el SDK 55, así que
          // hay que levantarla nosotros sobre la barra de gestos.
          bottom: Platform.OS === 'android' ? insets.bottom : 0,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: TAB_BAR_HEIGHT,
  },
});
