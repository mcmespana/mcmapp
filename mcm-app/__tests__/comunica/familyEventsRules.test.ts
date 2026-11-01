/**
 * Las reglas puras de los eventos de familias (plan 13, tarea 3): plazo,
 * pasado, chips, líneas de la tarjeta, orden del listado, fechas en palabras,
 * duración, la acción de la ficha y los enlaces del cuerpo.
 */
import type { EventCard, EventDetail } from '@/services/comunica/contract';
import { activityBlocks } from '@/utils/comunica/activityList';
import { classifyBodyLink, mapLink } from '@/utils/comunica/bodyLinks';
import { signupAction } from '@/utils/comunica/eventSignup';
import {
  cardAction,
  cardLines,
  eventChip,
  isPastEvent,
  registrationWindow,
} from '@/utils/comunica/eventWindow';
import { madridDay } from '@/utils/comunica/madrid';
import {
  dateLine,
  durationLabel,
  priceLabel,
} from '@/utils/comunica/recordDates';

const TODAY = '2026-11-02';

const card = (patch: Partial<EventCard> = {}): EventCard => ({
  id: 'e1',
  name: 'Convivencia',
  startDate: '2026-11-20',
  endDate: '2026-11-22',
  place: 'Albergue',
  statusLabel: 'Inscripciones abiertas',
  window: { opensOn: null, closesOn: null },
  hasAdvancedForm: false,
  myRegistrationId: null,
  myRegistrationStatus: null,
  ...patch,
});

const detail = (patch: Partial<EventDetail> = {}): EventDetail => ({
  generatedAt: '2026-11-02T10:00:00Z',
  ...card(),
  tagline: null,
  description: null,
  timetable: null,
  address: null,
  capacity: null,
  price: null,
  map: null,
  cover: null,
  body: [],
  gallery: [],
  attachments: [],
  publicUrl: null,
  share: null,
  signup: { audience: { ok: true } },
  ...patch,
});

describe('el plazo de inscripción', () => {
  it('sin fechas, abierta (regla de seguridad)', () => {
    expect(
      registrationWindow({ opensOn: null, closesOn: null }, TODAY),
    ).toMatchObject({
      state: 'open',
      noDates: true,
    });
  });

  it('el día de cierre cuenta entero, en hora de Madrid (también con el cambio de hora)', () => {
    const w = { opensOn: null, closesOn: '2026-10-25' };
    // 25/10/2026 es el día del cambio de hora: 23:59 de Madrid = 22:59 UTC.
    expect(
      registrationWindow(w, madridDay(new Date('2026-10-25T22:59:00Z'))).state,
    ).toBe('open');
    // 00:00 del día siguiente = 23:00 UTC del 25.
    expect(
      registrationWindow(w, madridDay(new Date('2026-10-25T23:00:00Z'))).state,
    ).toBe('closed');
  });

  it('«antes» con fecha de apertura; abierta desde ese día', () => {
    const w = { opensOn: '2026-11-05', closesOn: null };
    expect(registrationWindow(w, TODAY).state).toBe('before');
    expect(registrationWindow(w, '2026-11-05').state).toBe('open');
  });
});

