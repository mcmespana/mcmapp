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
// Modo OSCURO: fondo verde casi negro + verdes claros para contraste.
const CARISMO_TABBAR_BG = '#06210F';
const CARISMO_TABBAR_ACTIVE = '#9DE86B';
const CARISMO_TABBAR_INACTIVE = '#4E8C5F';
// Modo CLARO: el fondo se queda blanco (como el tema claro normal) y sólo se
// tiñen los iconos de verde — un verde vivo para el activo y uno apagado para
// los inactivos, ambos con buen contraste sobre blanco.
const CARISMO_TABBAR_BG_LIGHT = '#FFFFFF';
const CARISMO_TABBAR_ACTIVE_LIGHT = '#1B9E4B';
const CARISMO_TABBAR_INACTIVE_LIGHT = '#6FA77E';
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
    // En iOS ≤18 la barra nativa se vuelve TRANSPARENTE al llegar al final del
    // scroll o cuando el contenido es una View estática (no scrollea por
    // debajo). Eso dejaba los iconos flotando sobre el contenido y casi
    // ilegibles. `disableTransparentOnScrollEdge` desactiva ese comportamiento
    // (mantiene el fondo en el borde) y `blurEffect="systemChromeMaterial"` le
    // da el material translúcido del tab bar nativo, adaptado al tema. En
    // iOS 26+ el sistema usa liquid glass y ambos se ignoran (ahí ya se veía
    // bien).
    <NativeTabs
      disableTransparentOnScrollEdge
      blurEffect="systemChromeMaterial"
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
  // En modo CLARO el fondo se mantiene blanco y sólo se tiñen los iconos; en
  // OSCURO usamos el fondo verde casi negro. Antes el fondo verde oscuro se
  // aplicaba siempre y en claro parecía estar en modo oscuro.
  const { isActive: carismoActive } = useCarismochito();
  const isDark = scheme === 'dark';
  const carismoBg = isDark ? CARISMO_TABBAR_BG : CARISMO_TABBAR_BG_LIGHT;
  const carismoActiveTint = isDark
    ? CARISMO_TABBAR_ACTIVE
    : CARISMO_TABBAR_ACTIVE_LIGHT;
  const carismoInactiveTint = isDark
    ? CARISMO_TABBAR_INACTIVE
    : CARISMO_TABBAR_INACTIVE_LIGHT;

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
