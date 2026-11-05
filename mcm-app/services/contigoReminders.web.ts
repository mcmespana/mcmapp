// services/contigoReminders.web.ts
//
// En web no hay avisos locales (ni permiso de notificaciones de la app): la
// configuración se guarda igual, pero no se programa nada. Misma forma que
// `contigoReminders.ts`, sin `expo-notifications`.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONTIGO_REMINDERS_KEY } from '@/constants/contigoStorage';
import {
  defaultReminderConfig,
  normalizeReminderConfig,
  type ReminderConfig,
} from '@/utils/contigoReminders';

export const reminderNoticesAvailable = false;

export type NoticePermission =
  'granted' | 'denied' | 'undetermined' | 'unavailable';

export async function readNoticePermission(): Promise<NoticePermission> {
  return 'unavailable';
}
export async function requestNoticePermission(): Promise<NoticePermission> {
  return 'unavailable';
}

export async function loadReminderConfig(): Promise<ReminderConfig> {
  try {
    const stored = await AsyncStorage.getItem(CONTIGO_REMINDERS_KEY);
    return stored
      ? normalizeReminderConfig(JSON.parse(stored))
      : defaultReminderConfig();
  } catch {
    return defaultReminderConfig();
  }
}

export async function saveReminderConfig(
  config: ReminderConfig,
): Promise<void> {
  try {
    await AsyncStorage.setItem(CONTIGO_REMINDERS_KEY, JSON.stringify(config));
  } catch {}
}

export async function cancelContigoReminders(): Promise<void> {}
export async function syncContigoReminders(_now?: Date): Promise<void> {}
