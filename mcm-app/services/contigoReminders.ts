// services/contigoReminders.ts
//
// Programa en el móvil los recordatorios de Contigo con `expo-notifications`
// (avisos LOCALES: no pasan por el servidor ni por el Panel). En web no hay
// nada de esto: `contigoReminders.web.ts`.
//
// Qué se programa y por qué así: ver `utils/contigoReminders.ts`. Aquí solo
// está el pegamento: leer la configuración y los hábitos de AsyncStorage,
// pedir el plan y volcarlo al sistema.
//
// `syncContigoReminders()` es idempotente y barata: borra todo lo que empiece
// por `contigo-rem-` y vuelve a programar el plan. Se llama al abrir la app,
// al volver a primer plano, al tocar un ajuste y al marcar un hábito como
// hecho (para que a ese hábito no le queden avisos hoy).

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
  CONTIGO_HABITS_KEY,
  CONTIGO_REMINDERS_KEY,
} from '@/constants/contigoStorage';
import { CONTIGO_REMINDERS_CHANNEL_ID } from '@/constants/notificationChannels';
import {
  readNoticePermission,
  requestNoticePermission,
  type NoticePermission,
} from '@/services/comunica/localNotices';
import {
  REMINDER_ID_PREFIX,
  anyReminderEnabled,
  defaultReminderConfig,
  normalizeReminderConfig,
  planReminders,
  type ReminderConfig,
} from '@/utils/contigoReminders';
import { logger } from '@/utils/logger';

/** ¿Hay recordatorios locales en esta plataforma? */
export const reminderNoticesAvailable = true;

export type { NoticePermission };
export { readNoticePermission, requestNoticePermission };

export async function loadReminderConfig(): Promise<ReminderConfig> {
  try {
    const stored = await AsyncStorage.getItem(CONTIGO_REMINDERS_KEY);
    return stored
      ? normalizeReminderConfig(JSON.parse(stored))
      : defaultReminderConfig();
  } catch (e) {
    logger.warn('[contigo] no se han podido leer los recordatorios', e);
    return defaultReminderConfig();
  }
}

export async function saveReminderConfig(
  config: ReminderConfig,
): Promise<void> {
  try {
    await AsyncStorage.setItem(CONTIGO_REMINDERS_KEY, JSON.stringify(config));
  } catch (e) {
    logger.warn('[contigo] no se han podido guardar los recordatorios', e);
  }
}

async function readHabitRecords() {
  try {
    const stored = await AsyncStorage.getItem(CONTIGO_HABITS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/** Quita del sistema todo lo que programó Contigo (y solo eso). */
export async function cancelContigoReminders(): Promise<void> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      all
        .filter((n) => n.identifier.startsWith(REMINDER_ID_PREFIX))
        .map((n) =>
          Notifications.cancelScheduledNotificationAsync(n.identifier),
        ),
    );
  } catch (e) {
    logger.warn('[contigo] no se han podido cancelar los recordatorios', e);
  }
}

// Una sola sincronización a la vez: dos seguidas (marcar un hábito justo al
// abrir la app) no pueden intercalar sus «borrar» y «programar».
let queue: Promise<void> = Promise.resolve();

async function runSync(now: Date): Promise<void> {
  const config = await loadReminderConfig();
  await cancelContigoReminders();
  if (!anyReminderEnabled(config)) return;
  // Sin permiso no se programa nada: se retomará solo al concederlo y volver a
  // la app (lo llama `ContigoRemindersBackground`).
  if ((await readNoticePermission()) !== 'granted') return;

  const plan = planReminders(config, await readHabitRecords(), now);
  for (const r of plan) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: r.id,
        content: { title: r.title, body: r.body, data: r.data },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: r.at,
          channelId: CONTIGO_REMINDERS_CHANNEL_ID,
        },
      });
    } catch (e) {
      logger.warn('[contigo] no se ha podido programar un recordatorio', e);
    }
  }
}

/** Recalcula y reprograma los recordatorios. Nunca rechaza. */
export function syncContigoReminders(now: Date = new Date()): Promise<void> {
  queue = queue.then(() => runSync(now)).catch(() => {});
  return queue;
}
