/**
 * Pasar lista en un evento (plan 07): el caso estrella de punta a punta (sin
 * cobertura con la cola de verdad), qué día se marca y los guardarraíles de
 * sus pantallas.
 */
import fs from 'fs';
import path from 'path';
import { createFakeServer } from '@/services/comunica/fake';
import { createOutbox } from '@/services/comunica/outbox';
import { ROUTES, type EventRollWrite } from '@/services/comunica/contract';
import { nativeHrefFor } from '@/services/comunica/links';
import { memoryBackend, setStorageBackend } from '@/services/comunica/storage';
import {
  eventDraftFrom,
  eventRollQueueKey,
  pickEventDay,
  toEventRollWrite,
} from '@/utils/comunica/eventRoll';

const MORNING = '2026-11-14T08:30:00Z';
const TODAY = '2026-11-14';
const ROOT = path.join(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

beforeEach(() => setStorageBackend(memoryBackend()));

describe('el autobús sin cobertura', () => {
  it('lista guardada, sin red, marcar, guardar, reconectar: aplicada y con la sesión nueva', async () => {
    const s = createFakeServer({ latencyMs: 0, clock: MORNING });
    // La lista se leyó con cobertura (la precarga).
    const roll = await s.getEventRoll('f-ev-excursion');
    expect(roll.sessions).toEqual([]);
    const pick = pickEventDay(roll, undefined, new Date(MORNING));
    expect(pick.session).toBeNull();
    expect(pick.locked).toBe(false);

    // Sin red, en la puerta del autobús.
    s.setControls({ offline: true });
    const draft = eventDraftFrom(roll, `new-${pick.day}`);
    const [a, b] = roll.people;
    draft.marks[a.person.id] = 'yes';
    draft.marks[b.person.id] = 'no_justified';
    draft.notes[b.person.id] = 'Está malo';
    const body = toEventRollWrite(draft, roll.people, null, pick.day);
    const key = eventRollQueueKey(roll.event.id, null, pick.day);
    const outbox = createOutbox({
      personId: 'p',
      handlers: {
        'event-roll': (e) =>
          s.saveEventRoll(e.meta.eventId, {
            ...(e.payload as Omit<EventRollWrite, 'clientId'>),
            clientId: e.clientId,
          }),
      },
      schedule: () => undefined,
    });
    await outbox.load();
    await outbox.enqueue({
      key,
      kind: 'event-roll',
      payload: body,
      clientId: '6a1f3c20-7d4e-4b8a-9c2d-000000000107',
      meta: { eventId: roll.event.id, date: pick.day, label: 'Excursión' },
    });
    await outbox.flush();
    expect(outbox.get(key)?.status).toBe('pending');

    // Vuelve la cobertura.
    s.setControls({ offline: false });
    await outbox.wake();
    expect(outbox.get(key)?.status).toBe('applied');

    const after = await s.getEventRoll('f-ev-excursion');
    expect(after.sessions).toHaveLength(1);
    expect(after.sessions[0].date).toBe(TODAY);
    expect(after.marksBySession[after.sessions[0].id]).toEqual({
      [a.person.id]: { mark: 'yes' },
      [b.person.id]: { mark: 'no_justified', reason: 'Está malo' },
    });
    // Y ahora la regla abre esa sesión.
    expect(pickEventDay(after, undefined, new Date(MORNING)).session?.id).toBe(
      after.sessions[0].id,
    );
    outbox.dispose();
  });
});

describe('qué día se marca', () => {
  const event = {
    id: 'e',
    name: 'E',
    startDate: '2026-11-13',
    endDate: '2026-11-15',
    startsAt: '2026-11-13T10:00:00+01:00',
    endsAt: '2026-11-15T18:00:00+01:00',
  };
  const session = (id: string, date: string) => ({
    id,
    eventId: 'e',
    date,
    startsAt: `${date}T10:00:00+01:00`,
    endsAt: `${date}T11:00:00+01:00`,
    kind: 'event' as const,
  });

  it('sin días en el CRM: hoy, solo si cae dentro de sus fechas', () => {
    const inside = pickEventDay(
      { event, sessions: [] },
      undefined,
      new Date(MORNING),
    );
    expect(inside).toMatchObject({ session: null, day: TODAY, locked: false });
    expect(inside.notice?.text).toBe(
      'Este evento no tiene días en el CRM. Al guardar se crea la lista del sábado 14 de noviembre.',
    );
    const outside = pickEventDay(
      { event, sessions: [] },
      undefined,
      new Date('2026-11-20T08:00:00Z'),
    );
    expect(outside.locked).toBe(true);
  });

  it('otro día que no es hoy: lo dice', () => {
    const p = pickEventDay(
      { event, sessions: [session('a', '2026-11-13')] },
      undefined,
      new Date(MORNING),
    );
    expect(p.session?.id).toBe('a');
    expect(p.notice?.text).toBe(
      'Es la lista del viernes 13 de noviembre, 10:00.',
    );
  });

  it('un día posterior se ve, pero no se marca', () => {
    const p = pickEventDay(
      {
        event,
        sessions: [session('a', '2026-11-13'), session('b', '2026-11-15')],
      },
      'b',
      new Date(MORNING),
    );
    expect(p.locked).toBe(true);
  });
});

describe('guardarraíles de Eventos', () => {
  it('una pestaña de grupos no marca a nadie', () => {
    const src = read('components/comunica/eventos/ActivityTabView.tsx');
    expect(src).not.toMatch(/MarkControl|RollRow|MarkSheet|setDraft/);
  });

  it('la lista del evento usa la fila y la hoja de Pasar Lista', () => {
    const src = read('components/comunica/eventos/EventRollList.tsx');
    expect(src).toMatch(/from '\.\.\/pasar-lista\/RollRow'/);
    expect(src).toMatch(/from '\.\.\/pasar-lista\/MarkSheet'/);
    // Por cursos y por grupos es la MISMA lista: la clave de la cola no
    // depende de cómo se reparte.
    expect(src).toMatch(
      /eventRollQueueKey\(roll\.event\.id, sessionId, pick\.day\)/,
    );
  });

  it('el contrato no escribe grupos de actividad', () => {
    const writes = Object.entries(ROUTES).filter(
      ([, r]) => r.method !== 'GET' && /activity|group/i.test(r.path),
    );
    expect(writes.map(([name]) => name)).not.toContain('saveActivityGroup');
    expect(
      Object.values(ROUTES).some(
        (r) => r.method !== 'GET' && r.path.includes('activity'),
      ),
    ).toBe(false);
  });

  it('la lista de un evento se guarda en el móvil; la escritura, no', () => {
    expect(ROUTES.events.persist).toBe(true);
    expect(ROUTES.eventRoll.persist).toBe(true);
    expect(ROUTES.saveEventRoll.persist).toBe(false);
  });

  it('la página del plugin abre lo nativo', () => {
    expect(
      nativeHrefFor({ internalpage: 'single_stic_pasar_lista_evento' }),
    ).toEqual({ pathname: '/comunica/eventos' });
    expect(
      nativeHrefFor({
        internalpage: 'single_stic_pasar_lista_evento',
        id: 'x1',
      }),
    ).toEqual({
      pathname: '/comunica/eventos/[eventId]',
      params: { eventId: 'x1' },
    });
  });
});
