// Plan 08, tarea 6: «Tienes N listas sin subir», el aviso que programa la
// propia app. Las reglas (puras) y el gancho con `expo-notifications` simulado.

import * as Notifications from 'expo-notifications';
import type { OutboxEntry, OutboxStatus } from '@/services/comunica/outbox';
import {
  outboxReminder,
  reminderTime,
  unsentLists,
} from '@/utils/comunica/outboxReminder';
import { madridInstant, madridTime } from '@/utils/comunica/madrid';
import {
  applyOutboxReminder,
  cancelAreaNotices,
  OUTBOX_NOTICE_ID,
} from '@/services/comunica/localNotices';
import { ComunicaPushData } from '@/services/comunica/contract';

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('id')),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  getAllScheduledNotificationsAsync: jest.fn(() =>
    Promise.resolve([
      { identifier: 'comunica-outbox' },
      { identifier: 'comunica-muestra-rollcall_due' },
      { identifier: 'otra-cosa' },
    ]),
  ),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval' },
}));

let n = 0;
const entry = (kind: string, status: OutboxStatus): OutboxEntry => ({
  key: `${kind}:${(n += 1)}`,
  kind,
  payload: {},
  clientId: `c-${n}`,
  meta: {},
  status,
  attempts: 0,
  createdAt: 0,
  updatedAt: 0,
  nextAttemptAt: 0,
});
const ID = () => '3b241101-e2bb-4255-8caf-000000000001';
// Martes 27/10/2026 a las 10:00 de Madrid.
const TUESDAY_10 = new Date(madridInstant('2026-10-27', '10:00'));

describe('unsentLists', () => {
  it('solo cuenta listas (grupo, evento y monitores) sin subir', () => {
    expect(
      unsentLists([
        entry('roll', 'pending'),
        entry('event-roll', 'failed'),
        entry('monitors-roll', 'stuck'),
        entry('roll', 'applied'),
        entry('notice', 'pending'),
        entry('scarf', 'failed'),
        entry('device', 'pending'),
      ]),
    ).toEqual({ count: 3, stuck: 1 });
  });
});

describe('reminderTime', () => {
  it('a la hora de irse la app', () => {
    expect(madridTime(reminderTime(TUESDAY_10).toISOString())).toBe('11:00');
  });

  it('a las 21:50 → a las 8:30 del día siguiente', () => {
    const at = reminderTime(new Date(madridInstant('2026-10-27', '21:50')));
    expect(at.toISOString()).toBe(
      new Date(madridInstant('2026-10-28', '08:30')).toISOString(),
    );
  });

  it('de madrugada → a las 8:30 de ese mismo día', () => {
    const at = reminderTime(new Date(madridInstant('2026-10-28', '06:00')));
    expect(at.toISOString()).toBe(
      new Date(madridInstant('2026-10-28', '08:30')).toISOString(),
    );
  });

  it('a las 7:45 → 8:45 (ya fuera de la noche)', () => {
    const at = reminderTime(new Date(madridInstant('2026-10-28', '07:45')));
    expect(madridTime(at.toISOString())).toBe('08:45');
  });
});

describe('outboxReminder', () => {
  it('sin listas sin subir, nada', () => {
    expect(
      outboxReminder([entry('notice', 'pending')], TUESDAY_10, ID),
    ).toBeNull();
  });

  it('singular y plural', () => {
    expect(
      outboxReminder([entry('roll', 'pending')], TUESDAY_10, ID),
    ).toMatchObject({
      title: 'Tienes 1 lista sin subir',
      body: 'Abre la app con cobertura y se suben solas.',
    });
    expect(
      outboxReminder(
        [entry('roll', 'pending'), entry('event-roll', 'failed')],
        TUESDAY_10,
        ID,
      )?.title,
    ).toBe('Tienes 2 listas sin subir');
  });

  it('con alguna atascada, a abrirla', () => {
    expect(
      outboxReminder(
        [entry('roll', 'pending'), entry('roll', 'stuck')],
        TUESDAY_10,
        ID,
      ),
    ).toMatchObject({
      title: 'Una lista no se ha podido subir',
      body: 'Ábrela para ver qué ha pasado.',
    });
  });

  it('lleva un `data` del contrato que va a la portada', () => {
    const r = outboxReminder([entry('roll', 'pending')], TUESDAY_10, ID)!;
    expect(ComunicaPushData.parse(r.data)).toMatchObject({
      type: 'outbox_pending',
      source: 'comunica',
    });
  });
});

describe('el gancho con expo-notifications', () => {
  beforeEach(() => jest.clearAllMocks());

  it('al irse con listas: uno, con id fijo y canal comunica-listas', async () => {
    await applyOutboxReminder(
      'background',
      [entry('roll', 'pending')],
      true,
      TUESDAY_10,
    );
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const arg = (Notifications.scheduleNotificationAsync as jest.Mock).mock
      .calls[0][0];
    expect(arg.identifier).toBe(OUTBOX_NOTICE_ID);
    expect(arg.trigger.channelId).toBe('comunica-listas');
    expect(arg.content.title).toBe('Tienes 1 lista sin subir');
  });

  it('al volver, con la cola vacía o con el interruptor apagado: se cancela', async () => {
    await applyOutboxReminder('foreground', [entry('roll', 'pending')], true);
    await applyOutboxReminder('background', [], true);
    await applyOutboxReminder('background', [entry('roll', 'pending')], false);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(
      Notifications.cancelScheduledNotificationAsync,
    ).toHaveBeenCalledTimes(3);
  });

  it('al salir se cancela todo lo del área y nada más', async () => {
    await cancelAreaNotices();
    const ids = (
      Notifications.cancelScheduledNotificationAsync as jest.Mock
    ).mock.calls.map((c) => c[0]);
    expect(ids.sort()).toEqual([
      'comunica-muestra-rollcall_due',
      'comunica-outbox',
    ]);
  });
});

describe('guardarraíl: los avisos locales tienen su versión web', () => {
  const fs = jest.requireActual<typeof import('fs')>('fs');
  const path = jest.requireActual<typeof import('path')>('path');
  const read = (f: string) =>
    fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
  const exportsOf = (src: string) =>
    [...src.matchAll(/^export (?:async )?(?:function|const|type) (\w+)/gm)]
      .map((m) => m[1])
      .sort();

  it('sin expo-notifications y con las mismas piezas', () => {
    const web = read('services/comunica/localNotices.web.ts');
    expect(web).not.toMatch(/from 'expo-notifications'/);
    expect(exportsOf(web)).toEqual(
      exportsOf(read('services/comunica/localNotices.ts')),
    );
  });
});
