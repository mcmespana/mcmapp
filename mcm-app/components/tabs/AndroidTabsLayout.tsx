// Layout de pestañas para ANDROID.
//
// Se mantiene el navegador `Tabs` de expo-router pero con la barra OCULTA
// (`tabBar={() => null}`), y encima se dibuja `CompactTabBar` como overlay.
//
// ¿Por qué no `NativeTabs` como en iOS? Porque en Android los headers salen de
// las `options` de cada `Tabs.Screen` (title, headerColor, headerShown de
// TABS_CONFIG). Con `NativeTabs` habría que reconstruirlos pantalla a pantalla
// sin ganar nada: la barra visible ya no es la del navegador, sino la nuestra.

import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import {
  ThemeProvider,
  DarkTheme,
  DefaultTheme,
} from 'expo-router/react-navigation';

import { TABS_CONFIG } from '@/constants/tabsCatalog';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';
import { useVisibleTabs } from '@/hooks/useVisibleTabs';
import CompactTabBar from '@/components/tabs/CompactTabBar';
import type { TabConfig } from '@/constants/tabsCatalog';

interface AndroidTabsLayoutProps {
  /** Tabs que van en la barra flotante (ya recortados por splitTabsForBar). */
  barTabs: TabConfig[];
}

export default function AndroidTabsLayout({ barTabs }: AndroidTabsLayoutProps) {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const resolved = useResolvedProfileConfig();
  const visibleTabs = useVisibleTabs();

  return (
    <ThemeProvider value={theme}>
      <View style={styles.container}>
        <Tabs
          initialRouteName={resolved.defaultTab}
          // La barra del navegador desaparece: la que se ve es CompactTabBar.
          // Sigue siendo `Tabs` para conservar headers y el estado por pestaña.
          tabBar={() => null}
          screenOptions={{
            headerShown: true,
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
              fontSize: 18,
            },
            headerTitleAlign: 'center',
            // Sin barra en flujo, el navegador no debe reservar nada abajo:
            // el hueco lo ponen las pantallas con useTabBarClearance().
            sceneStyle: { paddingBottom: 0 },
            animation: 'shift',
          }}
        >
          {TABS_CONFIG.map((tab) => {
            if (!visibleTabs.has(tab.name)) return null;

            return (
              <Tabs.Screen
                key={tab.name}
                name={tab.name}
                options={{
                  title: tab.label,
                  headerShown: tab.headerShown ?? true,
                  ...(tab.headerColor && {
                    headerStyle: { backgroundColor: tab.headerColor },
                    headerTransparent: false,
                  }),
                }}
              />
            );
          })}
        </Tabs>

        <CompactTabBar tabs={barTabs} />
      </View>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
