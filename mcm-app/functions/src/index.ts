/**
 * Cloud Functions del proyecto MCM App.
 *
 * Por ahora la única función es `purgeExpiredShares`: barre /playlistShares
 * y /choirSessions y borra entradas cuyo `expiresAt` ya pasó.
 *
 * Despliegue:
 *   cd mcm-app && firebase deploy --only functions
 *
 * Requisitos:
 *   - Proyecto en plan Blaze (las scheduled functions lo exigen).
 *   - `firebase use --add` ejecutado al menos una vez en mcm-app/ para
 *     vincular el proyecto.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import { initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

initializeApp();

const PLAYLIST_ROOT = 'playlistShares';
const CHOIR_ROOT = 'choirSessions';

/**
 * Recorre `path` y devuelve los IDs cuyo `expiresAt` (epoch ms) está en el
 * pasado. Maneja ausencia del campo (no borra) y formato inesperado (ignora).
 */
async function collectExpired(path: string, now: number): Promise<string[]> {
  const snap = await getDatabase().ref(path).once('value');
  if (!snap.exists()) return [];
  const root = snap.val() as Record<string, unknown>;
  const expired: string[] = [];
  for (const [id, value] of Object.entries(root)) {
    if (!value || typeof value !== 'object') continue;
    const expiresAt = (value as { expiresAt?: unknown }).expiresAt;
    if (typeof expiresAt !== 'number') continue;
    if (expiresAt < now) expired.push(id);
  }
  return expired;
}

export const purgeExpiredShares = onSchedule(
  {
    schedule: 'every 24 hours',
    timeZone: 'Europe/Madrid',
    region: 'us-central1',
    retryCount: 0,
  },
  async () => {
    const now = Date.now();
    const [expiredPlaylists, expiredSessions] = await Promise.all([
      collectExpired(PLAYLIST_ROOT, now),
      collectExpired(CHOIR_ROOT, now),
    ]);

    const updates: Record<string, null> = {};
    for (const code of expiredPlaylists) {
      updates[`${PLAYLIST_ROOT}/${code}`] = null;
    }
    for (const code of expiredSessions) {
      updates[`${CHOIR_ROOT}/${code}`] = null;
    }

    if (Object.keys(updates).length === 0) {
      logger.info('Nothing to purge', {
        playlists: 0,
        sessions: 0,
      });
      return;
    }

    await getDatabase().ref().update(updates);
    logger.info('Purged expired entries', {
      playlists: expiredPlaylists.length,
      sessions: expiredSessions.length,
    });
  },
);
