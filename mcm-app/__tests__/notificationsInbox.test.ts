import {
  dayGroupKey,
  groupByDay,
  groupByReadState,
  isInboxRead,
  mergeInbox,
  notificationDetailHref,
  toRows,
} from '@/utils/notificationsInbox';
import { devNotificationsFixture } from '@/utils/devFirebaseFixtures';
import type {
  NotificationData,
  ReceivedNotification,
} from '@/types/notifications';

// Miércoles 12:00 (hora local): hace margen por delante y por detrás.
const NOW = new Date(2026, 10, 11, 12, 0, 0);
const at = (days: number, hours = 0) =>
  new Date(NOW.getTime() - days * 86400000 - hours * 3600000).toISOString();

const remote = (
  id: string,
  title: string,
  createdAt: string,
  extra: Partial<NotificationData> = {},
): NotificationData => ({
  id,
  title,
  body: `cuerpo ${title}`,
  createdAt,
  ...extra,
});

const local = (
  id: string,
  title: string,
  receivedAt: string,
  extra: Partial<ReceivedNotification> = {},
): ReceivedNotification => ({
  id,
  title,
  body: `cuerpo ${title}`,
  receivedAt,
  isRead: false,
  ...extra,
});

describe('mergeInbox', () => {
  it('ordena de más nueva a más vieja mezclando local y remoto', () => {
    const out = mergeInbox(
      [local('l1', 'B', at(1))],
      [remote('r1', 'A', at(0, 1)), remote('r2', 'C', at(3))],
      new Set(),
    );
    expect(out.map((n) => n.id)).toEqual(['r1', 'l1', 'r2']);
  });

  it('quita las descartadas por id y por contenido', () => {
    const out = mergeInbox(
      [local('l1', 'B', at(1))],
      [remote('r1', 'A', at(0, 1)), remote('r2', 'C', at(3))],
      new Set(['r1', 'C|cuerpo C']),
    );
    expect(out.map((n) => n.id)).toEqual(['l1']);
  });

  it('deduplica por contenido (gana la local) y le completa bodyLong', () => {
    const out = mergeInbox(
      [local('l1', 'A', at(0, 2))],
      [remote('r1', 'A', at(0, 2), { bodyLong: 'largo' })],
      new Set(),
    );
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('l1');
    expect(out[0].bodyLong).toBe('largo');
  });

  it('deduplica por id aunque cambie el contenido', () => {
    const out = mergeInbox(
      [local('x', 'A', at(0, 2))],
      [remote('x', 'Otro título', at(0, 3))],
      new Set(),
    );
    expect(out).toHaveLength(1);
  });
});

describe('isInboxRead', () => {
  it('lee por id, por isRead y por antigüedad', () => {
    expect(isInboxRead(remote('a', 'A', at(0)), new Set(['a']), NOW)).toBe(
      true,
    );
    expect(
      isInboxRead(local('b', 'B', at(0), { isRead: true }), new Set(), NOW),
    ).toBe(true);
    expect(isInboxRead(remote('c', 'C', at(61)), new Set(), NOW)).toBe(true);
    expect(isInboxRead(remote('d', 'D', at(59)), new Set(), NOW)).toBe(false);
  });
});

describe('agrupación por día', () => {
  it('clasifica Hoy, Ayer, Esta semana y Anteriores', () => {
    expect(dayGroupKey(new Date(NOW.getTime() - 60000), NOW)).toBe('today');
    expect(dayGroupKey(new Date(at(1)), NOW)).toBe('yesterday');
    expect(dayGroupKey(new Date(at(4)), NOW)).toBe('week');
    expect(dayGroupKey(new Date(at(7)), NOW)).toBe('older');
  });

  it('no pinta grupos vacíos y aplana con cabeceras', () => {
    const items = mergeInbox(
      [],
      [remote('a', 'A', at(0, 1)), remote('b', 'B', at(10))],
      new Set(),
    );
    const groups = groupByDay(items, NOW);
    expect(groups.map((g) => g.title)).toEqual(['Hoy', 'Anteriores']);
    const rows = toRows(groups);
    expect(rows.map((r) => r.type)).toEqual([
      'header',
      'item',
      'header',
      'item',
    ]);
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
  });
});

describe('agrupación por estado (Nuevas / Anteriores)', () => {
  const items = mergeInbox(
    [],
    [
      remote('a', 'A', at(0, 1)),
      remote('b', 'B', at(1)),
      remote('c', 'C', at(2)),
    ],
    new Set(),
  );

  it('pone arriba las no leídas y debajo las leídas, sin perder ninguna', () => {
    const groups = groupByReadState(items, (n) => n.id === 'b');
    expect(groups.map((g) => g.title)).toEqual(['Nuevas', 'Anteriores']);
    expect(groups[0].items.map((n) => n.id)).toEqual(['a', 'c']);
    expect(groups[1].items.map((n) => n.id)).toEqual(['b']);
  });

  it('omite la sección vacía', () => {
    expect(groupByReadState(items, () => true).map((g) => g.key)).toEqual([
      'read',
    ]);
    expect(groupByReadState(items, () => false).map((g) => g.key)).toEqual([
      'new',
    ]);
  });
});

describe('notificationDetailHref', () => {
  it('codifica el id', () => {
    expect(notificationDetailHref('a b/c')).toBe('/notifications/a%20b%2Fc');
  });
});

describe('datos de prueba de notificaciones', () => {
  const fixture = devNotificationsFixture(NOW.getTime());

  it('tienen ids únicos y fechas válidas', () => {
    const ids = fixture.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    fixture.forEach((n) =>
      expect(Number.isNaN(Date.parse(n.createdAt))).toBe(false),
    );
  });

  it('cubren los cuatro grupos de día y una de más de 60 días', () => {
    const groups = groupByDay(
      mergeInbox([], fixture as unknown as NotificationData[], new Set()),
      NOW,
    );
    expect(groups.map((g) => g.key)).toEqual([
      'today',
      'yesterday',
      'week',
      'older',
    ]);
    expect(
      fixture.some((n) =>
        isInboxRead(n as unknown as NotificationData, new Set(), NOW),
      ),
    ).toBe(true);
  });

  it('incluyen los casos de la interfaz: imagen, 3 botones, evento y audiencia', () => {
    expect(fixture.some((n) => 'imageUrl' in n && 'actionButtons' in n)).toBe(
      true,
    );
    expect(fixture.some((n) => 'eventId' in n)).toBe(true);
    expect(fixture.filter((n) => 'audience' in n)).toHaveLength(2);
  });
});
