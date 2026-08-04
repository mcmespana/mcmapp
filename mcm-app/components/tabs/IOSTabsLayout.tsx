// Layout de pestañas para iOS.
//
// Se sigue usando `NativeTabs` como navegador —mantiene el UITabBarController
// nativo, con su gestión de stacks por pestaña— pero con la barra del sistema
// OCULTA (`hidden` + `minimizeBehavior="never"`), porque la que se ve es
// `CompactTabBar`. `minimizeBehavior="never"` es importante: sin él iOS 26
// intentaría minimizar por su cuenta una barra que ni siquiera se muestra.

import { View, StyleSheet } from 'react-native';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import type { TabConfig } from '@/constants/tabsCatalog';
import CompactTabBar from '@/components/tabs/CompactTabBar';

interface IOSTabsLayoutProps {
  /** Tabs que van en la barra flotante (ya recortados por splitTabsForBar). */
  barTabs: TabConfig[];
}

export default function IOSTabsLayout({ barTabs }: IOSTabsLayoutProps) {
  return (
    <View style={styles.container}>
      <NativeTabs hidden minimizeBehavior="never">
        {barTabs.map((tab) => (
          // disablePopToTop + disableScrollToTop son CRÍTICOS: sin ellos, al
          // re-tapear el mismo tab iOS llama popToRootViewController sobre el
          // UINavigationController nativo, bypaseando React Navigation y
          // dejando JS y nativo desincronizados → pantalla congelada. La UX de
          // re-tap (scroll arriba) la replica CompactTabBar desde JS.
          <NativeTabs.Trigger
            key={tab.name}
            name={tab.name}
            disablePopToTop
            disableScrollToTop
          >
            <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon sf={tab.iosIcon.default as never} />
          </NativeTabs.Trigger>
        ))}
      </NativeTabs>

      <CompactTabBar tabs={barTabs} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
