// services/comunica/localNotices.web.ts
//
// En web no hay avisos del área: ni permiso de push ni avisos locales
// (plan 08). Misma forma que `localNotices.ts`, sin `expo-notifications`; la
// pantalla «Avisos en este móvil» lo dice con calma.

import type { ComunicaPushData } from './contract';
import type { OutboxEntry } from './outbox';
import type { OutboxReminder } from '@/utils/comunica/outboxReminder';

export const OUTBOX_NOTICE_ID = 'comunica-outbox';
export const localNoticesAvailable = false;

export type NoticePermission =
  'granted' | 'denied' | 'undetermined' | 'unavailable';

export async function readNoticePermission(): Promise<NoticePermission> {
  return 'unavailable';
}
export async function requestNoticePermission(): Promise<NoticePermission> {
  return 'unavailable';
}
export async function cancelOutboxReminder(): Promise<void> {}
export async function scheduleOutboxReminder(
  _r: OutboxReminder,
): Promise<void> {}
export async function applyOutboxReminder(
  _moment: 'foreground' | 'background',
  _entries: readonly OutboxEntry[],
  _enabled: boolean,
  _now?: Date,
): Promise<void> {}
export async function cancelAreaNotices(): Promise<void> {}
export async function scheduleSampleNotice(
  _data: ComunicaPushData,
  _seconds?: number,
): Promise<void> {}
