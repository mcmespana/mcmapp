/**
 * Recorrido de las carpetas de ruta migradas (Expo 58): se abre CADA fichero de
 * ruta de `mas/` y `visitapapa/` con el router de verdad y se comprueba que
 * monta y que el `_layout` y los ficheros están de acuerdo.
 *
 * Lo que cubre y `tabsMountWithRouter` no: un `Stack.Screen` declarado sin
 * fichero (o un fichero sin declarar), un fragmento donde expo-router espera un
 * array de pantallas («Unknown child element passed to Stack», que en el móvil
 * revienta), y rutas que se rompen al abrirse una a una. Los avisos de
 * expo-router sobre el árbol de rutas se tratan como fallo.
 */
/* eslint-disable @typescript-eslint/no-require-imports, import/first */
import fs from 'fs';
import path from 'path';
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
jest.mock('../../styles/comunica.module.css', () => ({}));
// La hoja de Reflexiones (heroui → `@gorhom/bottom-sheet`) no cabe en el mock de
// Reanimated (`layoutState.get is not a function`): se usa el mock oficial de
// la librería. No es lo que se prueba aquí.
jest.mock('@gorhom/bottom-sheet', () => require('@gorhom/bottom-sheet/mock'));
jest.mock('react-native-webview', () => {
  const Local = require('react');
  return {
    WebView: (props: Record<string, unknown>) =>
      Local.createElement('WebView', props),
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { __resetMockDb, __setMockSnapshot } from '@/__mocks__/firebase';
import AppProviders from '@/components/AppProviders';
import { Slot, Stack } from 'expo-router';

const TABS_DIR = path.join(__dirname, '..', '..', 'app', '(tabs)');

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const raiz = () => (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider initialMetrics={METRICS}>
      <AppProviders>
        <Slot />
      </AppProviders>
    </SafeAreaProvider>
  </GestureHandlerRootView>
);

/** Todos los ficheros de ruta de una carpeta de pestaña, tal cual los lee el router. */
function rutasDe(tab: string): Record<string, unknown> {
  const dir = path.join(TABS_DIR, tab);
  const out: Record<string, unknown> = {};
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.tsx')) continue;
    const name = file.replace(/\.tsx$/, '');
    out[`(tabs)/${tab}/${name}`] = require(path.join(dir, file)).default;
  }
  return out;
}

const AVISOS_DE_RUTAS =
  /Unknown child element|extraneous|No route named|Too many screens|missing, partial/i;

let warn: jest.SpyInstance;
beforeEach(async () => {
  await AsyncStorage.clear();
  __resetMockDb();
  __setMockSnapshot(null);
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

const avisosDeRutas = () =>
  warn.mock.calls
    .map((c) => String(c[0]))
    .filter((m) => AVISOS_DE_RUTAS.test(m));

describe.each([
  ['mas', '/mas'],
  ['visitapapa', '/visitapapa'],
])('recorrido de «%s»', (tab, base) => {
  const rutas = () => ({
    _layout: raiz,
    '(tabs)/_layout': () => <Stack screenOptions={{ headerShown: false }} />,
    ...rutasDe(tab),
  });
  const slugs = Object.keys(rutasDe(tab))
    .map((k) => k.split('/').pop() as string)
    .filter((n) => n !== '_layout' && n !== 'index');

  it('arranca sin avisos de rutas', async () => {
    await renderRouter(rutas() as never, { initialUrl: base });
    await waitFor(() => expect(screen.toJSON()).not.toBeNull());
    expect(avisosDeRutas()).toEqual([]);
  });

  it.each(slugs)('abre /%s', async (slug) => {
    await renderRouter(rutas() as never, {
      initialUrl: `${base}/${slug}?eventId=visitapapa26&dia=0&act=0&url=https%3A%2F%2Fexample.com&title=Comida`,
    });
    await waitFor(() => expect(screen.toJSON()).not.toBeNull());
    expect(avisosDeRutas()).toEqual([]);
  });
});
