/**
 * El recorrido del Cantoral con el router de verdad (Expo 58):
 * categorías → lista → canción → pantalla completa → (siguiente) → cerrar →
 * atrás → atrás.
 *
 * El Cantoral fue la última pestaña en dejar su navegador montado a mano
 * (`docs/planes/PLAN_EXPO_58.md`). Lo que se rompe sin enterarse al pasarlo a
 * rutas de fichero, y por eso se mira aquí:
 *
 *   · que los params de ruta sean TEXTO (una canción entera o la lista por
 *     URL no sobreviven: la letra y la lista van por `utils/songNavList`);
 *   · que el detalle encuentre la canción por `filename` y su lista;
 *   · que cerrar la pantalla completa tras pasar de canción deje el detalle en
 *     la canción a la que se llegó (`router.dismissTo`), y que «atrás» deshaga
 *     el camino pantalla a pantalla.
 */
/* eslint-disable @typescript-eslint/no-require-imports, import/first */
import fs from 'fs';
import path from 'path';
import React from 'react';
import {
  act,
  fireEvent,
  renderRouter,
  screen,
  waitFor,
} from 'expo-router/testing-library';

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
jest.mock('@gorhom/bottom-sheet', () => require('@gorhom/bottom-sheet/mock'));
// Las filas deslizables de gesture-handler 3 no arrancan con el mock de
// worklets de Jest (`sharedValue.addListener is not a function` en su
// `useJSResponderHandler`). Aquí se prueba la navegación, no el gesto: la
// fila se pinta tal cual, sin deslizar.
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const Local = require('react');
  const { View } = require('react-native');
  const Row = Local.forwardRef(
    ({ children }: { children: unknown }, _ref: unknown) =>
      Local.createElement(View, null, children),
  );
  return { __esModule: true, default: Row, SwipeDirection: {} };
});
// La hoja de la canción es un WebView: aquí basta con que monte y acepte el
// `injectJavaScript` con el que se le cambian tono y estilos.
jest.mock('react-native-webview', () => {
  const Local = require('react');
  const WebView = Local.forwardRef(
    (props: Record<string, unknown>, ref: unknown) => {
      Local.useImperativeHandle(ref, () => ({
        injectJavaScript: () => {},
        postMessage: () => {},
        reload: () => {},
      }));
      return Local.createElement('WebView', props);
    },
  );
  return { __esModule: true, WebView, default: WebView };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router, Slot, Stack } from 'expo-router';
import {
  __resetMockDb,
  __setMockNode,
  __setMockSnapshot,
} from '@/__mocks__/firebase';
import AppProviders from '@/components/AppProviders';
import { getSongNavList } from '@/utils/songNavList';

const DIR = path.join(__dirname, '..', '..', 'app', '(tabs)', 'cancionero');

function rutasCantoral(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const file of fs.readdirSync(DIR)) {
    if (!file.endsWith('.tsx')) continue;
    // El módulo entero, no solo `default`: el `_layout` lleva
    // `unstable_settings.anchor`, que es lo que pone las categorías debajo de
    // una canción abierta en frío.
    out[`(tabs)/cancionero/${file.replace(/\.tsx$/, '')}`] = require(
      path.join(DIR, file),
    );
  }
  return out;
}

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

const SONGS = {
  entrada: {
    categoryTitle: 'D. Cantos de entrada 🚪',
    songs: [
      {
        title: '1. Alzad las manos',
        filename: 'alzad.cho',
        author: 'Kairoi',
        content: '{title: Alzad las manos}\n[G]Alzad las manos',
      },
      {
        title: '2. Vienen con alegría',
        filename: 'vienen.cho',
        content: '{title: Vienen con alegría}\n[D]Vienen con alegría',
      },
    ],
  },
};

type App = Awaited<ReturnType<typeof renderRouter>>;
let app: App;
/** Los params de la ruta en la que se está, tal cual los ve la pantalla. */
const paramsActuales = () => app.getSearchParams() as Record<string, unknown>;

