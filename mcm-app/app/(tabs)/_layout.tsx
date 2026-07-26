// app/(tabs)/_layout.tsx - Unified glass tab bar (expo-glass-tabs) for all
// platforms. Replaces the previous NativeTabs (iOS) / classic Tabs
// (Android/Web) split with a single floating, liquid-glass pill that
// minimizes on scroll everywhere.
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Tabs, TabList, TabSlot, TabTrigger } from 'expo-router/ui';
import {
  GlassTabBar,
  GlassTabButton,
  TabBarMinimizeProvider,
  renderFadingTabScreen,
  type GlassTabItem,
} from 'expo-glass-tabs';
import { SymbolView } from 'expo-symbols';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';
import { hexAlpha } from '@/utils/colorUtils';
import {
  TABS_CONFIG,
  splitTabsForIOS,
  type TabConfig,
} from '@/constants/tabsCatalog';
import { useCarismochito } from '@/contexts/CarismochitoContext';

/* Verdes del modo carismochito para teñir la píldora de pestañas. */
const CARISMO_ACTIVE_DARK = '#9DE86B';
const CARISMO_INACTIVE_DARK = '#4E8C5F';
const CARISMO_BG_DARK = '#06210F';
const CARISMO_ACTIVE_LIGHT = '#1B9E4B';
const CARISMO_INACTIVE_LIGHT = '#6FA77E';
const CARISMO_BG_LIGHT = '#FFFFFF';

const HEADER_HEIGHT = 44;

type GlassTab = GlassTabItem & { href: string };

function tabHref(name: string): string {
  return name === 'index' ? '/' : `/${name}`;
}

/** SF Symbol en iOS (a través de expo-symbols), MaterialIcons en Android/Web
 * — `expo-glass-tabs` sólo sabe pintar SF Symbols de fábrica y no existen
 * fuera de iOS. */
function toGlassItem(tab: TabConfig): GlassTab {
  return {
    name: tab.name,
    href: tabHref(tab.name),
    label: tab.label,
    renderIcon: ({ tint, size }) =>
      Platform.OS === 'ios' ? (
        <SymbolView
          name={tab.iosIcon.selected as any}
          tintColor={tint}
          size={size}
          weight="semibold"
        />
      ) : (
        <MaterialIcons name={tab.androidIcon} color={tint} size={size} />
      ),
  };
}

/** Cabecera propia por tab (color + título) — la píldora flotante es
 * headless y no ofrece header nativo como el `Tabs` clásico de antes. */
function TabTopHeader({ tab }: { tab?: TabConfig }) {
  const insets = useSafeAreaInsets();
  if (!tab || tab.headerShown === false) return null;
  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top,
          height: insets.top + HEADER_HEIGHT,
          backgroundColor: tab.headerColor ?? tab.tintColor,
        },
      ]}
    >
      <Text style={styles.headerTitle}>{tab.label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const scheme = useColorScheme();
  const router = useRouter();
  const pathname = usePathname();
  const resolved = useResolvedProfileConfig();
  const { isActive: carismoActive } = useCarismochito();
  const isDark = scheme === 'dark';

  const visibleTabs = new Set(resolved.tabs);
  // Mismo tope de 5 que antes forzaba UITabBarController — ya no es una
  // limitación nativa, pero se mantiene para que la píldora flotante no se
  // sature: el resto sigue siendo accesible como tarjetas en MasHomeScreen.
  const { mainTabs, overflowTabs } = splitTabsForIOS(visibleTabs);
  const items = React.useMemo(() => mainTabs.map(toGlassItem), [mainTabs]);

  const activeName =
    pathname === '/' ? 'index' : pathname.split('/').filter(Boolean)[0];
  const activeTab = TABS_CONFIG.find((tab) => tab.name === activeName);

  const carismoBg = isDark ? CARISMO_BG_DARK : CARISMO_BG_LIGHT;
  const carismoActiveTint = isDark ? CARISMO_ACTIVE_DARK : CARISMO_ACTIVE_LIGHT;
  const carismoInactiveTint = isDark
    ? CARISMO_INACTIVE_DARK
    : CARISMO_INACTIVE_LIGHT;

  return (
    <TabBarMinimizeProvider>
      <Tabs options={{ initialRouteName: resolved.defaultTab }}>
        <View style={styles.screenArea}>
          <TabTopHeader tab={activeTab} />
          <TabSlot style={styles.slot} renderFn={renderFadingTabScreen} />
        </View>

        <TabList asChild>
          <GlassTabBar
            onIndexSelected={(index) => {
              const target = items[index];
              if (target) router.navigate(target.href as any);
            }}
            theme={
              carismoActive
                ? {
                    activeTint: carismoActiveTint,
                    inactiveTint: carismoInactiveTint,
                    highlight: hexAlpha(carismoActiveTint, '26'),
                    glassTint: hexAlpha(carismoBg, 'B3'),
                    solidFallback: hexAlpha(carismoBg, 'F5'),
                  }
                : undefined
            }
          >
            {mainTabs.map((tab, index) => (
              <TabTrigger
                key={tab.name}
                name={tab.name}
                href={tabHref(tab.name) as any}
                asChild
              >
                <GlassTabButton item={items[index]} index={index} />
              </TabTrigger>
            ))}
          </GlassTabBar>
        </TabList>

        {/* Tabs que no caben en la píldora: sin trigger visible no quedan
            registradas como pantalla del navegador y `router.navigate`
            fallaría al intentar abrirlas desde MasHomeScreen. Este TabList
            oculto sólo las mantiene navegables. */}
        {overflowTabs.length > 0 && (
          <TabList style={styles.hidden}>
            {overflowTabs.map((tab) => (
              <TabTrigger
                key={tab.name}
                name={tab.name}
                href={tabHref(tab.name) as any}
              />
            ))}
          </TabList>
        )}
      </Tabs>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </TabBarMinimizeProvider>
  );
}

const styles = StyleSheet.create({
  screenArea: {
    flex: 1,
  },
  slot: {
    flex: 1,
  },
  header: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  hidden: {
    display: 'none',
  },
});
