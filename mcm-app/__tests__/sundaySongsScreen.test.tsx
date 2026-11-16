/**
 * La pantalla «Cantos para el domingo»: «Pasar a Tu selección» REEMPLAZA la
 * selección con la misa en orden de misa, deja el «Deshacer» de 10 s y abre
 * Tu selección.
 */
import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { HeroUINativeProvider } from 'heroui-native';
import SundaySongsScreen from '@/app/screens/SundaySongsScreen';
import type { SongsData } from '@/utils/filterSongsData';

const mockSongs: SongsData = Object.fromEntries(
  [
    'entrada',
    'salmos',
    'aleluya',
    'ofertorio',
    'santo',
    'comunion',
    'salida',
  ].map((key) => [
    key,
    {
      categoryTitle: key,
      songs: [{ title: `Canto ${key}`, filename: `${key}1` }],
    },
  ]),
);

const mockReplaceAll = jest.fn();
const mockToastShow = jest.fn();
const mockOpenCantoral = jest.fn();
const mockPrev = [{ filename: 'vieja', transpose: 0, order: 0, addedAt: 1 }];

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ fecha: '2026-11-22' }),
}));
jest.mock('@/hooks/useFirebaseData', () => ({
  useFirebaseData: (path: string) => ({
    data: path === 'songs' ? mockSongs : null,
    loading: false,
    offline: false,
    refresh: jest.fn(),
  }),
}));
jest.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({
    settings: { hideHiddenTagSongs: false, notation: 'english' },
  }),
}));
jest.mock('@/contexts/SelectedSongsContext', () => ({
  useSelectedSongs: () => ({
    selectedSongs: mockPrev,
    replaceAll: mockReplaceAll,
    isSongSelected: () => false,
    getSelectedSong: () => undefined,
    addSong: jest.fn(),
    removeSong: jest.fn(),
  }),
}));
jest.mock('@/contexts/AppToastContext', () => ({
  useToast: () => ({ toast: { show: mockToastShow } }),
}));
// El esqueleto de carga usa heroui (necesita su provider): aquí no importa.
jest.mock('@/components/ListSkeleton', () => () => null);
jest.mock('@/hooks/useMyChoir', () => ({
  useMyChoir: () => ({ choir: null, isHydrated: true }),
}));
jest.mock('@/hooks/usePlaylistLink', () => ({
  usePlaylistLink: () => ({ link: null, setLink: jest.fn() }),
}));
jest.mock('@/components/tabs/useTabScroll', () => ({
  useTabListScroll: () => ({
    listRef: { current: null },
    onScroll: undefined,
    contentPaddingBottom: 0,
  }),
}));
jest.mock('@/utils/cantoralNavigation', () => ({
  openCantoral: (...a: unknown[]) => mockOpenCantoral(...a),
}));

const INITIAL_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

// Sin el provider de heroui, sus animaciones leen un global que no existe.
const Screen = () => (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider initialMetrics={INITIAL_METRICS}>
      <HeroUINativeProvider>
        <SundaySongsScreen />
      </HeroUINativeProvider>
    </SafeAreaProvider>
  </GestureHandlerRootView>
);

jest.mock('@expo/vector-icons', () => ({ MaterialIcons: () => null }));

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

it('«Pasar a Tu selección» reemplaza la selección en orden de misa, con Deshacer', async () => {
  await render(<Screen />);
  const button = await screen.findByText('Pasar a Tu selección');
  expect(screen.getByText('Domingo 22 de noviembre')).toBeTruthy();

  await fireEvent.press(button);

  expect(mockReplaceAll).toHaveBeenCalledTimes(1);
  const songs = mockReplaceAll.mock.calls[0][0];
  expect(songs.map((s: { filename: string }) => s.filename)).toEqual([
    'entrada1',
    'salmos1',
    'aleluya1',
    'ofertorio1',
    'santo1',
    'comunion1',
    'salida1',
  ]);
  expect(mockToastShow).toHaveBeenCalledWith(
    expect.objectContaining({ actionLabel: 'Deshacer', duration: 10_000 }),
  );
  expect(mockOpenCantoral).toHaveBeenCalledWith('SelectedSongs');

  // Deshacer devuelve la selección anterior.
  const { onActionPress } = mockToastShow.mock.calls[0][0];
  onActionPress({ hide: jest.fn() });
  expect(mockReplaceAll).toHaveBeenLastCalledWith(mockPrev);
});

it('quitar un momento lo deja fuera de lo que se pasa', async () => {
  await render(<Screen />);
  await screen.findByText('Pasar a Tu selección');
  await fireEvent.press(screen.getByLabelText('Más opciones de salida'));
  await fireEvent.press(await screen.findByText('Quitar de la misa'));
  await waitFor(() =>
    expect(screen.getByText('Sin canto de salida')).toBeTruthy(),
  );
  await fireEvent.press(screen.getByText('Pasar a Tu selección'));
  const songs = mockReplaceAll.mock.calls[0][0];
  expect(songs).toHaveLength(6);
});
