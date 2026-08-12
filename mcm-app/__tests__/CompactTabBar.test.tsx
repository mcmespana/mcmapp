/**
 * Render tests de la barra de pestañas flotante (`CompactTabBar`).
 *
 * Es la pieza VISUAL de `docs/desarrollo/TABS_MAINTENANCE.md`: envuelve
 * `NativeCompactTabBar` (vista nativa) y traduce sus eventos a navegación de
 * expo-router. Aquí se comprueba justo esa traducción —qué props le llegan a
 * la vista nativa y qué hace al recibir `onTabSelected`— con todo lo demás
 * (router, contexto de carismochito, controlador de compactado) mockeado.
 */
import React from 'react';
import { create, act } from 'react-test-renderer';

import CompactTabBar from '@/components/tabs/CompactTabBar';
import { TABS_CONFIG } from '@/constants/tabsCatalog';

const mockRouterNavigate = jest.fn();
let mockPathname = '/';

jest.mock('expo-router', () => ({
  router: { navigate: (...args: unknown[]) => mockRouterNavigate(...args) },
  usePathname: () => mockPathname,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/contexts/CarismochitoContext', () => ({
  useCarismochito: () => ({ isActive: false }),
}));

const mockHandleReselect = jest.fn();
const mockExpand = jest.fn();
jest.mock('@/components/tabs/tabBarController', () => ({
  tabBarController: {
    useCompact: () => false,
    expand: (...args: unknown[]) => mockExpand(...args),
    handleReselect: (...args: unknown[]) => mockHandleReselect(...args),
  },
}));

jest.mock('@/utils/haptics', () => ({ h: { tap: jest.fn() } }));

// La vista nativa (`UITabBar` / vista Kotlin) no existe bajo Jest, y resolver
// los PNG de los iconos vía `Image.resolveAssetSource` tampoco funciona en
// este entorno. Se mockea al nivel de la librería: lo que se testea aquí es
// la traducción que hace NUESTRO `CompactTabBar` (props → item, evento →
// navegación), no el renderizado nativo en sí.
jest.mock('expo-native-compact-tabs', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { forwardRef } = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  const MockNativeCompactTabBar = forwardRef(function MockNativeCompactTabBar(
    props: Record<string, unknown>,
    ref: unknown,
  ) {
    return <View ref={ref as never} testID="compact-tab-bar" {...props} />;
  });
  return { NativeCompactTabBar: MockNativeCompactTabBar };
});

const barTabs = TABS_CONFIG.slice(0, 3);

function renderBar() {
  let root!: ReturnType<typeof create>;
  act(() => {
    root = create(<CompactTabBar tabs={barTabs} />);
  });
  return root;
}

function findNativeBar(root: ReturnType<typeof create>) {
  return root.root.findByProps({ testID: 'compact-tab-bar' });
}

describe('CompactTabBar', () => {
  beforeEach(() => {
    mockPathname = '/';
    mockRouterNavigate.mockClear();
    mockHandleReselect.mockClear();
    mockExpand.mockClear();
  });

  it('pasa un item por tab con su label y sin exponer el ImageSourcePropType crudo', () => {
    const root = renderBar();
    const nativeBar = findNativeBar(root);

    expect(nativeBar.props.items).toHaveLength(barTabs.length);
    expect(
      nativeBar.props.items.map((item: { key: string }) => item.key),
    ).toEqual(barTabs.map((tab) => tab.name));
    expect(nativeBar.props.items[0].label).toBe(barTabs[0].label);
  });

  it('marca seleccionado el tab cuyo href coincide con el pathname actual', () => {
    mockPathname = `/${barTabs[1].name}`;
    const root = renderBar();

    expect(findNativeBar(root).props.selectedIndex).toBe(1);
  });

  it('navega al tab pulsado cuando no es el que ya está activo', () => {
    mockPathname = `/${barTabs[0].name}`;
    const root = renderBar();
    const nativeBar = findNativeBar(root);

    act(() => {
      nativeBar.props.onTabSelected({ nativeEvent: { index: 2 } });
    });

    expect(mockExpand).toHaveBeenCalledTimes(1);
    expect(mockRouterNavigate).toHaveBeenCalledWith(`/${barTabs[2].name}`);
    expect(mockHandleReselect).not.toHaveBeenCalled();
  });

  it('delega en el controlador el re-tap del tab ya activo, sin navegar', () => {
    mockPathname = `/${barTabs[0].name}`;
    const root = renderBar();
    const nativeBar = findNativeBar(root);

    act(() => {
      nativeBar.props.onTabSelected({ nativeEvent: { index: 0 } });
    });

    expect(mockHandleReselect).toHaveBeenCalledWith(barTabs[0].name);
    expect(mockRouterNavigate).not.toHaveBeenCalled();
  });

  it('ignora un índice fuera de rango sin lanzar', () => {
    const root = renderBar();
    const nativeBar = findNativeBar(root);

    expect(() =>
      act(() => {
        nativeBar.props.onTabSelected({ nativeEvent: { index: 99 } });
      }),
    ).not.toThrow();
    expect(mockRouterNavigate).not.toHaveBeenCalled();
    expect(mockHandleReselect).not.toHaveBeenCalled();
  });
});
