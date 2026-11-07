/**
 * icsParser — lo que trae un feed de Google Calendar de verdad.
 *
 * Nada de esto da error: el calendario pinta un título con barras invertidas,
 * una descripción que no es la del evento, o un evento de un día repetido en
 * dos. Lo que se prueba aquí es el texto concreto que emite Google (escapes
 * RFC 5545, líneas plegadas, alarmas anidadas, cabeceras de videollamada).
 *
 * La composición de las dos fases y la expansión por fechas están en
 * `icsParser.test.ts`. Ninguna aserción depende de la zona horaria de la
 * máquina: se usan fechas de día completo u horas flotantes (sin `Z`).
 */
import {
  addDaysISO,
  buildEventsByDate,
  parseICS,
  parseICSPortable,
} from '@/utils/icsParser';

const vevent = (...lines: string[]) =>
  [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    ...lines,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

describe('parseICSPortable — texto', () => {
  it('desescapa comas y punto y coma del SUMMARY (Google los escapa siempre)', () => {
    const [ev] = parseICSPortable(
      vevent(
        'SUMMARY:Retiro\\, oración y fiesta\\; Valencia',
        'DTSTART;VALUE=DATE:20261010',
      ),
    );
    expect(ev.title).toBe('Retiro, oración y fiesta; Valencia');
  });

  it('une las líneas plegadas (continuación con espacio) sin comerse letras', () => {
    const [ev] = parseICSPortable(
      [
        'BEGIN:VEVENT',
        'SUMMARY:Encuentro de ',
        ' animadores',
        'DTSTART;VALUE=DATE:20261010',
        'DESCRIPTION:Primera parte',
        '  y segunda',
        'END:VEVENT',
      ].join('\r\n'),
    );
    expect(ev.title).toBe('Encuentro de animadores');
    expect(ev.description).toBe('Primera parte y segunda');
  });

  it('una línea de continuación antes de cualquier otra no revienta', () => {
    expect(() => parseICSPortable(' huérfana\nBEGIN:VEVENT')).not.toThrow();
  });

  it('la DESCRIPTION de una alarma (VALARM) no pisa la del evento', () => {
    const [ev] = parseICSPortable(
      vevent(
        'SUMMARY:Misa',
        'DTSTART;VALUE=DATE:20261010',
        'DESCRIPTION:Trae la guitarra',
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        'DESCRIPTION:This is an event reminder',
        'TRIGGER:-P0DT0H30M0S',
        'END:VALARM',
      ),
    );
    expect(ev.description).toBe('Trae la guitarra');
  });

  it('el SUMMARY de una alarma de correo no cambia el título del evento', () => {
    const [ev] = parseICSPortable(
      vevent(
        'SUMMARY:Misa',
        'DTSTART;VALUE=DATE:20261010',
        'BEGIN:VALARM',
        'ACTION:EMAIL',
        'SUMMARY:Alarm notification',
        'END:VALARM',
      ),
    );
    expect(ev.title).toBe('Misa');
  });

  it('una descripción vacía queda undefined, no "" (la UI pintaría una caja vacía)', () => {
    const [ev] = parseICSPortable(
      vevent('SUMMARY:X', 'DTSTART;VALUE=DATE:20261010', 'DESCRIPTION:'),
    );
    expect(ev.description).toBeUndefined();
  });

  it('una ubicación que solo dice "España" se queda sin ubicación', () => {
    const [ev] = parseICSPortable(
      vevent('SUMMARY:X', 'DTSTART;VALUE=DATE:20261010', 'LOCATION:España'),
    );
    expect(ev.location).toBeUndefined();
  });

  it('las comas escapadas de la dirección se desescapan', () => {
    const [ev] = parseICSPortable(
      vevent(
        'SUMMARY:X',
        'DTSTART;VALUE=DATE:20261010',
        'LOCATION:Calle Mayor 1\\, 46001 Valencia\\, España',
      ),
    );
    expect(ev.location).toBe('Calle Mayor 1, 46001 Valencia, España');
  });
});

describe('parseICSPortable — videollamada y URL', () => {
  it('X-GOOGLE-CONFERENCE manda sobre un enlace que aparezca después en la descripción', () => {
    const [ev] = parseICSPortable(
      vevent(
        'SUMMARY:X',
        'DTSTART;VALUE=DATE:20261010',
        'X-GOOGLE-CONFERENCE:https://meet.google.com/aaa-bbbb-ccc',
        'DESCRIPTION:Si falla usad https://zoom.us/j/123',
      ),
    );
    expect(ev.conferenceUrl).toBe('https://meet.google.com/aaa-bbbb-ccc');
  });

  it('detecta un enlace de Zoom con subdominio y corta en el paréntesis', () => {
    const [ev] = parseICSPortable(
      vevent(
        'SUMMARY:X',
        'DTSTART;VALUE=DATE:20261010',
        'DESCRIPTION:Conexión (https://us02web.zoom.us/j/8812?pwd=ab) gracias',
      ),
    );
    expect(ev.conferenceUrl).toBe('https://us02web.zoom.us/j/8812?pwd=ab');
  });

  it('un enlace cualquiera en la descripción NO se toma por videollamada', () => {
    const [ev] = parseICSPortable(
      vevent(
        'SUMMARY:X',
        'DTSTART;VALUE=DATE:20261010',
        'DESCRIPTION:Inscripción en https://mcmespana.org/form',
      ),
    );
    expect(ev.conferenceUrl).toBeUndefined();
  });

  it('guarda la URL del evento', () => {
    const [ev] = parseICSPortable(
      vevent(
        'SUMMARY:X',
        'DTSTART;VALUE=DATE:20261010',
        'URL:https://mcmespana.org/e',
      ),
    );
    expect(ev.url).toBe('https://mcmespana.org/e');
  });
});

describe('parseICSPortable — fechas', () => {
  it('un DTSTART con TZID es hora local de pared: se guarda tal cual, sin marcarlo UTC', () => {
    const [ev] = parseICSPortable(
      vevent('SUMMARY:X', 'DTSTART;TZID=Europe/Madrid:20261010T193000'),
    );
    expect(ev).toMatchObject({ startDate: '2026-10-10', startTime: '19:30' });
    expect(ev.utcStart).toBeUndefined();
    expect(ev.isAllDay).toBeUndefined();
  });

  it('un DTSTART ilegible no deja un evento con fecha inventada', () => {
    expect(
      parseICSPortable(vevent('SUMMARY:X', 'DTSTART:mañana a las 5')),
    ).toEqual([]);
  });

  it('un evento sin título se descarta aunque tenga fecha', () => {
    expect(
      parseICSPortable(vevent('DTSTART;VALUE=DATE:20261010', 'SUMMARY:')),
    ).toEqual([]);
  });
});

describe('localizeEvents + buildEventsByDate — días completos', () => {
  it('un día completo con DTEND exclusivo aparece SOLO en su día', () => {
    const map = buildEventsByDate([
      parseICS(
        vevent(
          'SUMMARY:Un día',
          'DTSTART;VALUE=DATE:20261031',
          'DTEND;VALUE=DATE:20261101',
        ),
      ),
    ]);
    expect(Object.keys(map)).toEqual(['2026-10-31']);
  });

  it('un día completo que cruza fin de mes y cambio de hora no pierde ni repite días', () => {
    // 24–26 oct 2026 incluye el cambio de hora europeo (25 oct).
    const map = buildEventsByDate([
      parseICS(
        vevent(
          'SUMMARY:Convivencia',
          'DTSTART;VALUE=DATE:20261024',
          'DTEND;VALUE=DATE:20261027',
        ),
      ),
    ]);
    expect(Object.keys(map).sort()).toEqual([
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
    ]);
  });

  it('con hora flotante y varios días se expande a cada día del rango', () => {
    const map = buildEventsByDate([
      parseICS(
        vevent(
          'SUMMARY:Campamento',
          'DTSTART:20260730T100000',
          'DTEND:20260801T120000',
        ),
      ),
    ]);
    expect(Object.keys(map).sort()).toEqual([
      '2026-07-30',
      '2026-07-31',
      '2026-08-01',
    ]);
  });
});

describe('addDaysISO', () => {
  it('cruza año bisiesto correctamente (28 feb 2028 + 1 = 29 feb)', () => {
    expect(addDaysISO('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysISO('2027-02-28', 1)).toBe('2027-03-01');
  });

  it('resta días cruzando el año', () => {
    expect(addDaysISO('2027-01-01', -1)).toBe('2026-12-31');
  });
});
