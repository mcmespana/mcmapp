/**
 * Tests de `utils/calendarSubscription.ts`.
 *
 * Construyen las URLs que se ofrecen al usuario para "suscribirse" a un
 * calendario (webcal:// para el Calendario nativo, el link directo de Google
 * Calendar). Si el esquema o el `encodeURIComponent` fallan, el enlace no
 * abre nada y el usuario no puede suscribirse.
 */
import {
  buildWebcalUrl,
  buildGoogleCalendarSubscribeUrl,
  isValidIcsUrl,
} from '@/utils/calendarSubscription';

describe('buildWebcalUrl', () => {
  it('convierte https:// en webcal://', () => {
    expect(buildWebcalUrl('https://mcm.es/cal.ics')).toBe(
      'webcal://mcm.es/cal.ics',
    );
  });

  it('convierte http:// en webcal://', () => {
    expect(buildWebcalUrl('http://mcm.es/cal.ics')).toBe(
      'webcal://mcm.es/cal.ics',
    );
  });

  it('no toca el resto de la URL', () => {
    expect(buildWebcalUrl('https://mcm.es/path/a.ics?x=1')).toBe(
      'webcal://mcm.es/path/a.ics?x=1',
    );
  });
});

describe('buildGoogleCalendarSubscribeUrl', () => {
  it('codifica la URL como parámetro cid', () => {
    const url = buildGoogleCalendarSubscribeUrl('https://mcm.es/a b.ics');
    expect(url).toBe(
      'https://calendar.google.com/calendar/r?cid=' +
        encodeURIComponent('https://mcm.es/a b.ics'),
    );
  });
});

describe('isValidIcsUrl', () => {
  it('acepta http y https', () => {
    expect(isValidIcsUrl('http://a.com/x.ics')).toBe(true);
    expect(isValidIcsUrl('https://a.com/x.ics')).toBe(true);
  });

  it('rechaza otros esquemas o cadenas vacías', () => {
    expect(isValidIcsUrl('webcal://a.com/x.ics')).toBe(false);
    expect(isValidIcsUrl('ftp://a.com/x.ics')).toBe(false);
    expect(isValidIcsUrl('')).toBe(false);
    expect(isValidIcsUrl('no-es-una-url')).toBe(false);
  });
});
