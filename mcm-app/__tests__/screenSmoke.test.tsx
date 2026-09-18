/**
 * Red de humo: que cada pantalla MONTE sin reventar.
 *
 * ── Por qué existe ──────────────────────────────────────────────────────────
 * El 2026-09-09, con `tsc` limpio, el lint limpio y **1.600 tests en verde**,
 * la app tenía dos pantallas que petaban al montar en CUALQUIER plataforma
 * (Notificaciones y Reflexiones: faltaba la peer dependency
 * `@gorhom/bottom-sheet` y el `BottomSheet.Content` de heroui valía
 * `undefined`), todas las hojas rotas en web (`useAnimatedValue` no existe en
 * `react-native-web`) y una categoría del cantoral que se caía por una canción
 * sin `filename`. Los tres se encontraron ABRIENDO LA APP, no revisando
 * código, y la build de tienda estaba a punto de salir con ellos dentro.
 *
 * Los tres eran "el componente no existe" o "la propiedad no está": fallos que
 * un render de tres líneas caza y que ningún test de lógica pura ve nunca.
 * Esto es esa red. No comprueba que una pantalla esté BIEN —para eso están los
 * tests de comportamiento—, comprueba que existe y arranca, que es el suelo
 * por debajo del cual no se publica.
 *
 * ── Cómo está montado ───────────────────────────────────────────────────────
 * Las pantallas se montan dentro de `AppProviders`, la torre de providers de
 * verdad (la misma que usa `app/_layout.tsx`), porque la mitad de estos fallos
 * solo aparecen cuando el árbol real está puesto: el de heroui se disparaba
 * dentro de un `PressableFeedback`, que necesita su provider.
 *
 * A propósito **no** se envuelve en `ErrorBoundary`: es el de la app el que se
 * tragaba estos errores y los convertía en una pantalla de "Algo ha ido mal"
 * en vez de un test rojo.
 *
 * Tres escenarios por pantalla, que son los tres estados en los que la gente
 * la abre de verdad:
 *   · **vacía**   — sin caché y sin datos remotos (primer arranque)
 *   · **con datos** — caché local poblada (el caso normal)
 *   · **offline**  — la red falla; debe seguir montando con lo que haya
 *
 * ── Si esto te sale en rojo ─────────────────────────────────────────────────
 * No lo silencies añadiendo la pantalla a una lista de excepciones: es
 * literalmente el caso que se quería cazar. El mensaje trae la pantalla, el
 * escenario y el error.
 */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AppProviders from '@/components/AppProviders';
import {
  __resetMockDb,
  __setMockNode,
  __setMockSnapshot,
  get as firebaseGet,
} from '@/__mocks__/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Mocks de lo que no se puede montar en Node ──────────────────────────────

// Los iconos cargan su fuente en asíncrono y siguen resolviendo después de que
// Jest desmonte el entorno: ruido puro para lo único que se comprueba aquí.
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

jest.mock('react-native-webview', () => {
  const Local = require('react');
  return {
    WebView: (props: Record<string, unknown>) =>
      Local.createElement('WebView', props),
  };
});

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({}),
  usePathname: () => '/',
  useSegments: () => [],
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  Link: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

jest.mock('expo-router/react-navigation', () => {
  const Local = require('react');
  const Screen = () => null;
  const Navigator = ({ children }: { children?: React.ReactNode }) =>
    Local.createElement('Navigator', null, children);
  return {
    useRoute: () => ({ key: 'test', name: 'test', params: {} }),
    useHeaderHeight: () => 96,
    useNavigation: () => ({
      navigate: jest.fn(),
      setOptions: jest.fn(),
      goBack: jest.fn(),
      addListener: jest.fn(() => jest.fn()),
      canGoBack: () => false,
    }),
    useFocusEffect: (cb: () => void) => Local.useEffect(cb, [cb]),
    useIsFocused: () => true,
    createNativeStackNavigator: () => ({ Navigator, Screen }),
  };
});

// ── Las pantallas ───────────────────────────────────────────────────────────
//
// Se importan DESPUÉS de los mocks (Jest los eleva, pero el orden deja claro
// de qué depende cada cosa). Son las pantallas de contenido: las que la gente
// abre y las que han dado guerra. Las rutas de `app/(tabs)/*` son navegadores
// de expo-router, no pantallas, y montarlas aquí probaría el router y no el
// código de la casa.
import AppsScreen from '@/app/screens/AppsScreen';
import CategoriesScreen from '@/app/screens/CategoriesScreen';
import ContactosScreen from '@/app/screens/ContactosScreen';
import EventosPasadosScreen from '@/app/screens/EventosPasadosScreen';
import GruposScreen from '@/app/screens/GruposScreen';
import HorarioScreen from '@/app/screens/HorarioScreen';
import MasHomeScreen from '@/app/screens/MasHomeScreen';
import MaterialesScreen from '@/app/screens/MaterialesScreen';
import ProfundizaScreen from '@/app/screens/ProfundizaScreen';
import ReflexionesScreen from '@/app/screens/ReflexionesScreen';
import SelectedSongsScreen from '@/app/screens/SelectedSongsScreen';
import SongListScreen from '@/app/screens/SongListScreen';
import VisitasScreen from '@/app/screens/VisitasScreen';
import NotificationsScreen from '@/app/notifications';

