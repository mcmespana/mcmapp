/**
 * Tests del parseo y la expansión de fechas del calendario ICS
 * (`utils/calendarDates.ts` + `parseICS` de `hooks/useCalendarEvents.ts`).
 *
 * Los dos bugs que estos tests fijan (plan `plans/003-calendar-multiday-dst.md`):
 *
 * 1. La expansión multi-día mezclaba tres sistemas horarios (medianoche UTC +
 *    `setDate()` en hora de pared local + `toISOString()` en UTC otra vez). Al
 *    cruzar el cambio de hora de primavera emitía `28, 29, 29, 30, 31, 04-01`
 *    para el rango 28-mar → 2-abr: un día duplicado y el final un día antes; en
 *    otoño se comía el último día. Justo la ventana de Semana Santa y retiros.
 * 2. El parser ignoraba la zona horaria. El feed real (Google `basic.ics`)
 *    emite los eventos con hora como instantes UTC (`…T173000Z`) y se pintaba
 *    el `HHMM` literal → 1-2 h antes de la hora real, y el día equivocado si la
 *    hora UTC caía cerca de medianoche.
 *
 * **Sobre la zona horaria de los tests**: Jest sustituye `process.env` por una
 * copia, así que fijar `process.env.TZ` desde un test no notifica a V8 y no
 * cambia nada (los runners van en UTC, donde el bug 1 no se manifiesta). La
 * estrategia es por tanto doble:
 *   - valores exactos para los rangos que cruzan el cambio de hora (correctos
 *     en cualquier zona, y rojos en cuanto alguien vuelva a `Date`+`setDate` en
 *     una máquina con DST, como las de desarrollo en España);
 *   - un test que comprueba que la expansión **no llama a ninguna API de hora
 *     local**, que es la propiedad que de verdad arregla el bug y sí es
 *     verificable en UTC;
 *   - para la conversión UTC→local (bug 2), un oráculo independiente con `Intl`
 *     en la zona del proceso, en vez de reimplementar la misma aritmética.
 */
import { renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addDaysISO,
  eventDateKeys,
  parseIcsDateTimeValue,
  MAX_EVENT_DAYS,
} from '@/utils/calendarDates';
import useCalendarEvents, {
  parseICS,
  __resetCalendarCacheForTests,
} from '@/hooks/useCalendarEvents';
import type { CalendarConfig } from '@/hooks/useCalendarConfigs';

/**
 * Oráculo independiente: formatea un instante en la zona horaria del proceso
 * usando `Intl` (`sv-SE` produce `YYYY-MM-DD HH:MM`), que no comparte código
 * con los getters de `Date` que usa la implementación.
 */
function localParts(instantMs: number): { date: string; time: string } {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const text = new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(instantMs));
  const [date, time] = text.split(' ');
  return { date, time };
}

/** Construye un VEVENT mínimo con las líneas dadas (CRLF como el RFC). */
const vevent = (...lines: string[]) =>
  ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', ...lines, 'END:VEVENT', 'END:VCALENDAR']
    .map((l) => `${l}\r`)
    .join('\n');

