/**
 * Tests de `hooks/useCalendarConfigs.ts`.
 *
 * Este hook decide QUÉ calendarios ve el usuario y CUÁLES vienen marcados.
 * Sus dos trampas históricas:
 *  1. La selección se guardaba por índice: al reordenar o al pasar por el
 *     fallback (mientras Firebase carga) la selección del usuario se perdía o
 *     se aplicaba al calendario equivocado. Ahora es un mapa por ID, con
 *     migración one-shot desde la clave vieja.
 *  2. El calendario de la delegación propia tiene que ir SIEMPRE el primero,
 *     y el orden dentro de cada grupo debe ser estable.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCalendarConfigs } from '@/hooks/useCalendarConfigs';

const KEY = '@mcm_calendar_selection_v2';
const LEGACY_KEY = '@mcm_calendar_settings';

/** Datos que devuelve `useFirebaseData` en cada test. */
let mockFirebaseCalendars: unknown = null;
/** Config de perfil resuelta que ve el hook. */
let mockResolved: { delegationId: string | null; defaultCalendars?: string[] } = {
  delegationId: null,
};

jest.mock('@/hooks/useFirebaseData', () => ({
  useFirebaseData: () => ({
    data: mockFirebaseCalendars,
    loading: false,
    offline: false,
  }),
}));

jest.mock('@/hooks/useResolvedProfileConfig', () => ({
  useResolvedProfileConfig: () => mockResolved,
}));

const cal = (id: string, defaultSelected = false) => ({
  id,
  name: id,
  url: `https://x/${id}.ics`,
  color: '#000',
  defaultSelected,
});

async function mount() {
  const hook = await renderHook(() => useCalendarConfigs());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  mockFirebaseCalendars = null;
  mockResolved = { delegationId: null };
});

describe('lista de calendarios', () => {
  it('usa el fallback MCM Europa si Firebase no trae nada', async () => {
    const { result } = await mount();
    expect(result.current.calendarConfigs).toHaveLength(1);
    expect(result.current.calendarConfigs[0].id).toBe('mcm-europa');
    expect(result.current.visibleCalendars).toEqual([true]);
  });

  it('también cae al fallback con una lista vacía', async () => {
    mockFirebaseCalendars = [];
    const { result } = await mount();
    expect(result.current.calendarConfigs[0].id).toBe('mcm-europa');
  });

  it('pone el calendario de mi delegación el primero', async () => {
    mockFirebaseCalendars = [cal('mcm-europa'), cal('mcm-madrid'), cal('mcm-cast')];
    mockResolved = { delegationId: 'mcm-cast' };
    const { result } = await mount();
    expect(result.current.calendarConfigs.map((c) => c.id)).toEqual([
      'mcm-cast',
      'mcm-europa',
      'mcm-madrid',
    ]);
  });

  it('detrás de la delegación van los extras del perfil, y el resto igual', async () => {
    mockFirebaseCalendars = [cal('a'), cal('b'), cal('c'), cal('d')];
    mockResolved = { delegationId: 'c', defaultCalendars: ['d'] };
    const { result } = await mount();
    expect(result.current.calendarConfigs.map((c) => c.id)).toEqual([
      'c',
      'd',
      'a',
      'b',
    ]);
  });

  it('no expone defaultSelected a los consumidores', async () => {
    mockFirebaseCalendars = [cal('a', true)];
    const { result } = await mount();
    expect(Object.keys(result.current.calendarConfigs[0]).sort()).toEqual([
      'color',
      'id',
      'name',
      'url',
    ]);
  });
});

describe('selección por defecto', () => {
  it('sin perfil, manda el defaultSelected de cada calendario', async () => {
    mockFirebaseCalendars = [cal('a', true), cal('b', false)];
    const { result } = await mount();
    expect(result.current.visibleCalendars).toEqual([true, false]);
  });

  it('los defaultCalendars del perfil ganan al defaultSelected', async () => {
    mockFirebaseCalendars = [cal('a', true), cal('b', false)];
    mockResolved = { delegationId: null, defaultCalendars: ['b'] };
    const { result } = await mount();
    // 'b' pasa primero por ser extra del perfil, y es el único marcado.
    expect(result.current.calendarConfigs.map((c) => c.id)).toEqual(['b', 'a']);
    expect(result.current.visibleCalendars).toEqual([true, false]);
  });
});

