/**
 * «Este domingo» en Tu selección vacía (`SundayPlanCard`): enseña la misa
 * propuesta con el porqué (las lecturas), abre las lecturas de ESE domingo y
 * «Usar estos cantos» llena la selección en orden de misa, con «Deshacer».
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
import SundayPlanCard from '@/components/playlist/SundayPlanCard';
import type { SongsData } from '@/utils/filterSongsData';

const MOMENTS = [
  'entrada',
  'salmos',
  'aleluya',
  'ofertorio',
  'santo',
  'comunion',
  'salida',
];
const mockSongs: SongsData = Object.fromEntries(
  MOMENTS.map((key) => [
    key,
    {
      categoryTitle: key,
      songs: [
        { title: `Canto ${key}`, filename: `${key}1` },
        {
          title: `Pastor ${key}`,
          filename: `${key}Pastor`,
          content: 'El buen pastor busca sus ovejas en el monte',
        },
      ],
    },
  ]),
);

const mockReplaceAll = jest.fn();
const mockSetLink = jest.fn();
const mockToastShow = jest.fn();
const mockOpenCantoral = jest.fn();

jest.mock('@/hooks/useDailyReadings', () => ({
  useDailyReadings: () => ({
    readings: {
      evangelio: {
        texto: 'Yo soy el buen pastor; conozco a mis ovejas en el monte.',
        cita: 'Jn 10, 11-18',
      },
    },
    isLoading: false,
    error: null,
  }),
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
  useSelectedSongs: () => ({ replaceAll: mockReplaceAll }),
}));
jest.mock('@/contexts/AppToastContext', () => ({
  useToast: () => ({ toast: { show: mockToastShow } }),
}));
jest.mock('@/hooks/usePlaylistLink', () => ({
  usePlaylistLink: () => ({ link: 'ABC', setLink: mockSetLink }),
}));
jest.mock('@/utils/cantoralNavigation', () => ({
  openCantoral: (...a: unknown[]) => mockOpenCantoral(...a),
}));
jest.mock('@expo/vector-icons', () => ({ MaterialIcons: () => null }));

const INITIAL_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const onOpenReadings = jest.fn();
const Card = () => (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider initialMetrics={INITIAL_METRICS}>
      <HeroUINativeProvider>
        <SundayPlanCard onOpenReadings={onOpenReadings} />
      </HeroUINativeProvider>
    </SafeAreaProvider>
  </GestureHandlerRootView>
);

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

it('propone los cantos que encajan con las lecturas y dice por qué', async () => {
  await render(<Card />);
  await screen.findByText('Usar estos cantos');
  expect(screen.getByText('Evangelio: Jn 10, 11-18')).toBeTruthy();
  expect(screen.getByText('Pastor entrada')).toBeTruthy();
  expect(screen.queryByText('Canto entrada')).toBeNull();
  expect(screen.getAllByText(/^Por las lecturas: /).length).toBeGreaterThan(0);
});

it('«Leer las lecturas» abre las de ese domingo', async () => {
  await render(<Card />);
  fireEvent.press(await screen.findByLabelText(/Leer las lecturas/));
  expect(onOpenReadings).toHaveBeenCalledWith(
    expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
  );
});

it('«Usar estos cantos» llena la selección en orden de misa, con Deshacer', async () => {
  await render(<Card />);
  fireEvent.press(await screen.findByText('Usar estos cantos'));
  await waitFor(() => expect(mockReplaceAll).toHaveBeenCalledTimes(1));
  const songs = mockReplaceAll.mock.calls[0][0];
  expect(songs).toHaveLength(7);
  expect(songs[0].filename).toBe('entradaPastor');
  expect(mockSetLink).toHaveBeenCalledWith(null);

  const { onActionPress } = mockToastShow.mock.calls[0][0];
  onActionPress({ hide: jest.fn() });
  expect(mockReplaceAll).toHaveBeenLastCalledWith([]);
  expect(mockSetLink).toHaveBeenLastCalledWith('ABC');
});

it('tocar un canto abre la pantalla completa para cambiarlo', async () => {
  await render(<Card />);
  fireEvent.press(await screen.findByText('Pastor salida'));
  expect(mockOpenCantoral).toHaveBeenCalledWith(
    'SundaySongs',
    expect.objectContaining({ fecha: expect.any(String) }),
  );
});