describe('pasado, chips y tarjeta', () => {
  it('pasado por la fecha de fin y, sin fin, por la de inicio; lo que acaba hoy sigue', () => {
    expect(
      isPastEvent(card({ startDate: '2026-10-30', endDate: TODAY }), TODAY),
    ).toBe(false);
    expect(
      isPastEvent(
        card({ startDate: '2026-10-30', endDate: '2026-11-01' }),
        TODAY,
      ),
    ).toBe(true);
    expect(
      isPastEvent(card({ startDate: '2026-11-01', endDate: null }), TODAY),
    ).toBe(true);
    expect(isPastEvent(card({ startDate: null, endDate: null }), TODAY)).toBe(
      false,
    );
  });

  it('el chip del plazo gana a la etiqueta del CRM; «Con plaza» gana a todo', () => {
    const closed = card({ window: { opensOn: null, closesOn: '2026-11-01' } });
    expect(eventChip(closed, TODAY)?.label).toBe('Inscripción cerrada');
    expect(
      eventChip(
        card({ window: { opensOn: '2026-11-10', closesOn: null } }),
        TODAY,
      )?.label,
    ).toBe('Inscripción no abierta');
    expect(eventChip(card(), TODAY)?.label).toBe('Inscripciones abiertas');
    expect(
      eventChip(
        {
          ...closed,
          myRegistrationId: 'r1',
          myRegistrationStatus: { label: 'Con plaza', tone: 'ok' },
        },
        TODAY,
      )?.label,
    ).toBe('Con plaza');
    expect(
      eventChip(
        card({
          myRegistrationId: 'r1',
          myRegistrationStatus: { label: 'Rechazada', tone: 'danger' },
        }),
        TODAY,
      ),
    ).toEqual({ label: 'Rechazada', tone: 'negative' });
  });

  it('la tarjeta no repite el plazo cerrado ni el de lo inscrito', () => {
    const open = card({ window: { opensOn: null, closesOn: '2026-11-10' } });
    expect(cardLines(open, TODAY)).toEqual([
      'del 20 al 22 de noviembre de 2026',
      'Albergue',
      'Hasta el 10 de noviembre de 2026',
    ]);
    const closed = card({ window: { opensOn: null, closesOn: '2026-11-01' } });
    expect(cardLines(closed, TODAY)).toHaveLength(2);
    expect(cardLines({ ...open, myRegistrationId: 'r1' }, TODAY)).toHaveLength(
      2,
    );
    expect(
      cardLines(
        card({ window: { opensOn: '2026-11-05', closesOn: null } }),
        TODAY,
      ),
    ).toContain('Se abre el 5 de noviembre de 2026');
  });

  it('la acción del pie: «Mi inscripción», «Inscribirme» o ninguna fuera de plazo', () => {
    expect(cardAction(card({ myRegistrationId: 'r1' }), TODAY)).toBe(
      'myRegistration',
    );
    expect(cardAction(card(), TODAY)).toBe('signUp');
    expect(
      cardAction(
        card({ window: { opensOn: null, closesOn: '2026-11-01' } }),
        TODAY,
      ),
    ).toBeNull();
  });
});

describe('el listado', () => {
  it('quita lo pasado, ordena por inicio (sin fecha al final) y titula solo con dos bloques', () => {
    const b = activityBlocks(
      {
        toSignUp: [
          card({ id: 'sin', startDate: null, endDate: null }),
          card({ id: 'tarde', startDate: '2026-12-01', endDate: null }),
          card({ id: 'pronto', startDate: '2026-11-05', endDate: null }),
          card({ id: 'pasado', startDate: '2026-10-01', endDate: null }),
        ],
        signedUp: [],
      },
      TODAY,
    );
    expect(b.toSignUp.map((e) => e.id)).toEqual(['pronto', 'tarde', 'sin']);
    expect(b.titled).toBe(false);
    expect(
      activityBlocks(
        { toSignUp: [card()], signedUp: [card({ id: 'x' })] },
        TODAY,
      ).titled,
    ).toBe(true);
    expect(activityBlocks({ toSignUp: [], signedUp: [] }, TODAY).empty).toBe(
      true,
    );
  });
});

describe('fechas en palabras y duración', () => {
  it('un día, mismo mes, meses distintos y años distintos', () => {
    expect(dateLine('2026-05-05')).toBe('5 de mayo de 2026');
    expect(dateLine('2026-05-05', '2026-05-05')).toBe('5 de mayo de 2026');
    expect(dateLine('2026-07-01', '2026-07-10')).toBe(
      'del 1 al 10 de julio de 2026',
    );
    expect(dateLine('2026-09-28', '2026-10-02')).toBe(
      'del 28 de septiembre de 2026 al 2 de octubre de 2026',
    );
    expect(dateLine('2026-12-30', '2027-01-02')).toBe(
      'del 30 de diciembre de 2026 al 2 de enero de 2027',
    );
    expect(dateLine(null)).toBe('');
  });

  it('la duración solo de 2 a 31 días', () => {
    expect(durationLabel('2026-07-01', '2026-07-01')).toBeNull();
    expect(durationLabel('2026-07-01', '2026-07-03')).toBe('3 días');
    expect(durationLabel('2026-07-01', '2026-07-31')).toBe('31 días');
    expect(durationLabel('2026-07-01', '2026-08-01')).toBeNull();
  });

  it('el precio sin «.00»', () => {
    expect(priceLabel(35)).toBe('35 €');
    expect(priceLabel(12.5)).toBe('12,50 €');
  });
});