/**
 * Tocar algo que navega. `fireEvent.press` va en un `act` SÍNCRONO, y la cola
 * del router de expo-router 58 se vacía después: sin el `act` asíncrono la
 * navegación se queda sin aplicar y el test espera para siempre.
 */
async function tocar(el: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(el);
  });
}

beforeEach(async () => {
  await AsyncStorage.clear();
  __resetMockDb();
  __setMockSnapshot(null);
  __setMockNode('songs', { updatedAt: 1, data: SONGS });
  // El onboarding del cantoral se abre solo la primera vez y taparía la lista.
  await AsyncStorage.setItem(
    '@mcm_song_settings',
    JSON.stringify({ cantoralOnboarding: 999 }),
  );
});

it('categorías → lista → canción → pantalla completa → atrás', async () => {
  app = await renderRouter(
    {
      _layout: raiz,
      '(tabs)/_layout': () => <Stack screenOptions={{ headerShown: false }} />,
      ...rutasCantoral(),
    } as never,
    { initialUrl: '/cancionero' },
  );

  // 1. Categorías → lista de la categoría.
  await tocar(await screen.findByText(/Cantos de entrada/));
  await waitFor(() => expect(screen).toHavePathname('/cancionero/categoria'));
  expect(paramsActuales()).toMatchObject({ categoryId: 'entrada' });

  // 2. Lista → canción. Solo texto en la ruta; la lista, en memoria.
  await tocar(await screen.findByText(/Alzad las manos/));
  await waitFor(() => expect(screen).toHavePathname('/cancionero/cancion'));
  const detalle = paramsActuales();
  expect(detalle).toMatchObject({
    filename: 'alzad.cho',
    currentIndex: '0',
    source: 'category',
    firebaseCategory: 'entrada',
  });
  for (const v of Object.values(detalle)) expect(typeof v).toBe('string');
  expect(
    getSongNavList(detalle.list as string)?.map((s) => s.filename),
  ).toEqual(['alzad.cho', 'vienen.cho']);
  // El detalle ha encontrado la canción (si no, diría que no está).
  expect(screen.queryByText('No encontramos esta canción')).toBeNull();

  // 3. Pantalla completa, con el tono con el que se veía.
  await tocar(await screen.findByLabelText('Pantalla completa'));
  await waitFor(() =>
    expect(screen).toHavePathname('/cancionero/pantalla-completa'),
  );
  expect(paramsActuales()).toMatchObject({
    filename: 'alzad.cho',
    currentIndex: '0',
    transpose: '0',
  });

  // 4. Siguiente canción dentro de la pantalla completa y cerrar: el detalle
  //    se queda en la canción a la que se ha llegado.
  await tocar(await screen.findByLabelText('Canción siguiente'));
  await tocar(screen.getByLabelText('Cerrar pantalla completa'));
  await waitFor(() => expect(screen).toHavePathname('/cancionero/cancion'));
  expect(paramsActuales()).toMatchObject({
    filename: 'vienen.cho',
    currentIndex: '1',
  });

  // 5. Atrás deshace el camino: lista y categorías.
  await act(async () => router.back());
  await waitFor(() => expect(screen).toHavePathname('/cancionero/categoria'));
  await act(async () => router.back());
  await waitFor(() => expect(screen).toHavePathname('/cancionero'));
  expect(router.canGoBack()).toBe(false);
});

it('una canción abierta en frío por su ruta se lee del catálogo', async () => {
  app = await renderRouter(
    {
      _layout: raiz,
      '(tabs)/_layout': () => <Stack screenOptions={{ headerShown: false }} />,
      ...rutasCantoral(),
    } as never,
    { initialUrl: '/cancionero/cancion?filename=vienen.cho' },
  );
  expect(await screen.findByLabelText('Pantalla completa')).toBeTruthy();
  expect(screen.queryByText('No encontramos esta canción')).toBeNull();
  // Debajo, las categorías (`unstable_settings.anchor`): atrás vuelve a ellas.
  await act(async () => router.back());
  await waitFor(() => expect(screen).toHavePathname('/cancionero'));
});
