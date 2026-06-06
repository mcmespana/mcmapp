// app/(tabs)/_layout.tsx - Hybrid Tabs Implementation
// iOS: NativeTabs for liquid glass compatibility
// Android/Web: Traditional Tabs for better functionality
import React from 'react';
import { Platform } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';
import { StatusBar } from 'expo-status-bar';

// Import iOS-specific NativeTabs
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { MaterialIcons } from '@expo/vector-icons';

// Import Android/Web-specific Traditional Tabs
import { Tabs } from 'expo-router';
import {
  ThemeProvider,
  DarkTheme,
  DefaultTheme,
} from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { hexAlpha } from '@/utils/colorUtils';
import { HapticTab } from '@/components/HapticTab';
import { TABS_CONFIG, splitTabsForIOS } from '@/constants/tabsCatalog';
import { useCarismochito } from '@/contexts/CarismochitoContext';

/* Verdes del modo carismochito para teñir la barra de pestañas. */
const CARISMO_TABBAR_BG = '#06210F';
const CARISMO_TABBAR_ACTIVE = '#9DE86B';
const CARISMO_TABBAR_INACTIVE = '#4E8C5F';
// En iOS el tinte va sobre la barra translúcida/clara (liquid glass): usamos
// un verde más oscuro para que iconos y texto tengan buen contraste.
const CARISMO_TABBAR_TINT_IOS = '#1B9E4B';

// ============================================================================
// iOS NativeTabs Component
// ============================================================================
// iOS sólo muestra 5 tabs antes de generar un "More" automático del sistema.
// Limitamos a 5 triggers (4 prioritarios + "mas" como último) y los demás se
// muestran como tarjetas dentro de MasHomeScreen. Las rutas sin trigger siguen
// siendo navegables programáticamente (expo-router las mantiene en el state).
function IOSNativeTabsLayout() {
  const resolved = useResolvedProfileConfig();
  const visibleTabs = new Set(resolved.tabs);
  const { mainTabs } = splitTabsForIOS(visibleTabs);
  // Modo carismochito: tiñe iconos + labels de verde. NOTA: en iOS sólo
  // tocamos `tintColor`/`labelStyle` (fiables). El `backgroundColor` de la
  // barra NO es fiable en iOS 26+ (liquid glass adapta el fondo solo y lo
  // ignora — bug expo#41360), por eso el efecto de fondo verde lo da el
  // overlay (resplandor + mascota) en `CarismochitoOverlay`.
  const { isActive: carismoActive } = useCarismochito();

  return (
    <NativeTabs
      {...(carismoActive && {
        tintColor: CARISMO_TABBAR_TINT_IOS,
        labelStyle: { color: CARISMO_TABBAR_TINT_IOS },
      })}
    >
      {mainTabs.map((tab) => (
        // disablePopToTop + disableScrollToTop son CRÍTICOS: sin ellos, en
        // iOS el UITabBarController nativo llama popToRootViewController
        // sobre el UINavigationController de `createNativeStackNavigator`
        // al re-tappear el mismo tab — bypasea React Navigation y deja JS y
        // nativo desincronizados → la pantalla queda congelada. Con estas
        // props deshabilitamos el comportamiento nativo y replicamos la UX
        // (pop a la raíz al re-tap) desde JS de forma segura.
        <NativeTabs.Trigger
          key={tab.name}
          name={tab.name}
          disablePopToTop
          disableScrollToTop
        >
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={tab.iosIcon as any} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}

// ============================================================================
// Android/Web Traditional Tabs Component
// ============================================================================
function AndroidWebTabsLayout() {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? DarkTheme : DefaultTheme;
  // En web (sobre todo en PWA standalone iOS) reservamos espacio para la status bar
  // del sistema usando el safe-area-inset top. En navegador normal este valor es 0.
  const insets = useSafeAreaInsets();
  const webStatusBarHeight = Platform.OS === 'web' ? insets.top : undefined;
  // En Android (Expo 55 va edge-to-edge: la app dibuja DETRÁS de la barra de
  // navegación del sistema), hay que reservar `insets.bottom` para que la tab
  // bar no quede tapada por la barra de gestos/3 botones. En móviles que la
  // ocultan, `insets.bottom` es 0 y no cambia nada; en los que no, vale ~24-48px.
  const bottomInset = insets.bottom;
  const bottomPad =
    Platform.OS === 'web' ? Math.max(bottomInset, 12) : 8 + bottomInset;
  const resolved = useResolvedProfileConfig();
  const visibleTabs = new Set(resolved.tabs);
  // Modo carismochito: tiñe la barra de pestañas de verde mientras está activo.
  const { isActive: carismoActive } = useCarismochito();

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
            ? CARISMO_TABBAR_ACTIVE
            : Colors[scheme ?? 'light'].tint,
          tabBarInactiveTintColor: carismoActive
            ? CARISMO_TABBAR_INACTIVE
            : Colors[scheme ?? 'light'].icon,
          tabBarStyle: {
            backgroundColor: carismoActive
              ? CARISMO_TABBAR_BG
              : Colors[scheme ?? 'light'].background,
            borderTopWidth: 1,
            borderTopColor: carismoActive
              ? hexAlpha(CARISMO_TABBAR_ACTIVE, '55')
              : hexAlpha(Colors[scheme ?? 'light'].icon, '20'),
            paddingBottom: bottomPad,
            paddingTop: 12,
            height:
              Platform.OS === 'web'
                ? 60 + (insets.bottom > 0 ? insets.bottom : 0)
                : 80 + bottomInset,
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

// ============================================================================
// Main TabsLayout Component - Platform-specific rendering
// ============================================================================
export default function TabsLayout() {
  const scheme = useColorScheme();

  return (
    <>
      {Platform.OS === 'ios' ? (
        <IOSNativeTabsLayout />
      ) : (
        <AndroidWebTabsLayout />
      )}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}
