/**
 * Eventos y su ficha (plan 13, tareas 1 y 3), lógica pura: el plazo, las fechas en palabras, qué se ve en el listado y con qué chip y acción, la
 * acción de la ficha por su orden, a dónde lleva cada enlace del cuerpo y el contrato de los bloques.
 */
import fs from 'fs';
import path from 'path';
import {
  BodyBlock,
  EventDetail,
  ImageRef,
  type EventCard,
  type EventDetail as EventDetailT,
} from '@/services/comunica/contract';
import {
  cardAction,
  cardChip,
  cardPlazo,
  isPast,
  showSectionTitles,
  sortByStart,
  visibleActivities,
} from '@/utils/comunica/activityList';
import { classifyBodyHref, youtubeThumb } from '@/utils/comunica/bodyLinks';
import { capacityText, mapHref, priceText } from '@/utils/comunica/eventMap';
import { signupAction } from '@/utils/comunica/eventSignup';
import {
  cardWindowLine,
  detailWindowLine,
  windowChip,
  windowState,
} from '@/utils/comunica/eventWindow';
import { madridDay } from '@/utils/comunica/madrid';
import { dateRangeText, durationText } from '@/utils/comunica/recordDates';

const TODAY = '2026-11-01';
const card = (over: Partial<EventCard> = {}): EventCard => ({
  id: 'e1',
  name: 'Convivencia',
  startDate: '2026-11-20',
  endDate: '2026-11-22',
  place: 'El Pinar',
  statusLabel: 'Inscripciones abiertas',
  window: { opensOn: null, closesOn: null },
  hasAdvancedForm: false,
  myRegistrationId: null,
  myRegistrationStatus: null,
  ...over,
});

describe('el plazo', () => {
  it('los dos vacíos = abierta (regla de seguridad)', () => {
    expect(windowState({ opensOn: null, closesOn: null }, TODAY)).toBe('open');
  });
  it('antes del día de apertura = «antes»; con y sin fecha de cierre', () => {
    expect(windowState({ opensOn: '2026-11-05', closesOn: null }, TODAY)).toBe(
      'before',
    );
    expect(
      windowState({ opensOn: '2026-11-05', closesOn: '2026-12-01' }, TODAY),
    ).toBe('before');
    expect(windowState({ opensOn: '2026-11-01', closesOn: null }, TODAY)).toBe(
      'open',
    );
  });
  it('el día de cierre cuenta ENTERO: a las 23:59 de Madrid aún abierta; a las 00:00 del siguiente, cerrada', () => {
    const w = { opensOn: null, closesOn: '2026-11-10' };
    // 23:59 del 10 de noviembre en Madrid (UTC+1) = 22:59 UTC; 00:00 del 11 = 23:00 UTC.
    expect(windowState(w, madridDay(new Date('2026-11-10T22:59:00Z')))).toBe(
      'open',
    );
    expect(windowState(w, madridDay(new Date('2026-11-10T23:00:00Z')))).toBe(
      'closed',
    );
  });
  it('con el cambio de hora (último domingo de octubre) el día sigue entero', () => {
    const w = { opensOn: null, closesOn: '2026-10-25' };
    // El 25/10/2026 se pasa de +2 a +1. 23:59 de Madrid = 22:59 UTC; 00:00 del 26 = 23:00 UTC.
    expect(windowState(w, madridDay(new Date('2026-10-25T22:59:00Z')))).toBe(
      'open',
    );
    expect(windowState(w, madridDay(new Date('2026-10-25T23:00:00Z')))).toBe(
      'closed',
    );
  });
  it('el chip del plazo: cerrado apagado, «no abierta» info y abierta, ninguno', () => {
    expect(windowChip('closed')).toEqual({
      label: 'Inscripción cerrada',
      tone: 'neutral',
    });
    expect(windowChip('before')).toEqual({
      label: 'Inscripción no abierta',
      tone: 'info',
    });
    expect(windowChip('open')).toBeNull();
  });
  it('líneas de plazo: tarjeta y ficha (la ficha dice «Cerrada el …»)', () => {
    const w = { opensOn: '2026-11-05', closesOn: '2026-11-25' };
    expect(cardWindowLine(w, 'open')).toBe('Hasta el 25 de noviembre de 2026');
    expect(cardWindowLine(w, 'before')).toBe(
      'Se abre el 5 de noviembre de 2026',
    );
    expect(cardWindowLine(w, 'closed')).toBeNull();
    expect(detailWindowLine(w, 'closed')).toBe(
      'Cerrada el 25 de noviembre de 2026',
    );
    expect(
      cardWindowLine({ opensOn: null, closesOn: null }, 'open'),
    ).toBeNull();
  });
});

