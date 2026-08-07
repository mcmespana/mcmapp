/**
 * Tests de `hooks/useCalendarEvents.ts`: aritmética de expansión multi-día
 * (Plan 003) y parseo del ICS (fechas/horas, incluida la normalización de
 * UTC → local cuando el feed emite `Z`), y descarga en paralelo + ventana
 * de frescura del hook (Plan 008).
 */
import { renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useCalendarEvents, {
  addDaysISO,
  parseICS,
  __resetCalendarCacheForTests,
} from '@/hooks/useCalendarEvents';
import type { CalendarConfig } from '@/hooks/useCalendarConfigs';

describe('addDaysISO', () => {
  it('suma días dentro del mismo mes', () => {
    expect(addDaysISO('2026-07-01', 1)).toBe('2026-07-02');
  });

  it('cruza fin de mes', () => {
    expect(addDaysISO('2026-01-31', 1)).toBe('2026-02-01');
  });

  it('cruza fin de año', () => {
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('resta días (usado para el ajuste de DTEND exclusivo)', () => {
    expect(addDaysISO('2026-04-17', -1)).toBe('2026-04-16');
  });
});

describe('expansión de rango multi-día (aritmética de calendario pura)', () => {
  function expandRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    for (let cur = startDate; cur <= endDate; cur = addDaysISO(cur, 1)) {
      dates.push(cur);
    }
    return dates;
  }

  it('rango normal sin DST: 3 días exactos', () => {
    expect(expandRange('2026-07-01', '2026-07-03')).toEqual([
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
    ]);
  });

  it('cambio de hora de primavera (28 mar → 2 abr): sin duplicados ni huecos', () => {
    expect(expandRange('2026-03-28', '2026-04-02')).toEqual([
      '2026-03-28',
      '2026-03-29',
      '2026-03-30',
      '2026-03-31',
      '2026-04-01',
      '2026-04-02',
    ]);
  });

  it('cambio de hora de otoño (24 oct → 27 oct): sin duplicados ni huecos', () => {
    expect(expandRange('2026-10-24', '2026-10-27')).toEqual([
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
    ]);
  });
});

describe('parseICS', () => {
  it('evento de un día (VALUE=DATE) sin endDate → isSingleDay', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Evento suelto',
      'DTSTART;VALUE=DATE:20260417',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');
    const [ev] = parseICS(ics);
    expect(ev.startDate).toBe('2026-04-17');
    expect(ev.isAllDay).toBe(true);
    expect(ev.isSingleDay).toBe(true);
    expect(ev.endDate).toBeUndefined();
  });

  it('evento de día completo multi-día: DTEND exclusivo se ajusta un día atrás', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Retiro',
      'DTSTART;VALUE=DATE:20260328',
      'DTEND;VALUE=DATE:20260402',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');
    const [ev] = parseICS(ics);
    expect(ev.startDate).toBe('2026-03-28');
    expect(ev.endDate).toBe('2026-04-01');
    expect(ev.isSingleDay).toBe(false);
  });

  it('DTSTART con hora en UTC (Z) se normaliza a fecha/hora local', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Con hora UTC',
      'DTSTART:20260315T220000Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');
    const [ev] = parseICS(ics);
    // 22:00 UTC del 15 de marzo → hora local (getters locales del entorno de test)
    const expectedLocal = new Date(Date.UTC(2026, 2, 15, 22, 0));
    const expectedDate = `${expectedLocal.getFullYear()}-${String(expectedLocal.getMonth() + 1).padStart(2, '0')}-${String(expectedLocal.getDate()).padStart(2, '0')}`;
    const expectedTime = `${String(expectedLocal.getHours()).padStart(2, '0')}:${String(expectedLocal.getMinutes()).padStart(2, '0')}`;
    expect(ev.startDate).toBe(expectedDate);
    expect(ev.startTime).toBe(expectedTime);
    expect(ev.isAllDay).toBeFalsy();
  });

  it('DTSTART flotante (sin Z, sin TZID) no se convierte', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Hora flotante',
      'DTSTART:20260315T220000',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');
    const [ev] = parseICS(ics);
    expect(ev.startDate).toBe('2026-03-15');
    expect(ev.startTime).toBe('22:00');
  });
});

