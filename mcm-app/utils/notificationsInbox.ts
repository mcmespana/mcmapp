/**
 * Lógica pura de la bandeja de notificaciones (sin React ni almacenamiento).
 *
 * Antes la bandeja eran DOS implementaciones paralelas (la hoja de la campana
 * y la pantalla `/notifications`) que fusionaban, deduplicaban y decidían qué
 * está leído cada una a su manera: la hoja no filtraba las descartadas, así que
 * lo que borrabas en una reaparecía en la otra. Ahora hay una sola, y esta es
 * su parte testeable.
 */
import type {
  NotificationData,
  ReceivedNotification,
} from '@/types/notifications';

export type InboxNotification = NotificationData | ReceivedNotification;

/** Ruta del detalle de una notificación (`/notifications/[id]`). */
export function notificationDetailHref(id: string): string {
  return `/notifications/${encodeURIComponent(id)}`;
}

/** Pasados estos días, una notificación se da por leída sin preguntar. */
export const AUTO_READ_AFTER_DAYS = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Fecha de una notificación: `receivedAt` si es local, `createdAt` si remota. */
export function notificationDate(n: InboxNotification): Date {
  return new Date('receivedAt' in n ? n.receivedAt : n.createdAt);
}

/** Clave de contenido con la que se casan copias de distinto origen. */
export function contentKey(n: Pick<InboxNotification, 'title' | 'body'>) {
  return `${n.title}|${n.body}`;
}

/**
 * Junta el historial local y el de Firebase: quita las descartadas (por id o
 * por contenido), ordena de más nueva a más vieja y deduplica por id o por
 * contenido. Gana la primera aparición (las locales van delante porque su
 * `isRead` es más fiable) y se le completa `bodyLong` si solo la trae la otra
 * copia.
 */
export function mergeInbox(
  local: ReceivedNotification[],
  remote: NotificationData[],
  dismissed: ReadonlySet<string>,
): InboxNotification[] {
  const visible = [...local, ...remote]
    .filter((n) => !dismissed.has(n.id) && !dismissed.has(contentKey(n)))
    .sort(
      (a, b) => notificationDate(b).getTime() - notificationDate(a).getTime(),
    );

  const result: InboxNotification[] = [];
  const indexByKey = new Map<string, number>();
  const indexById = new Map<string, number>();

  for (const n of visible) {
    const key = contentKey(n);
    const existing =
      (n.id ? indexById.get(n.id) : undefined) ?? indexByKey.get(key);
    if (existing !== undefined) {
      const kept = result[existing];
      if (!kept.bodyLong && n.bodyLong) {
        result[existing] = { ...kept, bodyLong: n.bodyLong };
      }
      continue;
    }
    result.push(n);
    const idx = result.length - 1;
    indexByKey.set(key, idx);
    if (n.id) indexById.set(n.id, idx);
  }
  return result;
}

export function isOlderThanAutoRead(n: InboxNotification, now = new Date()) {
  const date = notificationDate(n);
  if (Number.isNaN(date.getTime())) return false;
  return now.getTime() - date.getTime() > AUTO_READ_AFTER_DAYS * DAY_MS;
}

/** ¿Está leída? Por id, por su propio `isRead` o por antigua. */
export function isInboxRead(
  n: InboxNotification,
  readIds: ReadonlySet<string>,
  now = new Date(),
): boolean {
  if (readIds.has(n.id)) return true;
  if ('isRead' in n && n.isRead) return true;
  return isOlderThanAutoRead(n, now);
}

export type DayGroupKey = 'today' | 'yesterday' | 'week' | 'older';

export type ReadGroupKey = 'new' | 'read';

export interface DayGroup {
  key: DayGroupKey | ReadGroupKey;
  title: string;
  items: InboxNotification[];
}

const GROUP_TITLES: Record<DayGroupKey, string> = {
  today: 'Hoy',
  yesterday: 'Ayer',
  week: 'Esta semana',
  older: 'Anteriores',
};

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function dayGroupKey(date: Date, now: Date): DayGroupKey {
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return 'week';
  return 'older';
}

/** Agrupa (ya ordenadas) por día; omite los grupos vacíos. */
export function groupByDay(
  items: InboxNotification[],
  now = new Date(),
): DayGroup[] {
  const groups: Record<DayGroupKey, InboxNotification[]> = {
    today: [],
    yesterday: [],
    week: [],
    older: [],
  };
  for (const n of items) groups[dayGroupKey(notificationDate(n), now)].push(n);
  return (['today', 'yesterday', 'week', 'older'] as DayGroupKey[])
    .filter((key) => groups[key].length > 0)
    .map((key) => ({ key, title: GROUP_TITLES[key], items: groups[key] }));
}

/**
 * La bandeja se ordena por ESTADO, no por fecha: arriba lo que está sin leer
 * («Nuevas») y debajo lo ya leído («Anteriores»). Nada se borra: leer una
 * notificación solo la baja de una sección a la otra. Cada sección conserva el
 * orden de más nueva a más vieja, y se omite la que esté vacía.
 */
export function groupByReadState(
  items: InboxNotification[],
  isRead: (n: InboxNotification) => boolean,
): DayGroup[] {
  const fresh = items.filter((n) => !isRead(n));
  const done = items.filter((n) => isRead(n));
  const groups: DayGroup[] = [];
  if (fresh.length > 0)
    groups.push({ key: 'new', title: 'Nuevas', items: fresh });
  if (done.length > 0)
    groups.push({ key: 'read', title: 'Anteriores', items: done });
  return groups;
}

/** Elemento de la lista plana: o cabecera de grupo, o notificación. */
export type InboxRow =
  | { type: 'header'; key: string; title: string }
  | { type: 'item'; key: string; notification: InboxNotification };

export function toRows(groups: DayGroup[]): InboxRow[] {
  const rows: InboxRow[] = [];
  for (const g of groups) {
    rows.push({ type: 'header', key: `h-${g.key}`, title: g.title });
    g.items.forEach((n, i) =>
      rows.push({
        type: 'item',
        key: n.id ? `n-${n.id}` : `n-${g.key}-${i}`,
        notification: n,
      }),
    );
  }
  return rows;
}