describe('fechas en palabras', () => {
  it('un día, mismo mes, meses distintos y años distintos', () => {
    expect(dateRangeText('2026-05-05', '2026-05-05')).toBe('5 de mayo de 2026');
    expect(dateRangeText('2026-05-05', null)).toBe('5 de mayo de 2026');
    expect(dateRangeText('2026-07-01', '2026-07-10')).toBe(
      'del 1 al 10 de julio de 2026',
    );
    expect(dateRangeText('2026-09-28', '2026-10-02')).toBe(
      'del 28 de septiembre de 2026 al 2 de octubre de 2026',
    );
    expect(dateRangeText('2026-12-30', '2027-01-02')).toBe(
      'del 30 de diciembre de 2026 al 2 de enero de 2027',
    );
    expect(dateRangeText(null, null)).toBeNull();
  });
  it('la duración solo de 2 a 31 días', () => {
    expect(durationText('2026-11-01', '2026-11-01')).toBeNull();
    expect(durationText('2026-11-01', '2026-11-02')).toBe('2 días');
    expect(durationText('2026-11-20', '2026-11-22')).toBe('3 días');
    expect(durationText('2026-11-01', '2026-12-01')).toBe('31 días');
    expect(durationText('2026-11-01', '2026-12-02')).toBeNull();
    expect(durationText('2026-11-01', null)).toBeNull();
  });
});