describe('persistencia de la selección', () => {
  it('toggle invierte el estado y lo guarda por ID', async () => {
    mockFirebaseCalendars = [cal('a', true), cal('b', false)];
    const { result } = await mount();
    await act(async () => result.current.toggleCalendarVisibility(1));
    expect(result.current.visibleCalendars).toEqual([true, true]);
    await waitFor(async () => {
      const raw = await AsyncStorage.getItem(KEY);
      expect(JSON.parse(raw!)).toEqual({ b: true });
    });
  });

  it('un índice inexistente no rompe ni guarda nada', async () => {
    mockFirebaseCalendars = [cal('a', true)];
    const { result } = await mount();
    await act(async () => result.current.toggleCalendarVisibility(9));
    expect(result.current.visibleCalendars).toEqual([true]);
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });

  it('la selección guardada gana al default', async () => {
    mockFirebaseCalendars = [cal('a', true), cal('b', true)];
    await AsyncStorage.setItem(KEY, JSON.stringify({ a: false }));
    const { result } = await mount();
    expect(result.current.visibleCalendars).toEqual([false, true]);
  });

  it('la selección sobrevive a que cambie el orden de la lista', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ b: false }));
    mockFirebaseCalendars = [cal('b', true), cal('a', true)];
    const primera = await mount();
    expect(primera.result.current.visibleCalendars).toEqual([false, true]);

    // Firebase reordena: 'b' pasa al final. La selección le sigue.
    mockFirebaseCalendars = [cal('a', true), cal('b', true)];
    const segunda = await mount();
    expect(segunda.result.current.calendarConfigs.map((c) => c.id)).toEqual([
      'a',
      'b',
    ]);
    expect(segunda.result.current.visibleCalendars).toEqual([true, false]);
  });
});

describe('migración de la clave antigua (array por índice)', () => {
  /**
   * La migración solo puede hacerse cuando ya se conoce la lista REAL de
   * Firebase (con el fallback, los índices no significan nada), así que se
   * monta con la lista aún sin llegar y se fuerza un render cuando llega —
   * que es el orden que ocurre en la app.
   */
  async function montarConDatosQueLleganDespues(
    lista: ReturnType<typeof cal>[],
  ) {
    mockFirebaseCalendars = null;
    const hook = await mount();
    mockFirebaseCalendars = lista;
    await act(async () => hook.rerender(undefined));
    return hook;
  }

  it('convierte el array en un mapa por ID y borra la clave vieja', async () => {
    await AsyncStorage.setItem(LEGACY_KEY, JSON.stringify([false, true]));
    const { result } = await montarConDatosQueLleganDespues([
      cal('a', true),
      cal('b', false),
    ]);
    await waitFor(() =>
      expect(result.current.visibleCalendars).toEqual([false, true]),
    );
    await waitFor(async () =>
      expect(JSON.parse((await AsyncStorage.getItem(KEY))!)).toEqual({
        a: false,
        b: true,
      }),
    );
    expect(await AsyncStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('no migra si ya existe la clave nueva', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ a: true }));
    await AsyncStorage.setItem(LEGACY_KEY, JSON.stringify([false, false]));
    mockFirebaseCalendars = [cal('a', false), cal('b', false)];
    const { result } = await mount();
    expect(result.current.visibleCalendars[0]).toBe(true);
    expect(await AsyncStorage.getItem(LEGACY_KEY)).not.toBeNull();
  });

  it('un array más corto que la lista solo migra lo que cubre', async () => {
    await AsyncStorage.setItem(LEGACY_KEY, JSON.stringify([true]));
    const { result } = await montarConDatosQueLleganDespues([
      cal('a', false),
      cal('b', false),
    ]);
    await waitFor(() =>
      expect(result.current.visibleCalendars).toEqual([true, false]),
    );
  });
});
