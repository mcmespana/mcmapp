// Layout de pestañas para WEB.
//
// Es el layout clásico de expo-router (`Tabs`), tal cual estaba antes de que
// iOS y Android pasaran a la barra flotante nativa. En web no hay vista nativa
// que renderizar, así que aquí no cambia nada: barra opaca, en flujo, con
// headers y todos los tabs visibles del perfil (sin el tope de
// MAX_TAB_BAR_ITEMS, porque no hay problema de espacio).

import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import {
  ThemeProvider,
  DarkTheme,
  DefaultTheme,
} from 'expo-router/react-navigation';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/colors';
import { hexAlpha } from '@/utils/colorUtils';
import { HapticTab } from '@/components/HapticTab';
import { TABS_CONFIG } from '@/constants/tabsCatalog';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';
import { useVisibleTabs } from '@/hooks/useVisibleTabs';
import { useCarismochito } from '@/contexts/CarismochitoContext';

/* Modo carismochito: en claro el fondo se queda blanco y sólo se tiñen los
   iconos; en oscuro se usa el verde casi negro. */
const CARISMO_BG_DARK = '#06210F';
const CARISMO_ACTIVE_DARK = '#9DE86B';
const CARISMO_INACTIVE_DARK = '#4E8C5F';
const CARISMO_BG_LIGHT = '#FFFFFF';
const CARISMO_ACTIVE_LIGHT = '#1B9E4B';
const CARISMO_INACTIVE_LIGHT = '#6FA77E';

export default function WebTabsLayout() {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? DarkTheme : DefaultTheme;
  // En PWA standalone de iOS reservamos espacio para la status bar del sistema
  // con el safe-area-inset top. En navegador normal vale 0.
  const insets = useSafeAreaInsets();
  const webStatusBarHeight = Platform.OS === 'web' ? insets.top : undefined;
  const bottomPad = Math.max(insets.bottom, 12);
  const resolved = useResolvedProfileConfig();
  const visibleTabs = useVisibleTabs();
  const { isActive: carismoActive } = useCarismochito();
  const isDark = scheme === 'dark';

  const carismoBg = isDark ? CARISMO_BG_DARK : CARISMO_BG_LIGHT;
  const carismoActiveTint = isDark ? CARISMO_ACTIVE_DARK : CARISMO_ACTIVE_LIGHT;
  const carismoInactiveTint = isDark
    ? CARISMO_INACTIVE_DARK
    : CARISMO_INACTIVE_LIGHT;

  return (
    <ThemeProvider value={theme}>
      <Tabs
        initialRouteName={resolved.defaultTab}
        screenOptions={{
          headerShown: true,
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
            fontSize: 18,
          },
          headerTitleAlign: 'center',
          headerStatusBarHeight: webStatusBarHeight,
          tabBarActiveTintColor: carismoActive
            ? carismoActiveTint
            : Colors[scheme ?? 'light'].tint,
          tabBarInactiveTintColor: carismoActive
            ? carismoInactiveTint
            : Colors[scheme ?? 'light'].icon,
          tabBarStyle: {
            backgroundColor: carismoActive
              ? carismoBg
              : Colors[scheme ?? 'light'].background,
            borderTopWidth: 1,
            borderTopColor: carismoActive
              ? hexAlpha(carismoActiveTint, '55')
              : hexAlpha(Colors[scheme ?? 'light'].icon, '20'),
            paddingBottom: bottomPad,
            paddingTop: 12,
            height: 60 + (insets.bottom > 0 ? insets.bottom : 0),
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 3,
          },
          tabBarButton: HapticTab,
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
                tabBarIcon: ({ color, size }) => (
                  <MaterialIcons
                    name={tab.androidIcon}
                    color={color}
                    size={size}
                  />
                ),
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
    </ThemeProvider>
  );
}
