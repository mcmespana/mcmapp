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

import { useCallback, useMemo, useState } from 'react';
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
import { useUserProfile } from '@/contexts/UserProfileContext';
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

/**
 * Nonce que cambia UNA vez, justo al terminar el onboarding, para remontar la
 * barra nativa y obligarla a rehacer su layout.
 *
 * **Por qué hace falta.** El onboarding se presenta como `fullScreenModal`, y
 * mientras está encima iOS saca de la ventana la vista que queda debajo. La
 * barra nativa calcula su posición vertical leyendo
 * `window.safeAreaInsets.bottom` (`ExpoNativeCompactTabsView.swift`,
 * `resolvedTabFrame`), así que si le toca hacer layout sin ventana se coloca
 * como si el móvil no tuviera home indicator. Al cerrarse el onboarding no
 * cambia ningún tamaño, así que UIKit no vuelve a llamar a `layoutSubviews` y
 * la barra se queda mal —con las etiquetas cortadas por abajo— hasta que se
 * reinicia la app.
 *
 * **Por qué solo pasa viniendo del onboarding.** Con el onboarding ya hecho, el
 * perfil llega mientras la app todavía está cargando y nunca hay un modal a
 * pantalla completa por encima de los tabs, así que la barra hace su layout con
 * ventana desde el principio. Por eso la condición es exactamente esa: que el
 * perfil aparezca DESPUÉS de que la carga haya terminado.
 *
 * Es un apaño en JS de un fallo que está en el nativo de la librería
 * (`expo-native-compact-tabs@0.2.0`, sin versión más nueva). Arreglarlo de
 * verdad pide parchear el Swift, y eso son build de tienda y `[skip-ota]`.
 */
function useRelayoutAfterOnboarding(): number {
  const { profile, loading } = useUserProfile();
  const hasProfile = profile.profileType !== null;

  const [seen, setSeen] = useState({ loading, hasProfile, nonce: 0 });
  if (seen.loading !== loading || seen.hasProfile !== hasProfile) {
    // Solo cuenta si la carga YA había terminado y no había perfil: eso es
    // justo "el usuario acaba de completar el onboarding". En un arranque en
    // frío el perfil aparece con `loading` todavía a true, así que no dispara.
    const completedNow =
      !loading && !seen.loading && hasProfile && !seen.hasProfile;
    setSeen({
      loading,
      hasProfile,
      nonce: seen.nonce + (completedNow ? 1 : 0),
    });
  }

  return seen.nonce;
}

export default function CompactTabBar({ tabs }: CompactTabBarProps) {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const { isActive: carismoActive } = useCarismochito();
  const compact = tabBarController.useCompact();
  const relayoutNonce = useRelayoutAfterOnboarding();

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
        // Re-tap del tab activo. Primero se deja que el stack del tab vuelva a
        // su pantalla raíz (cantoral, más y visitapapa se suscriben con
        // `useTabReselect`); si no había nada que cerrar, sube el scroll. Es la
        // UX de siempre de iOS, que antes daba el evento `tabPress` del
        // navegador — con la barra del sistema oculta ese evento ya no existe.
        tabBarController.handleReselect(tab.name);
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
      // Ver `useRelayoutAfterOnboarding`: remonta la barra al salir del
      // onboarding para que rehaga su layout ya con ventana.
      key={relayoutNonce}
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
