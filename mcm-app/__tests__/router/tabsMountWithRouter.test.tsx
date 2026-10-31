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
 * `PENDIENTES` son las pestañas que aún montan un navegador a mano: de ellas
 * se espera que fallen CON ESE MENSAJE (no con otro: un fallo por un mock que
 * falta no cuenta). Al migrar una pestaña deja de fallar y su caso se pone
 * rojo: obliga a quitarla de la lista, que así solo puede encogerse. El caso
 * de control (`contigo`, que ya es carpeta con `_layout`) demuestra que el
 * montaje sí puede salir bien: sin él, «falla» no probaría nada.
 */
/* eslint-disable react/display-name, @typescript-eslint/no-require-imports, import/first */
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

/** Las que todavía lo hacen (se vacía al migrar, ver arriba). */
const PENDIENTES: readonly Tab[] = [
  'fotos',
  'calendario',
  'visitapapa',
  'mas',
  'cancionero',
];

const NAV_STATE_ERROR = /missing, partial, or incompatible navigation state/;

const loadTab = (tab: Tab) => require(`../../app/(tabs)/${tab}`).default;

const raiz = () => (
  <AppProviders>
    <Slot />
  </AppProviders>
);
const tabsLayout = () => <Stack screenOptions={{ headerShown: false }} />;

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

  for (const tab of TABS) {
    if (PENDIENTES.includes(tab)) {
      it(`${tab}: PENDIENTE, todavía monta un navegador a mano`, async () => {
        await expect(
          abrir({ [`(tabs)/${tab}`]: loadTab(tab) }, `/${tab}`),
        ).rejects.toThrow(NAV_STATE_ERROR);
      });
    } else {
      it(`${tab} arranca`, async () => {
        await abrir({ [`(tabs)/${tab}`]: loadTab(tab) }, `/${tab}`);
      });
    }
  }
});
