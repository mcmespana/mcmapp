/**
 * Pantallas de Contigo: que montan, y los comportamientos del pulido de octubre
 * que no se ven en la lógica pura (el botón del examen apagado con todo en
 * blanco, el aviso de «este día ya tiene examen», el guardado de oración sin
 * tiempo y los controles de selección que se anuncian como tales).
 *
 * Se montan dentro de `AppProviders`, la torre real, igual que
 * `screenSmoke.test.tsx` (ver su cabecera para el porqué).
 */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import AppProviders from '@/components/AppProviders';
import { localISO } from '@/utils/localDate';
import {
  DAY_COMPLETE_KEY,
  resetDayCompleteSession,
} from '@/utils/contigoDayComplete';
import { ContigoHabitsProvider } from '@/contexts/ContigoHabitsContext';
import { __resetMockDb, __setMockSnapshot } from '@/__mocks__/firebase';
import IndexScreen from '@/app/(tabs)/contigo/index';
import OracionScreen from '@/app/(tabs)/contigo/oracion';
import RevisionScreen from '@/app/(tabs)/contigo/revision';
import BookmarksScreen from '@/app/(tabs)/contigo/bookmarks';
import EvangelioScreen from '@/app/(tabs)/contigo/evangelio';

jest.mock('@expo/vector-icons', () => {
  const Local = jest.requireActual<typeof React>('react');
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
  const Local = jest.requireActual<typeof React>('react');
  const C = (props: Record<string, unknown>) =>
    Local.createElement('MaterialIcons', props);
  C.displayName = 'MaterialIcons';
  return { __esModule: true, default: C };
});

jest.mock('expo-router', () => {
  const Local = jest.requireActual<typeof React>('react');
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
    useLocalSearchParams: () => ({}),
    usePathname: () => '/',
    useSegments: () => [],
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
    useFocusEffect: (cb: () => void) => Local.useEffect(cb, [cb]),
    Stack: { Screen: () => null },
    Link: ({ children }: { children?: React.ReactNode }) => children ?? null,
  };
});

jest.mock('expo-router/react-navigation', () => {
  const Local = jest.requireActual<typeof React>('react');
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
  };
});

const INITIAL_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const trees: ReactTestRenderer[] = [];

afterEach(() => {
  act(() => {
    trees.splice(0).forEach((t) => t.unmount());
  });
  jest.clearAllMocks();
});

beforeEach(async () => {
  resetDayCompleteSession();
  await AsyncStorage.clear();
  __resetMockDb();
  __setMockSnapshot(null);
});

async function montar(Screen: React.ComponentType) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <SafeAreaProvider initialMetrics={INITIAL_METRICS}>
        <AppProviders>
          {/* Lo monta el `_layout` de Contigo, no `AppProviders`. */}
          <ContigoHabitsProvider>
            <Screen />
          </ContigoHabitsProvider>
        </AppProviders>
      </SafeAreaProvider>,
    );
  });
  trees.push(tree);
  return tree;
}

/** Textos que pinta el árbol, para comprobar copys sin atarse a la estructura. */
function textos(tree: ReactTestRenderer): string {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node === 'string') out.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object') {
      walk((node as { children?: unknown }).children);
    }
  };
  walk(tree.toJSON());
  return out.join(' ');
}

describe('Contigo: las pantallas montan', () => {
  it.each([
    ['Inicio', IndexScreen],
    ['Oración', OracionScreen],
    ['Examen del día', RevisionScreen],
    ['Guardados', BookmarksScreen],
    ['Evangelio', EvangelioScreen],
  ] as [string, React.ComponentType][])('%s', async (_nombre, Screen) => {
    const tree = await montar(Screen);
    expect(tree.toJSON()).not.toBeNull();
  });
});

describe('Oración', () => {
  it('sin tiempo elegido avisa junto a la acción y apaga el botón', async () => {
    const tree = await montar(OracionScreen);
    expect(textos(tree)).toContain('Elige cuánto tiempo has rezado');
    const guardar = tree.root.findAll(
      (n) =>
        n.props.accessibilityRole === 'button' &&
        n.props.accessibilityState?.disabled === true,
    );
    expect(guardar.length).toBeGreaterThan(0);
  });

  it('las cinco emociones y las seis duraciones son opciones de un grupo', async () => {
    const tree = await montar(OracionScreen);
    const opciones = tree.root.findAll(
      (n) => n.props.accessibilityRole === 'radio',
    );
    // TouchableOpacity pinta varios nodos por componente: se cuentan por etiqueta.
    const etiquetas = new Set(opciones.map((n) => n.props.accessibilityLabel));
    expect(etiquetas.size).toBe(11);
    expect(etiquetas.has('Alegría')).toBe(true);
    expect(etiquetas.has('< 2 min')).toBe(true);
    const grupos = tree.root.findAll(
      (n) => n.props.accessibilityRole === 'radiogroup',
    );
    expect(grupos.length).toBeGreaterThan(0);
  });

  it('el paso a paso de «Personalizado» arranca en la última duración y avanza de cinco en cinco', async () => {
    await AsyncStorage.setItem(
      '@contigo_habits',
      JSON.stringify({
        '2026-09-01': {
          date: '2026-09-01',
          readingDone: false,
          prayerDone: true,
          prayerDurationMinutes: 20,
          timestamp: 1,
        },
      }),
    );
    const tree = await montar(OracionScreen);
    const personalizado = tree.root.find(
      (n) =>
        n.props.accessibilityRole === 'radio' &&
        n.props.accessibilityLabel === 'Personalizado' &&
        typeof n.props.onPress === 'function',
    );
    await act(async () => {
      personalizado.props.onPress();
    });
    expect(textos(tree)).toContain('20');
    const mas = tree.root.find(
      (n) =>
        n.props.accessibilityLabel === 'Cinco minutos más' &&
        typeof n.props.onPress === 'function',
    );
    await act(async () => {
      mas.props.onPress();
    });
    expect(textos(tree)).toContain('25');
    const menos = tree.root.find(
      (n) =>
        n.props.accessibilityLabel === 'Cinco minutos menos' &&
        typeof n.props.onPress === 'function',
    );
    await act(async () => {
      menos.props.onPress();
      menos.props.onPress();
    });
    expect(textos(tree)).toContain('15');
  });
});

