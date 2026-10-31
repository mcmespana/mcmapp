/**
 * Guardarraíl de la migración a Expo 58: cada pestaña con navegación propia
 * tiene que ARRANCAR dentro del router de verdad.
 *
 * ── Por qué existe ──────────────────────────────────────────────────────────
 * En expo-router 58 el estado de navegación se crea de forma global a partir
 * de las rutas de fichero: ya no se admite montar un navegador «a mano»
 * (`createNativeStackNavigator`) dentro de una pantalla. La build 60 de
 * TestFlight se cerraba al abrir con «A navigator received a missing, partial,
 * or incompatible navigation state», con `tsc`, lint y 2.209 tests en verde:
 * los tests montaban las pantallas SIN router (ver `screenSmoke.test.tsx`).
 * Este monta cada pestaña con `renderRouter`, que es el router de verdad.
 *
 * ── Cómo se usa ─────────────────────────────────────────────────────────────
 * Mientras duró la migración, una lista de PENDIENTES esperaba de cada pestaña
 * sin migrar que fallase CON ESE MENSAJE; el último fue el Cantoral. Ahora
 * todas son carpetas con `_layout` y todas tienen que arrancar. El caso de
 * control (`contigo`) sigue: demuestra que el montaje sí puede salir bien con
 * estos mocks, así que un rojo aquí es de la pestaña, no del test.
 */
/* eslint-disable @typescript-eslint/no-require-imports, import/first */
import React from 'react';
import { renderRouter, screen, waitFor } from 'expo-router/testing-library';

jest.mock('@expo/vector-icons', () => {
  const Local = require('react');
  const stub = (name: string) => {
    const C = (props: Record<string, unknown>) =>
      Local.createElement(name, props);
    C.displayName = name;
    return C;
  };
  return {
    MaterialIcons: stub('MaterialIcons'),
    Ionicons: stub('Ionicons'),
    MaterialCommunityIcons: stub('MaterialCommunityIcons'),
    FontAwesome: stub('FontAwesome'),
    Feather: stub('Feather'),
  };
});
jest.mock('@expo/vector-icons/MaterialIcons', () => {
  const Local = require('react');
  const C = (props: Record<string, unknown>) =>
    Local.createElement('MaterialIcons', props);
  C.displayName = 'MaterialIcons';
  return { __esModule: true, default: C };
});
// CSS módulo de la versión web de Comunica (lo arrastra la pantalla de Más).
jest.mock('../../styles/comunica.module.css', () => ({}));
jest.mock('react-native-webview', () => {
  const Local = require('react');
  return {
    WebView: (props: Record<string, unknown>) =>
      Local.createElement('WebView', props),
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { __resetMockDb, __setMockSnapshot } from '@/__mocks__/firebase';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppProviders from '@/components/AppProviders';
import { Slot, Stack } from 'expo-router';

/** Las cinco pestañas que montaban su propio navegador. */
const TABS = [
  'fotos',
  'calendario',
  'visitapapa',
  'mas',
  'cancionero',
] as const;
type Tab = (typeof TABS)[number];

/** Rutas de una pestaña: su carpeta (`_layout` + `index`). */
const rutasDe = (tab: Tab): Record<string, unknown> => ({
  [`(tabs)/${tab}/_layout`]: require(`../../app/(tabs)/${tab}/_layout`).default,
  [`(tabs)/${tab}/index`]: require(`../../app/(tabs)/${tab}/index`).default,
});

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

// La misma torre que `app/_layout.tsx`: gestos, safe area y providers.
const raiz = () => (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider initialMetrics={METRICS}>
      <AppProviders>
        <Slot />
      </AppProviders>
    </SafeAreaProvider>
  </GestureHandlerRootView>
);
const tabsLayout = () => <Stack screenOptions={{ headerShown: false }} />;

/** Escenario «vacía» de `screenSmoke`: primer arranque, sin caché ni datos. */
beforeEach(async () => {
  await AsyncStorage.clear();
  __resetMockDb();
  __setMockSnapshot(null);
});

async function abrir(rutas: Record<string, unknown>, url: string) {
  await renderRouter(
    { _layout: raiz, '(tabs)/_layout': tabsLayout, ...rutas } as never,
    { initialUrl: url },
  );
  // Que el árbol llegue a pintarse sin que el router lance.
  await waitFor(() => expect(screen.toJSON()).not.toBeNull());
}

describe('las pestañas arrancan con el router de verdad', () => {
  it('control: una pestaña en carpeta con _layout (contigo) arranca', async () => {
    const layout = require('../../app/(tabs)/contigo/_layout').default;
    const index = require('../../app/(tabs)/contigo/index').default;
    await abrir(
      { '(tabs)/contigo/_layout': layout, '(tabs)/contigo/index': index },
      '/contigo',
    );
  });

  it.each(TABS)('%s arranca', async (tab) => {
    await abrir(rutasDe(tab), `/${tab}`);
  });
});
