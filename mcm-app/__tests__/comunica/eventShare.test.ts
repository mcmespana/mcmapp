// Plan 08, tarea 8: el texto de «Compartir evento» (F5 del plugin).

import {
  buildEventShareMessage,
  eventDatesText,
  eventShareLink,
  registrationText,
  type ShareableEvent,
} from '@/utils/comunica/eventShare';

const TODAY = '2026-10-28';
const ID = 'a1b2c3d4-0000-4000-8000-000000000001';
const event = (patch: Partial<ShareableEvent> = {}): ShareableEvent => ({
  id: ID,
  name: 'Convivencia COM',
  startDate: '2026-11-14',
  endDate: '2026-11-15',
  place: 'Benicàssim',
  registrationClosesOn: '2026-11-05',
  share: {
    url: 'https://comunica.movimientoconsolacion.com/actividades/?e=convi-com',
    kind: 'public',
  },
  ...patch,
});

describe('eventDatesText', () => {
  it('un día', () => {
    expect(eventDatesText('2026-11-07', null, TODAY)).toBe(
      'sáb 7 de noviembre',
    );
    expect(eventDatesText('2026-11-07', '2026-11-07', TODAY)).toBe(
      'sáb 7 de noviembre',
    );
  });

  it('dos seguidos', () => {
    expect(eventDatesText('2026-11-14', '2026-11-15', TODAY)).toBe(
      'sáb 14 y dom 15 de noviembre',
    );
  });

  it('dos seguidos con cambio de mes', () => {
    expect(eventDatesText('2026-10-31', '2026-11-01', TODAY)).toBe(
      'sáb 31 de octubre y dom 1 de noviembre',
    );
  });

  it('más de dos, en el mismo mes y con cambio de mes', () => {
    expect(eventDatesText('2026-11-06', '2026-11-08', TODAY)).toBe(
      'del vie 6 al dom 8 de noviembre',
    );
    expect(eventDatesText('2026-10-30', '2026-11-01', TODAY)).toBe(
      'del vie 30 de octubre al dom 1 de noviembre',
    );
  });

  it('el año solo si no es el actual, también con cambio de año', () => {
    expect(eventDatesText('2027-03-13', '2027-03-14', TODAY)).toBe(
      'sáb 13 y dom 14 de marzo de 2027',
    );
    expect(eventDatesText('2026-12-30', '2027-01-02', TODAY)).toBe(
      'del mié 30 de diciembre al sáb 2 de enero de 2027',
    );
  });

  it('nunca el formato numérico', () => {
    expect(eventDatesText('2026-07-01', null, TODAY)).not.toMatch(/\d+\/\d+/);
  });
});

describe('registrationText', () => {
  it('futuro: hasta ese día (el día de fin cuenta entero)', () => {
    expect(registrationText(event(), TODAY)).toBe(
      'Apúntate hasta el 5 de noviembre',
    );
  });

  it('hoy: todavía se puede', () => {
    expect(
      registrationText(event({ registrationClosesOn: TODAY }), TODAY),
    ).toBe('Apúntate hasta el 28 de octubre');
  });

  it('pasado, vacío o aún sin abrir: nada', () => {
    expect(
      registrationText(event({ registrationClosesOn: '2026-10-27' }), TODAY),
    ).toBeNull();
    expect(
      registrationText(event({ registrationClosesOn: null }), TODAY),
    ).toBeNull();
    expect(
      registrationText(event({ registrationOpensOn: '2026-11-01' }), TODAY),
    ).toBeNull();
  });

  it('con el año si no es el actual', () => {
    expect(
      registrationText(event({ registrationClosesOn: '2027-01-10' }), TODAY),
    ).toBe('Apúntate hasta el 10 de enero de 2027');
  });
});

describe('buildEventShareMessage', () => {
  it('el texto de F5, con el enlace dentro', () => {
    expect(buildEventShareMessage(event(), TODAY)).toBe(
      'Convivencia COM · sáb 14 y dom 15 de noviembre · Benicàssim · Apúntate hasta el 5 de noviembre: https://comunica.movimientoconsolacion.com/actividades/?e=convi-com',
    );
  });

  it('sin lugar ni plazo', () => {
    expect(
      buildEventShareMessage(
        event({ place: null, registrationClosesOn: null }),
        TODAY,
      ),
    ).toBe(
      'Convivencia COM · sáb 14 y dom 15 de noviembre: https://comunica.movimientoconsolacion.com/actividades/?e=convi-com',
    );
  });

  it('enlace del área si el servidor lo da así', () => {
    const url = `https://comunica.movimientoconsolacion.com/ap/?internalpage=single_stic_events&action=detail&id=${ID}`;
    expect(
      buildEventShareMessage(event({ share: { url, kind: 'area' } }), TODAY),
    ).toMatch(new RegExp(`: ${url.replace(/[?.]/g, '\\$&')}$`));
  });

  it('sin `share` del servidor: pública si está publicado, si no del área', () => {
    expect(
      eventShareLink(event({ share: undefined, published: true, slug: 'x-1' })),
    ).toEqual({
      url: 'https://comunica.movimientoconsolacion.com/actividades/?e=x-1',
      kind: 'public',
    });
    expect(
      eventShareLink(event({ share: undefined, published: true, slug: '' })),
    ).toMatchObject({ url: expect.stringContaining(`?e=${ID}`) });
    expect(
      eventShareLink(event({ share: undefined, published: false })),
    ).toEqual({
      url: `https://comunica.movimientoconsolacion.com/ap/?internalpage=single_stic_events&action=detail&id=${ID}`,
      kind: 'area',
    });
  });

  it('`share: null` o un id raro: no se comparte (sin botón)', () => {
    expect(buildEventShareMessage(event({ share: null }), TODAY)).toBeNull();
    expect(
      buildEventShareMessage(event({ share: undefined, id: '../x' }), TODAY),
    ).toBeNull();
  });
});