// ── useCalendarEvents: descarga en paralelo + ventana de frescura (Plan 008) ──

const icsWith = (summary: string, date: string) =>
  [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    `SUMMARY:${summary}`,
    `DTSTART;VALUE=DATE:${date.replace(/-/g, '')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\n');

const cal = (name: string, url: string): CalendarConfig => ({
  id: name,
  name,
  url,
  color: '#000',
});

const okResponse = (text: string) =>
  Promise.resolve({ ok: true, text: () => Promise.resolve(text) } as Response);

describe('useCalendarEvents — descarga en paralelo (Plan 008)', () => {
  const originalEnv = process.env.EXPO_PUBLIC_CORS_PROXY_URL;

  beforeEach(async () => {
    delete process.env.EXPO_PUBLIC_CORS_PROXY_URL;
    __resetCalendarCacheForTests();
    await AsyncStorage.clear();
    (global as any).fetch = jest.fn();
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_CORS_PROXY_URL = originalEnv;
  });

  it('los dos fetch se inician en paralelo (ninguno espera al otro)', async () => {
    const started: string[] = [];
    let resolveA!: (r: Response) => void;
    let resolveB!: (r: Response) => void;

    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      started.push(url);
      return new Promise<Response>((resolve) => {
        if (url === 'https://a.example/cal.ics') resolveA = resolve;
        else resolveB = resolve;
      });
    });

    const calendars = [
      cal('A', 'https://a.example/cal.ics'),
      cal('B', 'https://b.example/cal.ics'),
    ];
    renderHook(() => useCalendarEvents(calendars));

    // Ambos fetch deben haberse lanzado ANTES de que ninguno resuelva —
    // si fuera serie, "B" no se llamaría hasta que "A" resolviera.
    await waitFor(() => {
      expect(started).toEqual([
        'https://a.example/cal.ics',
        'https://b.example/cal.ics',
      ]);
    });

    resolveA({ ok: true, text: () => Promise.resolve('') } as Response);
    resolveB({ ok: true, text: () => Promise.resolve('') } as Response);
  });

  it('falla el calendario 0, funciona el 1 → calendarIndex se mantiene posicional', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url === 'https://a.example/cal.ics') {
        return Promise.reject(new Error('fuente caída'));
      }
      return okResponse(icsWith('Evento B', '2026-05-10'));
    });

    const calendars = [
      cal('A', 'https://a.example/cal.ics'),
      cal('B', 'https://b.example/cal.ics'),
    ];
    const { result } = await renderHook(() => useCalendarEvents(calendars));

    await waitFor(() => expect(result.current.loading).toBe(false));

    const events = result.current.eventsByDate['2026-05-10'];
    expect(events).toHaveLength(1);
    expect(events[0].calendarIndex).toBe(1);
  });

  it('descarga completa → un segundo montaje dentro de la ventana NO relanza fetch', async () => {
    (global.fetch as jest.Mock).mockImplementation(() =>
      okResponse(icsWith('Evento', '2026-05-10')),
    );
    const calendars = [cal('A', 'https://a.example/cal.ics')];

    const first = await renderHook(() => useCalendarEvents(calendars));
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    const callsAfterFirst = (global.fetch as jest.Mock).mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    const second = await renderHook(() => useCalendarEvents(calendars));
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsAfterFirst);

    // Tras reiniciar la ventana, un tercer montaje sí relanza.
    __resetCalendarCacheForTests();
    const third = await renderHook(() => useCalendarEvents(calendars));
    await waitFor(() => expect(third.result.current.loading).toBe(false));
    expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(
      callsAfterFirst,
    );
  });

  it('descarga parcial → NO registra frescura (el siguiente montaje relanza)', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('caída'));
    const calendars = [cal('A', 'https://a.example/cal.ics')];

    const first = await renderHook(() => useCalendarEvents(calendars));
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    const callsAfterFirst = (global.fetch as jest.Mock).mock.calls.length;

    const second = await renderHook(() => useCalendarEvents(calendars));
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    // No hubo descarga completa → la ventana de frescura no aplica: relanza.
    expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(
      callsAfterFirst,
    );
  });
});
