/**
 * Tests de `utils/icsParser.ts`.
 *
 * El test que de verdad importa aquí es el primero: la Cloud Function
 * `cacheCalendarIcs` parsea con `parseICSPortable` (sin localizar, porque corre
 * en `us-central1`) y el dispositivo remata con `localizeEvents`. Si esas dos
 * fases dejaran de componer exactamente lo que hace `parseICS`, los eventos
 * cacheados saldrían con otra hora que los descargados directamente del ICS —
 * un bug de los que solo se ven en producción y solo para algunos usuarios.
 */
import {
  buildEventsByDate,
  localizeEvents,
  MAX_EVENT_DAYS,
  parseICS,
  parseICSPortable,
  type ParsedEvent,
} from '@/utils/icsParser';

/** ICS con la variedad que trae el feed real: día completo, multi-día y hora Z. */
const ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Día completo suelto
DTSTART;VALUE=DATE:20260701
DTEND;VALUE=DATE:20260702
END:VEVENT
BEGIN:VEVENT
SUMMARY:Retiro de tres días
DTSTART;VALUE=DATE:20260710
DTEND;VALUE=DATE:20260713
END:VEVENT
BEGIN:VEVENT
SUMMARY:Reunión con hora en UTC
DTSTART:20260715T173000Z
DTEND:20260715T190000Z
LOCATION:Sala 2\\nEspaña
DESCRIPTION:Nos vemos en https://meet.google.com/abc-defg-hij y punto
END:VEVENT
BEGIN:VEVENT
SUMMARY:Evento a medianoche UTC (puede cambiar de día al localizar)
DTSTART:20260720T233000Z
DTEND:20260721T003000Z
END:VEVENT
BEGIN:VEVENT
SUMMARY:Hora flotante sin Z
DTSTART:20260722T100000
DTEND:20260722T113000
END:VEVENT
END:VCALENDAR`;

describe('parseICS = localizeEvents ∘ parseICSPortable', () => {
  it('las dos fases componen exactamente el parseo directo', () => {
    expect(localizeEvents(parseICSPortable(ICS))).toEqual(parseICS(ICS));
  });

  it('los eventos portables NO llevan la hora convertida (son cacheables)', () => {
    const portable = parseICSPortable(ICS);
    const utcEvent = portable.find((e) => e.title.startsWith('Reunión'));

    // Tal cual venía del ICS: 17:30 UTC, con la bandera puesta para que el
    // dispositivo sepa que hay que convertirla.
    expect(utcEvent).toMatchObject({
      startDate: '2026-07-15',
      startTime: '17:30',
      utcStart: true,
      utcEnd: true,
    });
  });

  it('las banderas utc* no sobreviven a la localización', () => {
    for (const ev of parseICS(ICS)) {
      expect(ev).not.toHaveProperty('utcStart');
      expect(ev).not.toHaveProperty('utcEnd');
    }
  });

  it('el ajuste de DTEND exclusivo se aplica una sola vez', () => {
    const events = parseICS(ICS);
    // DTEND 20260702 exclusivo sobre DTSTART 20260701 → un solo día.
    expect(events.find((e) => e.title === 'Día completo suelto')).toMatchObject(
      {
        startDate: '2026-07-01',
        endDate: undefined,
        isSingleDay: true,
      },
    );
    // DTEND 20260713 exclusivo → termina el 12.
    expect(events.find((e) => e.title === 'Retiro de tres días')).toMatchObject(
      {
        startDate: '2026-07-10',
        endDate: '2026-07-12',
        isSingleDay: false,
      },
    );
  });

  it('sigue detectando el link de videollamada y limpiando "España"', () => {
    const ev = parseICS(ICS).find((e) => e.title.startsWith('Reunión'));
    expect(ev?.conferenceUrl).toBe('https://meet.google.com/abc-defg-hij');
    expect(ev?.location).toBe('Sala 2');
  });

  it('una hora flotante (sin Z) no se toca', () => {
    const ev = parseICS(ICS).find((e) => e.title === 'Hora flotante sin Z');
    expect(ev).toMatchObject({
      startDate: '2026-07-22',
      startTime: '10:00',
      endTime: '11:30',
    });
  });

  it('parsear un ICS vacío o basura no revienta', () => {
    expect(parseICS('')).toEqual([]);
    expect(parseICS('no soy un ICS')).toEqual([]);
    // VEVENT sin SUMMARY ni DTSTART → se descarta, no se cuela a medias.
    expect(parseICS('BEGIN:VEVENT\nEND:VEVENT')).toEqual([]);
  });
});

describe('buildEventsByDate', () => {
  const single: ParsedEvent = {
    startDate: '2026-07-01',
    title: 'Uno',
    isSingleDay: true,
  };
  const multi: ParsedEvent = {
    startDate: '2026-07-10',
    endDate: '2026-07-12',
    title: 'Tres días',
    isSingleDay: false,
  };

  it('asigna calendarIndex por posición, no por contenido', () => {
    const map = buildEventsByDate([[single], [single]]);
    expect(map['2026-07-01'].map((e) => e.calendarIndex)).toEqual([0, 1]);
  });

  it('un calendario ausente (undefined) no desplaza los índices del resto', () => {
    const map = buildEventsByDate([undefined, [single]]);
    expect(map['2026-07-01']).toHaveLength(1);
    expect(map['2026-07-01'][0].calendarIndex).toBe(1);
  });

  it('expande el rango multi-día a todas sus fechas', () => {
    const map = buildEventsByDate([[multi]]);
    expect(Object.keys(map).sort()).toEqual([
      '2026-07-10',
      '2026-07-11',
      '2026-07-12',
    ]);
  });

  it('acota un DTEND corrupto y avisa por onTruncate', () => {
    const onTruncate = jest.fn();
    const map = buildEventsByDate(
      [[{ ...multi, endDate: '3000-01-01' }]],
      onTruncate,
    );
    expect(Object.keys(map)).toHaveLength(MAX_EVENT_DAYS);
    expect(onTruncate).toHaveBeenCalledTimes(1);
  });
});