describe('el listado', () => {
  it('lo pasado se quita por la fecha de FIN; el que acaba hoy sigue; sin fechas se queda', () => {
    expect(
      isPast(card({ startDate: '2026-10-01', endDate: '2026-10-31' }), TODAY),
    ).toBe(true);
    expect(
      isPast(card({ startDate: '2026-10-30', endDate: TODAY }), TODAY),
    ).toBe(false);
    expect(
      isPast(card({ startDate: '2026-10-01', endDate: null }), TODAY),
    ).toBe(true);
    expect(isPast(card({ startDate: null, endDate: null }), TODAY)).toBe(false);
  });
  it('por inicio, el más cercano arriba; sin fecha, al final', () => {
    const a = card({ id: 'a', startDate: '2026-12-01' });
    const b = card({ id: 'b', startDate: '2026-11-05' });
    const c = card({ id: 'c', startDate: null, endDate: null });
    expect(sortByStart([c, a, b]).map((x) => x.id)).toEqual(['b', 'a', 'c']);
  });
  it('visibleActivities quita lo pasado de los dos bloques y ordena', () => {
    const v = visibleActivities(
      {
        toSignUp: [
          card({ id: 'p', startDate: '2026-10-01', endDate: '2026-10-02' }),
          card({ id: 'z', startDate: '2026-12-01' }),
          card({ id: 'y', startDate: '2026-11-03' }),
        ],
        signedUp: [
          card({ id: 's', startDate: '2026-10-05', endDate: '2026-10-06' }),
        ],
      },
      TODAY,
    );
    expect(v.toSignUp.map((x) => x.id)).toEqual(['y', 'z']);
    expect(v.signedUp).toEqual([]);
    expect(showSectionTitles(v)).toBe(false);
    expect(showSectionTitles({ toSignUp: [1], signedUp: [1] })).toBe(true);
  });
  it('el chip: «Con plaza» gana a todo; si está rechazada, su etiqueta en rojo', () => {
    const closed = { opensOn: null, closesOn: '2026-10-01' };
    expect(
      cardChip(card({ myRegistrationId: 'r', window: closed }), TODAY),
    ).toEqual({ label: 'Con plaza', tone: 'positive' });
    expect(
      cardChip(
        card({
          myRegistrationId: 'r',
          myRegistrationStatus: { label: 'Rechazada', tone: 'danger' },
        }),
        TODAY,
      ),
    ).toEqual({ label: 'Rechazada', tone: 'negative' });
    // Una inscripción de otro tono (pendiente) sigue siendo «Con plaza».
    expect(
      cardChip(
        card({
          myRegistrationId: 'r',
          myRegistrationStatus: { label: 'Pendiente', tone: 'warn' },
        }),
        TODAY,
      )?.label,
    ).toBe('Con plaza');
  });
  it('el chip del plazo gana a la etiqueta del CRM; con fechas y abierta, mandan las fechas', () => {
    expect(
      cardChip(
        card({ window: { opensOn: null, closesOn: '2026-10-01' } }),
        TODAY,
      )?.label,
    ).toBe('Inscripción cerrada');
    expect(
      cardChip(
        card({ window: { opensOn: '2026-11-10', closesOn: null } }),
        TODAY,
      )?.label,
    ).toBe('Inscripción no abierta');
    expect(
      cardChip(
        card({
          window: { opensOn: '2026-10-01', closesOn: '2026-12-01' },
          statusLabel: 'Cerrada',
        }),
        TODAY,
      ),
    ).toBeNull();
    // Sin fechas, la etiqueta del CRM en neutro.
    expect(cardChip(card(), TODAY)).toEqual({
      label: 'Inscripciones abiertas',
      tone: 'neutral',
    });
    expect(cardChip(card({ statusLabel: null }), TODAY)).toBeNull();
  });
  it('la tarjeta no repite el plazo cerrado ni el de lo inscrito', () => {
    expect(
      cardPlazo(
        card({ window: { opensOn: null, closesOn: '2026-10-01' } }),
        TODAY,
      ),
    ).toBeNull();
    expect(
      cardPlazo(
        card({
          myRegistrationId: 'r',
          window: { opensOn: null, closesOn: '2026-12-01' },
        }),
        TODAY,
      ),
    ).toBeNull();
    expect(
      cardPlazo(
        card({ window: { opensOn: null, closesOn: '2026-12-01' } }),
        TODAY,
      ),
    ).toBe('Hasta el 1 de diciembre de 2026');
  });
  it('la acción: «Mi inscripción» con plaza; «Inscribirme» abierta o sin fechas; fuera de plazo, ninguna', () => {
    expect(cardAction(card({ myRegistrationId: 'r' }), TODAY)).toEqual({
      kind: 'registration',
      label: 'Mi inscripción',
    });
    expect(cardAction(card(), TODAY)).toEqual({
      kind: 'signup',
      label: 'Inscribirme',
    });
    expect(
      cardAction(
        card({ window: { opensOn: null, closesOn: '2026-10-01' } }),
        TODAY,
      ),
    ).toBeNull();
    expect(
      cardAction(
        card({ window: { opensOn: '2026-11-10', closesOn: null } }),
        TODAY,
      ),
    ).toBeNull();
  });
});