describe('addDaysISO', () => {
  it('suma y resta días', () => {
    expect(addDaysISO('2026-07-01', 1)).toBe('2026-07-02');
    expect(addDaysISO('2026-07-01', -1)).toBe('2026-06-30');
    expect(addDaysISO('2026-07-01', 0)).toBe('2026-07-01');
  });

  it('cruza fin de mes, fin de año y el 29 de febrero bisiesto', () => {
    expect(addDaysISO('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysISO('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDaysISO('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysISO('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('atraviesa los dos cambios de hora europeos de 2026 sin desplazarse', () => {
    // 29-mar-2026: paso a horario de verano. 25-oct-2026: vuelta a invierno.
    expect(addDaysISO('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDaysISO('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDaysISO('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDaysISO('2026-10-25', 1)).toBe('2026-10-26');
  });
});

describe('eventDateKeys', () => {
  it('rango normal sin cambio de hora: un día por fecha', () => {
    expect(
      eventDateKeys({ startDate: '2026-07-01', endDate: '2026-07-03' }),
    ).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
  });

  it('primavera: 28-mar → 2-abr son 6 días, sin duplicados ni huecos', () => {
    // Con el código viejo, en una zona con DST, esto daba
    // [28, 29, 29, 30, 31, 04-01]: el 29 duplicado y sin el 2 de abril.
    const keys = eventDateKeys({
      startDate: '2026-03-28',
      endDate: '2026-04-02',
    });
    expect(keys).toEqual([
      '2026-03-28',
      '2026-03-29',
      '2026-03-30',
      '2026-03-31',
      '2026-04-01',
      '2026-04-02',
    ]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('otoño: 23-oct → 27-oct son 5 días (el viejo se comía el último)', () => {
    expect(
      eventDateKeys({ startDate: '2026-10-23', endDate: '2026-10-27' }),
    ).toEqual([
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
    ]);
  });

  it('no consulta la hora local: por eso el cambio de hora no la afecta', () => {
    // Esta es la propiedad que arregla el bug, y se puede comprobar en UTC:
    // toda la aritmética va en el calendario civil / UTC. Si alguien vuelve a
    // `d.setDate(d.getDate() + 1)` + `toISOString()`, este test se pone rojo.
    const locales = [
      'setDate',
      'getDate',
      'getMonth',
      'getFullYear',
      'toISOString',
    ] as const;
    const spies = locales.map((m) =>
      jest.spyOn(Date.prototype, m as 'getDate'),
    );

    eventDateKeys({ startDate: '2026-03-28', endDate: '2026-04-02' });

    spies.forEach((spy, i) => {
      expect(spy).not.toHaveBeenCalled();
      expect(locales[i]).toBeTruthy(); // nombre en el mensaje si falla
    });
    spies.forEach((spy) => spy.mockRestore());
  });

  it('evento de un día: una sola clave', () => {
    expect(eventDateKeys({ startDate: '2026-05-10' })).toEqual(['2026-05-10']);
    expect(
      eventDateKeys({
        startDate: '2026-05-10',
        endDate: '2026-05-12',
        isSingleDay: true,
      }),
    ).toEqual(['2026-05-10']);
  });

  it('endDate anterior a startDate (ICS corrupto): solo la fecha de inicio', () => {
    expect(
      eventDateKeys({ startDate: '2026-05-10', endDate: '2026-05-01' }),
    ).toEqual(['2026-05-10']);
  });

  it('rango absurdo: se corta en MAX_EVENT_DAYS y no da un bucle enorme', () => {
    const keys = eventDateKeys({
      startDate: '2026-01-01',
      endDate: '3000-01-01',
    });
    expect(keys).toHaveLength(MAX_EVENT_DAYS);
  });
});

describe('parseIcsDateTimeValue', () => {
  it('valor de solo fecha: día entero, sin hora y sin conversión', () => {
    expect(parseIcsDateTimeValue('20260315')).toEqual({
      date: '2026-03-15',
      isDateOnly: true,
    });
  });

  it('instante UTC (sufijo Z): fecha y hora en la zona del dispositivo', () => {
    const expected = localParts(Date.UTC(2026, 2, 15, 22, 0));
    expect(parseIcsDateTimeValue('20260315T220000Z')).toEqual({
      date: expected.date,
      time: expected.time,
      isDateOnly: false,
    });
  });

  it('instante UTC de madrugada: el DÍA local puede no ser el del ICS', () => {
    // 15-jul 22:00Z es ya el 16 en España (UTC+2). El código viejo devolvía
    // siempre el día y la hora literales del ICS.
    const expected = localParts(Date.UTC(2026, 6, 15, 22, 0));
    const parsed = parseIcsDateTimeValue('20260715T220000Z');
    expect(parsed.date).toBe(expected.date);
    expect(parsed.time).toBe(expected.time);
  });

  it('la fecha+hora local devuelta corresponde al mismo instante UTC', () => {
    const { date, time } = parseIcsDateTimeValue('20260601T173000Z');
    const [y, m, d] = date!.split('-').map(Number);
    const [hh, mm] = time!.split(':').map(Number);
    expect(new Date(y, m - 1, d, hh, mm).getTime()).toBe(
      Date.UTC(2026, 5, 1, 17, 30),
    );
  });

  it('acepta el instante UTC con y sin segundos, y da lo mismo', () => {
    const expected = localParts(Date.UTC(2026, 5, 1, 17, 30));
    expect(parseIcsDateTimeValue('20260601T173000Z')).toEqual({
      date: expected.date,
      time: expected.time,
      isDateOnly: false,
    });
    expect(parseIcsDateTimeValue('20260601T1730Z')).toEqual(
      parseIcsDateTimeValue('20260601T173000Z'),
    );
  });

  it('hora flotante (sin Z): se toma literal, sin traslado de zona', () => {
    expect(parseIcsDateTimeValue('20260315T220000')).toEqual({
      date: '2026-03-15',
      time: '22:00',
      isDateOnly: false,
    });
  });

  it('valor no reconocible: no inventa fecha', () => {
    expect(parseIcsDateTimeValue('vete-a-saber')).toEqual({
      isDateOnly: false,
    });
  });
});

describe('parseICS', () => {
  it('día entero multi-día: DTEND es exclusivo, se le resta un día', () => {
    const [ev] = parseICS(
      vevent(
        'SUMMARY:Retiro de Semana Santa',
        'DTSTART;VALUE=DATE:20260328',
        'DTEND;VALUE=DATE:20260403',
      ),
    );
    expect(ev.startDate).toBe('2026-03-28');
    expect(ev.endDate).toBe('2026-04-02');
    expect(ev.isAllDay).toBe(true);
    expect(ev.isSingleDay).toBe(false);
    expect(ev.startTime).toBeUndefined();
  });

  it('día entero de una sola jornada: se queda sin endDate', () => {
    const [ev] = parseICS(
      vevent(
        'SUMMARY:Jornada',
        'DTSTART;VALUE=DATE:20260315',
        'DTEND;VALUE=DATE:20260316',
      ),
    );
    expect(ev.endDate).toBeUndefined();
    expect(ev.isSingleDay).toBe(true);
  });

  it('evento con hora en UTC: fecha y hora locales (así viene el feed real)', () => {
    const start = localParts(Date.UTC(2026, 5, 1, 17, 30));
    const end = localParts(Date.UTC(2026, 5, 1, 19, 0));
    const [ev] = parseICS(
      vevent(
        'SUMMARY:Reunión',
        'DTSTART:20260601T173000Z',
        'DTEND:20260601T190000Z',
      ),
    );
    expect(ev.startDate).toBe(start.date);
    expect(ev.startTime).toBe(start.time);
    expect(ev.endTime).toBe(end.time);
    expect(ev.isAllDay).toBeUndefined();
  });

  it('expansión de un evento de Semana Santa de punta a punta', () => {
    const [ev] = parseICS(
      vevent(
        'SUMMARY:Pascua',
        'DTSTART;VALUE=DATE:20260328',
        'DTEND;VALUE=DATE:20260403',
      ),
    );
    expect(eventDateKeys(ev)).toEqual([
      '2026-03-28',
      '2026-03-29',
      '2026-03-30',
      '2026-03-31',
      '2026-04-01',
      '2026-04-02',
    ]);
  });

  it('des-plegado de líneas RFC 5545 y descripción con escapes', () => {
    const ics = [
      'BEGIN:VCALENDAR\r',
      'BEGIN:VEVENT\r',
      'SUMMARY:Titulo\r',
      'DESCRIPTION:Primera linea\\nSegunda\\, con coma\r',
      ' y continuacion plegada\r',
      'DTSTART;VALUE=DATE:20260315\r',
      'END:VEVENT\r',
      'END:VCALENDAR\r',
    ].join('\n');
    const [ev] = parseICS(ics);
    expect(ev.description).toContain('Segunda, con coma');
    expect(ev.description).toContain('y continuacion plegada');
  });
});

/**
 * Descarga de los calendarios (plan `plans/008-calendar-parallel-fetch-ttl.md`).
 *
 * Los ICS se bajaban EN SERIE (`await fetch` dentro de un `for`), así que el
 * tiempo hasta calendario fresco era la suma de los round-trips en vez del
 * máximo; y el efecto revalidaba todo en cada montaje, sin ventana de frescura,
 * con el hook montado a la vez en Home y en Calendario.
 *
 * Dos invariantes que estos tests vigilan: `calendarIndex` es POSICIONAL (el
 * color de cada evento depende de él) y un resultado parcial no cuenta ni como
 * fresco ni como persistible.
 */
describe('useCalendarEvents · descarga', () => {
  const cal = (name: string): CalendarConfig => ({
    name,
    url: `https://example.test/${name}.ics`,
    color: '#000000',
  });

  const icsWith = (title: string, date = '20260315') =>
    [
      'BEGIN:VCALENDAR\r',
      'BEGIN:VEVENT\r',
      `SUMMARY:${title}\r`,
      `DTSTART;VALUE=DATE:${date}\r`,
      'END:VEVENT\r',
      'END:VCALENDAR\r',
    ].join('\n');

  const okResponse = (body: string) =>
    ({ ok: true, text: () => Promise.resolve(body) }) as unknown as Response;

  let fetchMock: jest.Mock;
  const originalFetch = global.fetch;
  const originalProxy = process.env.EXPO_PUBLIC_CORS_PROXY_URL;

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    __resetCalendarCacheForTests();
    // El mock de expo-network arranca conectado, y cada fichero de test tiene
    // su propio registro de módulos, así que no hay que forzar nada.
    // Sin proxy: la ruta con proxy añade un fetch de fallback que confundiría
    // el conteo de llamadas de estos tests.
    delete process.env.EXPO_PUBLIC_CORS_PROXY_URL;
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
    if (originalProxy === undefined) {
      delete process.env.EXPO_PUBLIC_CORS_PROXY_URL;
    } else {
      process.env.EXPO_PUBLIC_CORS_PROXY_URL = originalProxy;
    }
  });

  it('lanza todas las descargas en paralelo, sin esperar a la primera', async () => {
    // Cada fetch queda "en vuelo" hasta que lo liberamos a mano: así se puede
    // afirmar que los tres arrancaron ANTES de que resolviera ninguno. Con el
    // bucle serial de antes solo habría uno en vuelo.
    const pending: ((r: Response) => void)[] = [];
    fetchMock.mockImplementation(
      () => new Promise<Response>((resolve) => pending.push(resolve)),
    );

    const calendars = [cal('uno'), cal('dos'), cal('tres')];
    const { result } = await renderHook(() => useCalendarEvents(calendars));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(pending).toHaveLength(3);

    pending.forEach((resolve, i) => resolve(okResponse(icsWith(`Evento ${i}`))));
    await waitFor(() => expect(result.current.loading).toBe(false));
    // Los tres calendarios acabaron en el mapa, cada uno con su índice.
    await waitFor(() =>
      expect(result.current.eventsByDate['2026-03-15']).toHaveLength(3),
    );
    expect(
      result.current.eventsByDate['2026-03-15'].map((e) => e.calendarIndex),
    ).toEqual([0, 1, 2]);
  });

  it('un calendario caído no desplaza el calendarIndex de los demás', async () => {
    fetchMock.mockImplementation((url: string) =>
      url.includes('roto')
        ? Promise.reject(new Error('fuente caída'))
        : Promise.resolve(okResponse(icsWith('Evento bueno'))),
    );

    // La lista se crea FUERA del callback: el efecto depende de su identidad,
    // así que un array nuevo en cada render lo relanzaría en bucle.
    const calendars = [cal('roto'), cal('bueno')];
    const { result } = await renderHook(() => useCalendarEvents(calendars));

    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() =>
      expect(result.current.eventsByDate['2026-03-15']).toBeDefined(),
    );

    const [ev] = result.current.eventsByDate['2026-03-15'];
    expect(ev.title).toBe('Evento bueno');
    // El evento es del SEGUNDO calendario: su índice debe ser 1, no 0.
    expect(ev.calendarIndex).toBe(1);
    // Resultado parcial: no se persiste.
    expect(await AsyncStorage.getItem('calendar_events')).toBeNull();
  });

  it('dentro de la ventana de frescura, un montaje nuevo no vuelve a descargar', async () => {
    fetchMock.mockResolvedValue(okResponse(icsWith('Evento')));
    const calendars = [cal('uno')];

    const first = await renderHook(() => useCalendarEvents(calendars));
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // La descarga completa se persiste: es lo que pinta el segundo montaje.
    await waitFor(async () =>
      expect(await AsyncStorage.getItem('calendar_events')).not.toBeNull(),
    );

    const second = await renderHook(() => useCalendarEvents(calendars));
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(1); // ← sin segunda descarga
    expect(second.result.current.eventsByDate['2026-03-15']).toBeDefined();

    // Fuera de la ventana (se simula limpiando el estado de módulo): sí baja.
    __resetCalendarCacheForTests();
    const third = await renderHook(() => useCalendarEvents(calendars));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(third.result.current.loading).toBe(false));
  });

  it('un resultado parcial NO cuenta como fresco: el siguiente montaje reintenta', async () => {
    fetchMock.mockImplementation((url: string) =>
      url.includes('roto')
        ? Promise.reject(new Error('fuente caída'))
        : Promise.resolve(okResponse(icsWith('Evento bueno'))),
    );
    const calendars = [cal('roto'), cal('bueno')];

    const first = await renderHook(() => useCalendarEvents(calendars));
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const second = await renderHook(() => useCalendarEvents(calendars));
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    // Cuatro llamadas: los dos calendarios, dos veces. Si el parcial hubiera
    // registrado frescura, se habría quedado en dos.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
  });
});