const INITIAL_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Datos de caché con la forma real de cada nodo, para el escenario "con datos". */
const CACHE = {
  songs: {
    'C. Entrada': {
      categoryTitle: 'C. Entrada',
      songs: [
        {
          title: 'Vienen con alegría',
          filename: 'vienen_01.html',
          author: 'C. Gabaráin',
          key: 'D',
          content: '{title: Vienen con alegría}\n[D]Vienen con alegría',
        },
      ],
    },
  },
  'jubileo/grupos': [{ nombre: 'Grupo 1', miembros: ['Ana', 'Luis'] }],
  'jubileo/horario': [{ dia: 'Lunes', actividades: [] }],
  'jubileo/materiales': [{ titulo: 'Material', contenido: '[b]Hola[/b]' }],
  'jubileo/profundiza': [{ titulo: 'Tema', contenido: 'Texto' }],
  'jubileo/contactos': [{ nombre: 'Contacto', telefono: '600000000' }],
  'jubileo/visitas': [{ titulo: 'Visita', fecha: '2026-09-10' }],
  'jubileo/compartiendo': {},
} as const;

const PANTALLAS: [string, React.ComponentType<any>][] = [
  ['Cantoral (categorías)', CategoriesScreen],
  ['Más', MasHomeScreen],
  ['Reflexiones', ReflexionesScreen],
  ['Grupos', GruposScreen],
  ['Horario', HorarioScreen],
  ['Materiales', MaterialesScreen],
  ['Profundiza', ProfundizaScreen],
  ['Contactos', ContactosScreen],
  ['Visitas', VisitasScreen],
  ['Apps', AppsScreen],
  ['Eventos pasados', EventosPasadosScreen],
  // Las dos que petaban al montar el 2026-09-09, por si hacía falta decir a
  // qué viene todo esto.
  ['Notificaciones', NotificationsScreen],
  ['Cantoral (canciones)', SongListScreen],
  ['Tu selección', SelectedSongsScreen],
];

type Escenario = 'vacía' | 'con datos' | 'offline';

const trees: ReactTestRenderer[] = [];

afterEach(() => {
  act(() => {
    trees.splice(0).forEach((t) => t.unmount());
  });
  jest.clearAllMocks();
});

async function prepararDatos(escenario: Escenario) {
  await AsyncStorage.clear();
  __resetMockDb();

  if (escenario === 'vacía') {
    // Snapshot que NO existe: es lo que ve la app en un primer arranque.
    __setMockSnapshot(null);
  }

  if (escenario === 'offline') {
    firebaseGet.mockImplementation(() =>
      Promise.reject(new Error('Network error')),
    );
  }

  if (escenario === 'con datos') {
    __setMockSnapshot(null);
    for (const [path, data] of Object.entries(CACHE)) {
      // La caché que lee `useFirebaseData` antes de salir a la red.
      await AsyncStorage.setItem(`${path}_data`, JSON.stringify(data));
      await AsyncStorage.setItem(`${path}_updatedAt`, '1');
      __setMockNode(path, { updatedAt: '1', data });
    }
  }
}

/**
 * Doble de las props que React Navigation inyecta a una pantalla. Varias las
 * reciben por PROPS y no por hook (`CategoriesScreen` llama a
 * `navigation.setOptions` para poner sus bar items), así que sin esto el
 * montaje se cae por algo que no es un fallo de la pantalla.
 */
const NAV_PROPS = {
  navigation: {
    navigate: jest.fn(),
    push: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
    canGoBack: () => false,
    setParams: jest.fn(),
  },
  route: {
    key: 'test',
    name: 'test',
    // `SongListScreen` saca de aquí la categoría que tiene que pintar.
    params: { categoryId: 'C. Entrada', categoryName: 'C. Entrada' },
  },
};

async function montar(Screen: React.ComponentType<any>) {
  let tree!: ReactTestRenderer;
  // `act` asíncrono porque los providers cargan de AsyncStorage y hacen su
  // setState al resolver: sin esperarlo, React avisa de updates fuera de act.
  await act(async () => {
    tree = create(
      <SafeAreaProvider initialMetrics={INITIAL_METRICS}>
        <AppProviders>
          <Screen {...NAV_PROPS} />
        </AppProviders>
      </SafeAreaProvider>,
    );
  });
  trees.push(tree);
  return tree;
}

describe('humo: todas las pantallas montan', () => {
  describe.each<Escenario>(['vacía', 'con datos', 'offline'])(
    'con la app %s',
    (escenario) => {
      beforeEach(async () => {
        await prepararDatos(escenario);
      });

      it.each(PANTALLAS)('%s', async (_nombre, Screen) => {
        const tree = await montar(Screen);
        // Que haya montado Y que haya pintado algo: un `null` silencioso es
        // tan malo como un throw y no lo veríamos de otra forma.
        expect(tree.toJSON()).not.toBeNull();
      });
    },
  );
});