describe('la acción de la ficha: pasado → plaza → audiencia → plazo → abierta', () => {
  const base = (
    over: Partial<EventDetailT> = {},
  ): Parameters<typeof signupAction>[0] => ({
    startDate: '2026-11-20',
    endDate: '2026-11-22',
    window: { opensOn: null, closesOn: null },
    myRegistrationId: null,
    hasAdvancedForm: false,
    signup: { audience: { ok: true } },
    ...over,
  });
  const no = {
    ok: false as const,
    reason: 'delegation' as const,
    message: 'Esta actividad es solo para la delegación de Burriana.',
  };
  it('pasado gana a todo', () => {
    expect(
      signupAction(
        base({
          startDate: '2026-10-01',
          endDate: '2026-10-02',
          myRegistrationId: 'r',
        }),
        TODAY,
        null,
      ),
    ).toEqual({
      kind: 'past',
      text: 'Esta actividad ya se ha celebrado.',
    });
  });
  it('con plaza, para uno mismo y para un hijo; a quien tiene plaza no se le dice que no es para él', () => {
    expect(
      signupAction(
        base({ myRegistrationId: 'r1', signup: { audience: no } }),
        TODAY,
        null,
      ),
    ).toEqual({
      kind: 'registered',
      registrationId: 'r1',
      text: 'Ya tienes una inscripción para esta actividad.',
      cta: 'Ver mi inscripción',
    });
    expect(
      signupAction(base({ myRegistrationId: 'r1' }), TODAY, 'Lucía'),
    ).toMatchObject({
      text: 'Lucía ya tiene una inscripción para esta actividad.',
      cta: 'Ver su inscripción',
    });
  });
  it('no es para ti: el motivo, ANTES que el plazo (a otra delegación no se le dice que llegó tarde)', () => {
    const a = signupAction(
      base({
        signup: { audience: no },
        window: { opensOn: null, closesOn: '2026-10-01' },
      }),
      TODAY,
      null,
    );
    expect(a).toEqual({
      kind: 'not_for_you',
      title: 'Esta actividad no es para ti',
      text: no.message,
      cta: 'Ver otras actividades',
    });
  });
  it('fuera de plazo, con y sin fecha', () => {
    expect(
      signupAction(
        base({ window: { opensOn: '2026-11-10', closesOn: null } }),
        TODAY,
        null,
      ),
    ).toMatchObject({
      kind: 'closed',
      title: 'La inscripción no está abierta',
      text: 'La inscripción se abre el 10 de noviembre de 2026.',
    });
    expect(
      signupAction(
        base({ window: { opensOn: null, closesOn: '2026-10-30' } }),
        TODAY,
        null,
      ),
    ).toMatchObject({
      text: 'El plazo de inscripción terminó el 30 de octubre de 2026.',
    });
  });
  it('abierta: la única principal; con formulario avanzado, la nota', () => {
    expect(signupAction(base(), TODAY, null)).toEqual({
      kind: 'open',
      label: 'Inscribirme en esta actividad',
      note: null,
    });
    expect(
      signupAction(base({ hasAdvancedForm: true }), TODAY, null),
    ).toMatchObject({
      note: 'La inscripción se hace en el formulario de la actividad. Te lo abrimos con tus datos ya puestos.',
    });
  });
});

describe('enlaces del cuerpo', () => {
  it('tel, mailto, documento, nuestro dominio (también con http), externo y lo que no se sabe abrir', () => {
    expect(classifyBodyHref({ url: 'tel:+34600111222' })).toEqual({
      kind: 'tel',
      url: 'tel:+34600111222',
    });
    expect(classifyBodyHref({ url: 'mailto:a@b.es' })).toEqual({
      kind: 'mailto',
      url: 'mailto:a@b.es',
    });
    expect(classifyBodyHref({ documentId: 'd1' })).toEqual({
      kind: 'document',
      documentId: 'd1',
    });
    expect(
      classifyBodyHref({
        url: 'http://comunica.movimientoconsolacion.com/actividades/?e=x',
      }),
    ).toEqual({
      kind: 'own',
      url: 'https://comunica.movimientoconsolacion.com/actividades/?e=x',
    });
    expect(
      classifyBodyHref({ url: 'https://comunica.movimientoconsolacion.com/x' })
        .kind,
    ).toBe('own');
    expect(classifyBodyHref({ url: 'https://example.org/a' })).toEqual({
      kind: 'external',
      url: 'https://example.org/a',
    });
    for (const bad of [
      'javascript:alert(1)',
      'data:text/html,hola',
      'intent://x#Intent;end',
      'ftp://x.es',
      'comunica.movimientoconsolacion.com.evil.org',
      'tel:abc',
      'mailto:',
    ])
      expect(classifyBodyHref({ url: bad }).kind).toBe('none');
    // Un dominio que solo CONTIENE el nuestro no es el nuestro.
    expect(
      classifyBodyHref({
        url: 'https://comunica.movimientoconsolacion.com.evil.org/x',
      }).kind,
    ).toBe('external');
  });
  it('la miniatura de YouTube', () => {
    expect(youtubeThumb('abc')).toBe(
      'https://img.youtube.com/vi/abc/hqdefault.jpg',
    );
  });
});

