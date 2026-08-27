/**
 * Tests de la ruta precacheada de `hooks/useCalendarEvents.ts`.
 *
 * Contexto: el `.ics` de Google se genera en caliente (TTFB medido de 0,9–1,3 s,
 * con `Cache-Control: no-store` y sin `ETag`, así que no hay caché HTTP posible).
 * La Cloud Function `cacheCalendarIcs` paga esa espera cada 2 h y deja el
 * resultado en `/calendarEvents`; la app lee de ahí y solo baja ICS como
 * fallback. Lo que se prueba aquí es justo eso: que cuando el nodo sirve NO se
 * toca la red, y que cuando no sirve se sigue bajando el ICS como siempre.
 */
import { renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { get } from 'firebase/database';
import { __setMockNode, __resetMockDb } from '@/__mocks__/firebase';
import useCalendarEvents, {
  __resetCalendarCacheForTests,
} from '@/hooks/useCalendarEvents';
import type { CalendarConfig } from '@/hooks/useCalendarConfigs';

const ID_A = 'mcm-europa';
const ID_B = 'mcm-castellon';

/**
 * Calendarios con URLs ÚNICAS por test.
 *
 * Dos motivos, los dos aprendidos a base de tests en rojo:
 *
 *   1. La ventana de frescura del hook se indexa por lista de URLs y vive en un
 *      Map de módulo. Las continuaciones asíncronas de un test que ya terminó la
 *      repueblan DESPUÉS del `beforeEach`, así que compartir URLs entre tests
 *      hace que unos se coman los fetch de otros.
 *   2. El array se crea una vez por test (no dentro del render), porque el
 *      efecto depende de su identidad: un literal nuevo en cada render mete al
 *      hook en un bucle infinito de efecto → setState → efecto. En la app real
 *      las listas vienen memoizadas de `useCalendarConfigs`.
 */
function makeCalendars(tag: string, ids: string[] = [ID_A]): CalendarConfig[] {
  return ids.map((id, i) => ({
    id,
    name: id,
    url: `https://example.test/${tag}-${id}.ics`,
    color: i === 0 ? '#000' : '#111',
  }));
}

const ICS_FALLBACK = `BEGIN:VEVENT
SUMMARY:Sacado del ICS
DTSTART;VALUE=DATE:20260801
END:VEVENT`;

const okResponse = (text: string) =>
  Promise.resolve({ ok: true, text: () => Promise.resolve(text) } as Response);

/** Nodo tal y como lo escribe la Cloud Function: eventos PORTABLES. */
function nodeWith(
  ids: string[],
  opts: { checkedAt?: string; updatedAt?: string } = {},
) {
  const now = new Date().toISOString();
  const data: Record<string, { events: unknown[] }> = {};
  for (const id of ids) {
    data[id] = {
      events: [
        {
          startDate: '2026-07-15',
          startTime: '17:30',
          endDate: '2026-07-15',
          endTime: '19:00',
          title: `Precacheado ${id}`,
          utcStart: true,
          utcEnd: true,
        },
      ],
    };
  }
  return {
    meta: {
      updatedAt: opts.updatedAt ?? now,
      checkedAt: opts.checkedAt ?? now,
      hash: 'deadbeef',
      calendarIds: ids,
    },
    data,
  };
}

/** Paths pedidos a Firebase desde el último `mockClear`. */
const requestedPaths = () =>
  (get as jest.Mock).mock.calls.map((c) => c[0]?.path);

describe('useCalendarEvents — nodo precacheado', () => {
  const originalEnv = process.env.EXPO_PUBLIC_CORS_PROXY_URL;

  beforeEach(async () => {
    // Deja que las continuaciones asíncronas del test anterior (efectos de
    // hooks ya desmontados, `persist()` en vuelo) terminen ANTES de limpiar:
    // si no, escriben en AsyncStorage y en los Maps de módulo justo después
    // del reset y contaminan el test siguiente.
    await new Promise((r) => setTimeout(r, 20));
    delete process.env.EXPO_PUBLIC_CORS_PROXY_URL;
    __resetCalendarCacheForTests();
    __resetMockDb();
    await AsyncStorage.clear();
    (global as any).fetch = jest.fn(() => okResponse(ICS_FALLBACK));
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_CORS_PROXY_URL = originalEnv;
  });

  it('el nodo cubre todos los calendarios → NO se baja ningún ICS', async () => {
    __setMockNode('calendarEvents', nodeWith([ID_A, ID_B]));
    const cals = makeCalendars('cubre', [ID_A, ID_B]);

    const { result } = await renderHook(() => useCalendarEvents(cals));
    await waitFor(() =>
      expect(Object.keys(result.current.eventsByDate).length).toBeGreaterThan(
        0,
      ),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(global.fetch).not.toHaveBeenCalled();
    // Y el calendarIndex sigue siendo posicional para ESTE usuario.
    const day = Object.values(result.current.eventsByDate)[0];
    expect(day.map((e) => e.calendarIndex).sort()).toEqual([0, 1]);
  });

  it('las horas del nodo se localizan en el dispositivo, no vienen ya convertidas', async () => {
    __setMockNode('calendarEvents', nodeWith([ID_A]));
    const cals = makeCalendars('horas');

    const { result } = await renderHook(() => useCalendarEvents(cals));
    await waitFor(() =>
      expect(Object.keys(result.current.eventsByDate).length).toBeGreaterThan(
        0,
      ),
    );

    // 17:30 UTC del ICS → lo que corresponda en la zona del dispositivo que
    // corre el test. Lo importante es que NO se queda en 17:30 tal cual en una
    // zona desplazada: la conversión la hace `localizeEvents`, no el servidor.
    const [[date, events]] = Object.entries(result.current.eventsByDate);
    const expected = new Date(Date.UTC(2026, 6, 15, 17, 30));
    const pad = (n: number) => String(n).padStart(2, '0');
    expect(events[0].startTime).toBe(
      `${pad(expected.getHours())}:${pad(expected.getMinutes())}`,
    );
    expect(date).toBe(
      `${expected.getFullYear()}-${pad(expected.getMonth() + 1)}-${pad(expected.getDate())}`,
    );
  });

  it('el cron lleva más de 24 h sin dar señales → se baja el ICS', async () => {
    const old = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
    __setMockNode('calendarEvents', nodeWith([ID_A], { checkedAt: old }));
    const cals = makeCalendars('rancio');

    const { result } = await renderHook(() => useCalendarEvents(cals));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(global.fetch).toHaveBeenCalledWith(cals[0].url);
  });

  it('cobertura parcial → solo se baja el ICS del calendario que falta', async () => {
    __setMockNode('calendarEvents', nodeWith([ID_A]));
    const cals = makeCalendars('parcial', [ID_A, ID_B]);

    const { result } = await renderHook(() => useCalendarEvents(cals));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(Object.keys(result.current.eventsByDate).length).toBe(2),
    );

    // Solo el ICS de B: el de A sale del nodo.
    expect(global.fetch).toHaveBeenCalledWith(cals[1].url);
    const titles = Object.values(result.current.eventsByDate)
      .flat()
      .map((e) => e.title);
    expect(titles).toContain(`Precacheado ${ID_A}`);
    expect(titles).toContain('Sacado del ICS');
  });

  it('caché local al día → solo se lee `meta`: ni `data` ni ICS', async () => {
    // Este es EL caso normal: la app se abre, el cron no ha cambiado nada
    // desde la última vez y lo pintado en disco ya es correcto. El coste
    // entero de la apertura tiene que ser una lectura de tres campos.
    const UPDATED = '2026-08-01T00:00:00.000Z';
    __setMockNode('calendarEvents', nodeWith([ID_A], { updatedAt: UPDATED }));
    const cals = makeCalendars('valida');

    const painted = { '2026-07-15': [] };
    await AsyncStorage.setItem('calendar_events', JSON.stringify(painted));
    await AsyncStorage.setItem(
      'calendar_events_meta',
      JSON.stringify({ nodeUpdatedAt: UPDATED, calendarIds: [ID_A] }),
    );
    (get as jest.Mock).mockClear();

    const { result } = await renderHook(() => useCalendarEvents(cals));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.eventsByDate).toEqual(painted);
    expect(requestedPaths()).toEqual(['calendarEvents/meta']);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('caché local de OTRA versión del nodo → sí se descarga `data`', async () => {
    __setMockNode(
      'calendarEvents',
      nodeWith([ID_A], { updatedAt: '2026-08-02T00:00:00.000Z' }),
    );
    const cals = makeCalendars('desfasada');

    await AsyncStorage.setItem('calendar_events', JSON.stringify({ x: [] }));
    await AsyncStorage.setItem(
      'calendar_events_meta',
      JSON.stringify({ nodeUpdatedAt: 'viejo', calendarIds: [ID_A] }),
    );
    (get as jest.Mock).mockClear();

    const { result } = await renderHook(() => useCalendarEvents(cals));
    await waitFor(() =>
      expect(Object.keys(result.current.eventsByDate)).not.toEqual(['x']),
    );

    expect(requestedPaths()).toEqual([
      'calendarEvents/meta',
      'calendarEvents/data',
    ]);
    // Sigue sin hacer falta ningún ICS: el nodo cubre el calendario.
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('nodo ausente → todo por ICS, como antes', async () => {
    __setMockNode('calendarEvents', null);
    const cals = makeCalendars('ausente');

    const { result } = await renderHook(() => useCalendarEvents(cals));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(global.fetch).toHaveBeenCalledWith(cals[0].url);
  });
});

describe('useCalendarEvents — el proxy CORS es solo de web', () => {
  const PROXY = 'https://proxy.test/?url=';

  beforeEach(async () => {
    await new Promise((r) => setTimeout(r, 20)); // ver nota del describe anterior
    __resetCalendarCacheForTests();
    __resetMockDb();
    await AsyncStorage.clear();
    __setMockNode('calendarEvents', null); // fuerza la ruta ICS
    process.env.EXPO_PUBLIC_CORS_PROXY_URL = PROXY;
    (global as any).fetch = jest.fn(() => okResponse(ICS_FALLBACK));
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_CORS_PROXY_URL;
  });

  it('en nativo va DIRECTO aunque el proxy esté configurado', async () => {
    // En iOS/Android no hay CORS que sortear: el salto extra solo añadía un
    // round-trip de ~1 s, y si el proxy fallaba se pagaban DOS.
    const spy = jest.replaceProperty(Platform, 'OS', 'ios');
    const cals = makeCalendars('nativo');
    try {
      await renderHook(() => useCalendarEvents(cals));
      await waitFor(() => expect(global.fetch).toHaveBeenCalled());
      expect(global.fetch).toHaveBeenCalledWith(cals[0].url);
      expect(global.fetch).not.toHaveBeenCalledWith(
        PROXY + encodeURIComponent(cals[0].url),
      );
    } finally {
      spy.restore();
    }
  });

  it('en web sigue pasando por el proxy (ahí el CORS es real)', async () => {
    const spy = jest.replaceProperty(Platform, 'OS', 'web');
    const cals = makeCalendars('web');
    try {
      await renderHook(() => useCalendarEvents(cals));
      await waitFor(() => expect(global.fetch).toHaveBeenCalled());
      expect(global.fetch).toHaveBeenCalledWith(
        PROXY + encodeURIComponent(cals[0].url),
      );
    } finally {
      spy.restore();
    }
  });
});
