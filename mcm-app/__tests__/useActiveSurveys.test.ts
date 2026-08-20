/**
 * Tests de `useActiveSurveys`: qué encuestas genéricas se ofrecen AHORA en
 * un sitio concreto (Home, hub de evento, Ajustes). El filtrado real
 * (placement/audiencia/ventana/ya-respondida) ya está cubierto en
 * `surveys.test.ts` (`filterActiveSurveys`); aquí se testea solo la
 * orquestación: que el índice se normalice, que los flags "ya respondida"
 * se lean de AsyncStorage al enfocar la pantalla, y que se combinen bien
 * con el placement/evento pedido.
 *
 * `useFocusEffect` se mockea como un `useEffect` de toda la vida — no hace
 * falta un NavigationContainer real para probar "qué pasa cuando la
 * pantalla gana el foco", que aquí equivale a "al montar".
 */
import { renderHook, waitFor } from '@testing-library/react-native';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';
import { useActiveSurveys } from '@/hooks/useActiveSurveys';

jest.mock('@/hooks/useFirebaseData', () => ({
  useFirebaseData: jest.fn(),
}));
jest.mock('@/contexts/UserProfileContext', () => ({
  useUserProfile: jest.fn(),
}));
jest.mock('@/hooks/useResolvedProfileConfig', () => ({
  useResolvedProfileConfig: jest.fn(),
}));
jest.mock('expo-router/react-navigation', () => ({
  useFocusEffect: (effect: () => void | (() => void)) =>
    require('react').useEffect(effect, []),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { multiGet: jest.fn(() => Promise.resolve([])) },
}));

const AsyncStorage = require('@react-native-async-storage/async-storage').default;

const entry = (overrides: Partial<any> = {}) => ({
  id: 'encuesta-1',
  title: 'Encuesta',
  status: 'open',
  placement: { type: 'home-banner' },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  (useUserProfile as jest.Mock).mockReturnValue({
    profile: { profileType: 'miembro', delegationId: null },
  });
  (useResolvedProfileConfig as jest.Mock).mockReturnValue({
    notificationTopics: [],
  });
  (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([]);
});

describe('normalización del índice', () => {
  it('acepta el índice como array', async () => {
    (useFirebaseData as jest.Mock).mockReturnValue({ data: [entry()] });
    const { result } = await renderHook(() =>
      useActiveSurveys('home-banner'),
    );
    await waitFor(() => expect(result.current).toHaveLength(1));
  });

  it('acepta el índice como mapa (objeto)', async () => {
    (useFirebaseData as jest.Mock).mockReturnValue({
      data: { 'encuesta-1': entry() },
    });
    const { result } = await renderHook(() =>
      useActiveSurveys('home-banner'),
    );
    await waitFor(() => expect(result.current).toHaveLength(1));
  });

  it('sin datos (null) devuelve una lista vacía sin reventar', async () => {
    (useFirebaseData as jest.Mock).mockReturnValue({ data: null });
    const { result } = await renderHook(() =>
      useActiveSurveys('home-banner'),
    );
    expect(result.current).toEqual([]);
  });
});

describe('filtrado por placement', () => {
  it('solo devuelve las del placement pedido', async () => {
    (useFirebaseData as jest.Mock).mockReturnValue({
      data: [
        entry({ id: 'home', placement: { type: 'home-banner' } }),
        entry({ id: 'settings', placement: { type: 'app-settings' } }),
      ],
    });
    const { result } = await renderHook(() =>
      useActiveSurveys('home-banner'),
    );
    await waitFor(() => expect(result.current.map((e) => e.id)).toEqual(['home']));
  });

  it('event-banner además exige que el eventId coincida', async () => {
    (useFirebaseData as jest.Mock).mockReturnValue({
      data: [
        entry({
          id: 'jubileo',
          placement: { type: 'event-banner', eventId: 'jubileo2025' },
        }),
        entry({
          id: 'otro-evento',
          placement: { type: 'event-banner', eventId: 'otro' },
        }),
      ],
    });
    const { result } = await renderHook(() =>
      useActiveSurveys('event-banner', 'jubileo2025'),
    );
    await waitFor(() =>
      expect(result.current.map((e) => e.id)).toEqual(['jubileo']),
    );
  });
});

describe('audiencia (perfil/delegación/topics del usuario)', () => {
  it('respeta el profileType resuelto', async () => {
    (useUserProfile as jest.Mock).mockReturnValue({
      profile: { profileType: 'familia', delegationId: null },
    });
    (useFirebaseData as jest.Mock).mockReturnValue({
      data: [entry({ audience: { profileTypes: ['monitor'] } })],
    });
    const { result } = await renderHook(() =>
      useActiveSurveys('home-banner'),
    );
    expect(result.current).toEqual([]);
  });

  it('respeta los notificationTopics resueltos', async () => {
    (useResolvedProfileConfig as jest.Mock).mockReturnValue({
      notificationTopics: ['monitores'],
    });
    (useFirebaseData as jest.Mock).mockReturnValue({
      data: [entry({ audience: { topics: ['monitores'] } })],
    });
    const { result } = await renderHook(() =>
      useActiveSurveys('home-banner'),
    );
    await waitFor(() => expect(result.current).toHaveLength(1));
  });
});

describe('encuestas ya respondidas (AsyncStorage)', () => {
  it('las excluye si su flag `survey_done_<id>` está a "1"', async () => {
    (useFirebaseData as jest.Mock).mockReturnValue({
      data: [entry({ id: 'encuesta-1' })],
    });
    (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
      ['survey_done_encuesta-1', '1'],
    ]);
    const { result } = await renderHook(() =>
      useActiveSurveys('home-banner'),
    );
    await waitFor(() => expect(AsyncStorage.multiGet).toHaveBeenCalled());
    expect(result.current).toEqual([]);
  });

  it('un valor distinto de "1" no cuenta como respondida', async () => {
    (useFirebaseData as jest.Mock).mockReturnValue({
      data: [entry({ id: 'encuesta-1' })],
    });
    (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
      ['survey_done_encuesta-1', null],
    ]);
    const { result } = await renderHook(() =>
      useActiveSurveys('home-banner'),
    );
    await waitFor(() => expect(result.current).toHaveLength(1));
  });

  it('sin ninguna entrada, ni siquiera llama a multiGet', async () => {
    (useFirebaseData as jest.Mock).mockReturnValue({ data: [] });
    await renderHook(() => useActiveSurveys('home-banner'));
    expect(AsyncStorage.multiGet).not.toHaveBeenCalled();
  });

  it('si multiGet falla, no revienta y no excluye nada por error', async () => {
    (useFirebaseData as jest.Mock).mockReturnValue({
      data: [entry({ id: 'encuesta-1' })],
    });
    (AsyncStorage.multiGet as jest.Mock).mockRejectedValue(new Error('boom'));
    const { result } = await renderHook(() =>
      useActiveSurveys('home-banner'),
    );
    await waitFor(() => expect(result.current).toHaveLength(1));
  });
});
