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

  return (
    <NativeTabs>
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
  const webBottomPad = Platform.OS === 'web' ? Math.max(insets.bottom, 12) : 8;
  const resolved = useResolvedProfileConfig();
  const visibleTabs = new Set(resolved.tabs);

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
          tabBarActiveTintColor: Colors[scheme ?? 'light'].tint,
          tabBarInactiveTintColor: Colors[scheme ?? 'light'].icon,
          tabBarStyle: {
            backgroundColor: Colors[scheme ?? 'light'].background,
            borderTopWidth: 1,
            borderTopColor: hexAlpha(Colors[scheme ?? 'light'].icon, '20'),
            paddingBottom: webBottomPad,
            paddingTop: 12,
            height:
              Platform.OS === 'web'
                ? 60 + (insets.bottom > 0 ? insets.bottom : 0)
                : 80,
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