describe('la acción de la ficha (orden de los motivos)', () => {
  const other = {
    ok: false as const,
    reason: 'delegation' as const,
    message: 'De otra delegación.',
  };

  it('pasado → plaza → audiencia → plazo → abierta', () => {
    const past = detail({
      startDate: '2026-10-01',
      endDate: '2026-10-02',
      myRegistrationId: 'r1',
      signup: { audience: other },
    });
    expect(signupAction(past, TODAY).kind).toBe('past');
    const reg = detail({ myRegistrationId: 'r1', signup: { audience: other } });
    expect(signupAction(reg, TODAY)).toMatchObject({
      kind: 'registered',
      registrationId: 'r1',
    });
    const closedOther = detail({
      window: { opensOn: null, closesOn: '2026-11-01' },
      signup: { audience: other },
    });
    expect(signupAction(closedOther, TODAY)).toEqual({
      kind: 'blocked',
      reason: 'audience',
      title: 'Esta actividad no es para ti',
      note: 'De otra delegación.',
    });
    const closed = detail({
      window: { opensOn: null, closesOn: '2026-11-01' },
    });
    expect(signupAction(closed, TODAY)).toEqual({
      kind: 'blocked',
      reason: 'window',
      title: 'La inscripción no está abierta',
      note: 'El plazo de inscripción terminó el 1 de noviembre de 2026.',
    });
    const before = detail({
      window: { opensOn: '2026-11-05', closesOn: null },
    });
    expect(signupAction(before, TODAY)).toMatchObject({
      note: 'La inscripción se abre el 5 de noviembre de 2026.',
    });
    expect(signupAction(detail(), TODAY)).toMatchObject({
      kind: 'open',
      label: 'Inscribirme en esta actividad',
      note: null,
    });
    expect(
      signupAction(detail({ hasAdvancedForm: true }), TODAY),
    ).toMatchObject({
      kind: 'open',
      advanced: true,
      note: 'La inscripción se hace en el formulario de la actividad. Te lo abrimos con tus datos ya puestos.',
    });
  });

  it('con plaza: para uno mismo y para un hijo', () => {
    const reg = detail({ myRegistrationId: 'r1' });
    expect(signupAction(reg, TODAY)).toMatchObject({
      label: 'Ver mi inscripción',
      note: 'Ya tienes una inscripción para esta actividad.',
    });
    expect(signupAction(reg, TODAY, 'Lucía')).toMatchObject({
      label: 'Ver su inscripción',
      note: 'Lucía ya tiene una inscripción para esta actividad.',
    });
  });
});

describe('enlaces del cuerpo y mapa', () => {
  it('reparte cada enlace por su tipo; `javascript:` no enlaza', () => {
    expect(classifyBodyLink({ url: 'tel:+34600111222' }).kind).toBe('tel');
    expect(classifyBodyLink({ url: 'mailto:a@b.org' }).kind).toBe('mailto');
    expect(classifyBodyLink({ documentId: 'd1' })).toEqual({
      kind: 'document',
      documentId: 'd1',
    });
    const ours = classifyBodyLink({
      url: 'http://comunica.movimientoconsolacion.com/?internalpage=list_stic_events',
    });
    expect(ours.kind).toBe('comunica');
    expect(classifyBodyLink({ url: 'https://www.ejemplo.org/x' })).toEqual({
      kind: 'external',
      url: 'https://www.ejemplo.org/x',
    });
    expect(classifyBodyLink({ url: 'javascript:alert(1)' }).kind).toBe('none');
    expect(classifyBodyLink({ url: 'data:text/html,hola' }).kind).toBe('none');
  });

  it('el mapa: el enlace propio, o Mapas en iOS, geo: en Android y Google en web', () => {
    expect(mapLink({ url: 'https://maps.app.goo.gl/x' }, 'ios')).toBe(
      'https://maps.app.goo.gl/x',
    );
    expect(mapLink({ query: 'Calle Mayor 1' }, 'ios')).toBe(
      'https://maps.apple.com/?q=Calle%20Mayor%201',
    );
    expect(mapLink({ query: 'Calle Mayor 1' }, 'android')).toBe(
      'geo:0,0?q=Calle%20Mayor%201',
    );
    expect(mapLink({ query: 'Calle Mayor 1' }, 'web')).toContain(
      'google.com/maps',
    );
  });
});