describe('el mapa, las plazas y el precio', () => {
  it('con enlace propio, ese; con búsqueda, la app de mapas de cada plataforma', () => {
    expect(mapHref({ url: 'https://maps.example.org/x' }, 'ios')).toBe(
      'https://maps.example.org/x',
    );
    expect(mapHref({ url: 'javascript:1' }, 'ios')).toBeNull();
    expect(mapHref({ query: 'Calle Mayor 3' }, 'ios')).toBe(
      'https://maps.apple.com/?q=Calle%20Mayor%203',
    );
    expect(mapHref({ query: 'Calle Mayor 3' }, 'android')).toBe(
      'geo:0,0?q=Calle%20Mayor%203',
    );
    expect(mapHref({ query: 'Calle Mayor 3' }, 'web')).toContain(
      'google.com/maps',
    );
  });
  it('plazas y precio solo si hay un dato (un 0 no lo es)', () => {
    expect(capacityText(60)).toBe('60 plazas');
    expect(capacityText(0)).toBeNull();
    expect(capacityText(null)).toBeNull();
    expect(priceText(45)).toBe('45 €');
    expect(priceText(12.5)).toBe('12,50 €');
    expect(priceText(0)).toBeNull();
    expect(priceText(null)).toBeNull();
  });
});

describe('contrato de los bloques', () => {
  const t = (v: string) => ({ t: 'text' as const, v });
  const ok: unknown[] = [
    { type: 'heading', level: 1, text: [t('a')] },
    { type: 'heading', level: 2, text: [t('a')] },
    {
      type: 'paragraph',
      text: [
        t('a'),
        { t: 'bold', c: [t('b')] },
        { t: 'italic', c: [t('c')] },
        { t: 'break' },
        { t: 'link', href: { url: 'tel:1' }, c: [t('d')] },
      ],
    },
    { type: 'notice', text: [t('a')] },
    {
      type: 'list',
      ordered: true,
      start: 1,
      items: [[t('a')]],
      children: { 0: { ordered: false, items: [[t('b')]] } },
    },
    { type: 'button', label: 'x', href: { documentId: 'd' } },
    { type: 'image', src: { documentId: 'd' }, caption: 'c', alt: 'a' },
    { type: 'image', src: { url: 'https://example.org/a.jpg' } },
    {
      type: 'gallery',
      images: [{ documentId: 'd' }, { url: 'https://example.org/b.jpg' }],
    },
    { type: 'video', provider: 'youtube', id: 'x', url: 'https://youtu.be/x' },
    { type: 'divider' },
  ];
  it('parsea un ejemplo de cada tipo de bloque', () => {
    for (const b of ok) expect(BodyBlock.safeParse(b).success).toBe(true);
  });
  it('rechaza un bloque con HTML, un tipo desconocido y una imagen que no es https', () => {
    expect(
      BodyBlock.safeParse({
        type: 'paragraph',
        text: [t('a')],
        html: '<b>x</b>',
      }).success,
    ).toBe(false);
    expect(
      BodyBlock.safeParse({ type: 'html', html: '<b>x</b>' }).success,
    ).toBe(false);
    expect(
      BodyBlock.safeParse({ type: 'paragraph', html: '<b>x</b>' }).success,
    ).toBe(false);
    expect(ImageRef.safeParse({ url: 'javascript:alert(1)' }).success).toBe(
      false,
    );
    expect(ImageRef.safeParse({ url: 'ftp://x.es/a.png' }).success).toBe(false);
  });
  it('ningún campo del contrato de este bloque es de HTML', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'services/comunica/contract.ts'),
      'utf8',
    );
    const block = src
      .slice(
        src.indexOf('Familias: eventos y su ficha'),
        src.indexOf('`POST /v1/auth/code`'),
      )
      .split('\n')
      .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .join('\n');
    expect(block).not.toMatch(
      /\b(html|innerHTML|dangerouslySetInnerHTML)\b\s*[:?]/i,
    );
    expect(Object.keys(EventDetail.shape)).not.toContain('html');
  });
});
