// services/comunica/localNotices.ts
//
// Los avisos LOCALES del área (plan 08), los que programa el propio móvil con
// `expo-notifications` (ya está en la app; no hace falta paquete nuevo):
//
//   · «Tienes N listas sin subir»: identificador fijo `comunica-outbox`, canal
//     `comunica-listas`. Uno como mucho; se reprograma o se cancela.
//   · «Simular aviso» del Laboratorio Alpha: el `data` de cada tipo a los 5 s,
//     para probar los destinos sin servidor (también en el simulador de iOS,
//     donde los push no llegan y los locales sí).
//
// Y el estado del permiso, para la pantalla «Avisos en este móvil». En web no
// hay nada de esto: `localNotices.web.ts`.

import * as Notifications from 'expo-notifications';
import { COMUNICA_CHANNEL_IDS, type ComunicaPushData } from './contract';
import type { OutboxEntry } from './outbox';
import {
  outboxReminder,
  type OutboxReminder,
} from '@/utils/comunica/outboxReminder';
import { uuidV4 } from '@/utils/comunica/uuid';
import { logger } from '@/utils/logger';

/** El identificador fijo del recordatorio de listas sin subir. */
export const OUTBOX_NOTICE_ID = 'comunica-outbox';
/** Prefijo de todo lo que programa el área (para cancelarlo al salir). */
const AREA_PREFIX = 'comunica-';

/** ¿Hay avisos locales en esta plataforma? */
export const localNoticesAvailable = true;

export type NoticePermission =
  'granted' | 'denied' | 'undetermined' | 'unavailable';

/** El permiso de notificaciones de la app (el mismo para todo: no se pide otro). */
export async function readNoticePermission(): Promise<NoticePermission> {
  try {
    const res = (await Notifications.getPermissionsAsync()) as {
      granted?: boolean;
      status?: string;
      canAskAgain?: boolean;
      ios?: { status?: number };
    };
    if (res?.granted) return 'granted';
    // iOS provisional: notificaciones silenciosas concedidas implícitamente.
    if (res?.ios?.status === 3) return 'granted';
    if (res?.status === 'denied' || res?.canAskAgain === false) return 'denied';
    return 'undetermined';
  } catch {
    return 'unavailable';
  }
}

/** Pide el permiso (el diálogo del sistema). Devuelve cómo ha quedado. */
export async function requestNoticePermission(): Promise<NoticePermission> {
  try {
    await Notifications.requestPermissionsAsync();
  } catch {}
  return readNoticePermission();
}

export async function cancelOutboxReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(OUTBOX_NOTICE_ID);
  } catch (e) {
    logger.warn('[comunica] no se ha podido cancelar el aviso local', e);
  }
}

/** Programa (o reprograma) el recordatorio de listas sin subir. */
export async function scheduleOutboxReminder(r: OutboxReminder): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(OUTBOX_NOTICE_ID);
    await Notifications.scheduleNotificationAsync({
      identifier: OUTBOX_NOTICE_ID,
      content: { title: r.title, body: r.body, data: r.data },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: r.at,
        channelId: COMUNICA_CHANNEL_IDS.rollCall,
      },
    });
  } catch (e) {
    logger.warn('[comunica] no se ha podido programar el aviso local', e);
  }
}

/**
 * El gancho del recordatorio (lo llama `ComunicaBackground`): al volver a la
 * app o con el interruptor apagado, se cancela; al irse a segundo plano, se
 * programa si hay listas sin subir (y si no, se cancela).
 */
export async function applyOutboxReminder(
  moment: 'foreground' | 'background',
  entries: readonly OutboxEntry[],
  enabled: boolean,
  now: Date = new Date(),
): Promise<void> {
  const r =
    moment === 'background' && enabled
      ? outboxReminder(entries, now, uuidV4)
      : null;
  if (r) await scheduleOutboxReminder(r);
  else await cancelOutboxReminder();
}

/** Al salir: nada del área se queda programado en el móvil. */
export async function cancelAreaNotices(): Promise<void> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      all
        .filter((n) => n.identifier.startsWith(AREA_PREFIX))
        .map((n) =>
          Notifications.cancelScheduledNotificationAsync(n.identifier),
        ),
    );
  } catch {
    await cancelOutboxReminder();
  }
}

/** Lo que dice cada aviso de prueba: los textos que mandará el servidor. */
const SAMPLE_TEXT: Record<
  ComunicaPushData['type'],
  { title: string; body: string }
> = {
  rollcall_due: {
    title: '¿Has pasado lista?',
    body: 'Si ya la tienes en el móvil, ábrela y se sube sola.',
  },
  group_changed: {
    title: 'Novedades en tu grupo',
    body: '1 chaval nuevo y 1 baja',
  },
  outbox_pending: {
    title: 'Tienes 1 lista sin subir',
    body: 'Abre la app con cobertura y se suben solas.',
  },
};

/** «Simular aviso» (Laboratorio Alpha): ese tipo, a los `seconds`. */
export async function scheduleSampleNotice(
  data: ComunicaPushData,
  seconds = 5,
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: `${AREA_PREFIX}muestra-${data.type}`,
    content: { ...SAMPLE_TEXT[data.type], data },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      channelId:
        data.type === 'group_changed'
          ? COMUNICA_CHANNEL_IDS.groups
          : COMUNICA_CHANNEL_IDS.rollCall,
    },
  });
}