describe('Examen del día', () => {
  it('con todo en blanco, el botón de guardar queda apagado y dice por qué', async () => {
    const tree = await montar(RevisionScreen);
    // Paso 1 → paso 2 (último): «Continuar».
    const continuar = tree.root.find(
      (n) =>
        n.props.accessibilityRole === 'button' &&
        n.props.accessibilityLabel === 'Continuar',
    );
    await act(async () => {
      continuar.props.onPress();
    });
    expect(textos(tree)).toContain('Escribe al menos una cosa para guardar');
    const guardar = tree.root.find(
      (n) =>
        n.props.accessibilityRole === 'button' &&
        n.props.accessibilityLabel === 'Guardar revisión',
    );
    expect(guardar.props.accessibilityState.disabled).toBe(true);
  });

  it('el conmutador Lista / Texto libre es el SegmentedControl compartido', async () => {
    const tree = await montar(RevisionScreen);
    const tabs = tree.root.findAll((n) => n.props.accessibilityRole === 'tab');
    const labels = new Set(tabs.map((n) => n.props.accessibilityLabel));
    expect(labels).toEqual(new Set(['Lista', 'Texto libre']));
  });

  it('si el día ya tiene examen lo dice y el último botón pasa a «Actualizar»', async () => {
    const hoy = localISO();
    await AsyncStorage.setItem(
      '@contigo_habits',
      JSON.stringify({
        [hoy]: {
          date: hoy,
          readingDone: false,
          prayerDone: false,
          revisionDone: true,
          timestamp: 1,
        },
      }),
    );
    const tree = await montar(RevisionScreen);
    expect(textos(tree)).toContain('Ya hiciste el examen de este día');
    const continuar = tree.root.find(
      (n) =>
        n.props.accessibilityRole === 'button' &&
        n.props.accessibilityLabel === 'Continuar',
    );
    await act(async () => {
      continuar.props.onPress();
    });
    expect(
      tree.root.findAll(
        (n) => n.props.accessibilityLabel === 'Actualizar revisión',
      ).length,
    ).toBeGreaterThan(0);
  });

  it('sin examen guardado no hay aviso', async () => {
    const tree = await montar(RevisionScreen);
    expect(textos(tree)).not.toContain('Ya hiciste el examen');
  });
});

describe('Inicio', () => {
  const hoy = localISO();
  const sembrar = (hechos: {
    readingDone: boolean;
    prayerDone: boolean;
    revisionDone: boolean;
  }) =>
    AsyncStorage.setItem(
      '@contigo_habits',
      JSON.stringify({ [hoy]: { date: hoy, timestamp: 1, ...hechos } }),
    );

  it('las tarjetas de hábito dicen qué son y si están hechas', async () => {
    await sembrar({
      readingDone: true,
      prayerDone: false,
      revisionDone: false,
    });
    const tree = await montar(IndexScreen);
    const etiquetas = new Set(
      tree.root
        .findAll(
          (n) =>
            n.props.accessibilityRole === 'button' &&
            typeof n.props.accessibilityLabel === 'string',
        )
        .map((n) => n.props.accessibilityLabel as string),
    );
    expect(etiquetas.has('Evangelio, hecho hoy')).toBe(true);
    expect(etiquetas.has('Oración, pendiente')).toBe(true);
    expect(etiquetas.has('Revisión, pendiente')).toBe(true);
  });

  it('con los tres hábitos hechos celebra UNA vez al día y sin emoji en el copy', async () => {
    await sembrar({ readingDone: true, prayerDone: true, revisionDone: true });
    const tree = await montar(IndexScreen);
    expect(textos(tree)).toContain('✨');
    expect(textos(tree)).toContain('Día completo');
    expect(textos(tree)).not.toContain('🎉');
    expect(await AsyncStorage.getItem(DAY_COMPLETE_KEY)).toBe(hoy);

    // Volver a la home el mismo día no repite el momento.
    act(() => tree.unmount());
    trees.splice(0);
    const otra = await montar(IndexScreen);
    expect(textos(otra)).not.toContain('✨');
  });

  it('con dos hábitos no celebra', async () => {
    await sembrar({ readingDone: true, prayerDone: true, revisionDone: false });
    const tree = await montar(IndexScreen);
    expect(textos(tree)).not.toContain('✨');
    expect(await AsyncStorage.getItem(DAY_COMPLETE_KEY)).toBeNull();
  });
});
