/**
 * Historial de lo cantado por «mi coro», para decidir al montar la playlist:
 * ¿esta la hemos cantado mucho este curso?, ¿la cantamos hace nada?
 *
 * Se enciende y se apaga (se recuerda). Apagado no lee nada. Encendido lee el
 * coro una vez (se refresca cada 10 min) y, para las playlists de antes de que
 * existiera el registro, su contenido — una sola vez por playlist y versión,
 * guardado en el móvil.
 */
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMyChoir } from '@/hooks/useMyChoir';
import { fetchChoir } from '@/services/choirDirectoryService';
import { fetchCloudPlaylist } from '@/services/cloudPlaylistService';
import {
  buildSongHistory,
  mergeSungEntries,
  schoolYearStart,
  type SongHistory,
  type SungEntry,
} from '@/utils/choirHistory';
import { logger } from '@/utils/logger';

const ENABLED_KEY = '@choir_history_on';
const LEGACY_KEY = '@choir_history_legacy_v1';
const TTL_MS = 10 * 60_000;

type Listener = () => void;
const listeners = new Set<Listener>();
let enabledState: boolean | null = null;
const cache = new Map<
  string,
  { at: number; history: Map<string, SongHistory> }
>();
const inflight = new Map<string, Promise<void>>();

function emit() {
  listeners.forEach((l) => l());
}

async function load(choirId: string): Promise<void> {
  const choir = await fetchChoir(choirId);
  if (!choir) return;
  const now = Date.now();
  const since = schoolYearStart(now);
  const logged = new Set(choir.log.map((e) => e.code));

  // Playlists sin apunte (anteriores al registro): su contenido, cacheado.
  let stored: Record<string, { updatedAt: number; songs: string[] }> = {};
  try {
    stored = JSON.parse((await AsyncStorage.getItem(LEGACY_KEY)) ?? '{}');
  } catch {
    stored = {};
  }
  const legacy: SungEntry[] = [];
  let dirty = false;
  for (const entry of Object.values(choir.playlists)) {
    if (logged.has(entry.code) || entry.updatedAt < since) continue;
    const key = `${choirId}:${entry.code}`;
    let known = stored[key];
    if (!known || known.updatedAt !== entry.updatedAt) {
      try {
        const playlist = await fetchCloudPlaylist(entry.code);
        known = {
          updatedAt: entry.updatedAt,
          songs: (playlist?.songs ?? []).map((s) => s.filename),
        };
        stored[key] = known;
        dirty = true;
      } catch (e) {
        logger.warn('choir history: playlist', entry.code, e);
        continue;
      }
    }
    legacy.push({ at: entry.updatedAt, code: entry.code, songs: known.songs });
  }
  if (dirty) {
    AsyncStorage.setItem(LEGACY_KEY, JSON.stringify(stored)).catch(() => {});
  }
  cache.set(choirId, {
    at: now,
    history: buildSongHistory(mergeSungEntries(choir.log, legacy), now),
  });
  emit();
}

function ensure(choirId: string) {
  const hit = cache.get(choirId);
  if (hit && Date.now() - hit.at < TTL_MS) return;
  if (inflight.has(choirId)) return;
  const p = load(choirId)
    .catch((e) => logger.warn('choir history', e))
    .finally(() => inflight.delete(choirId));
  inflight.set(choirId, p);
}

/** Tras guardar en el coro: que el historial cuente lo nuevo. */
export function invalidateChoirHistory(choirId: string) {
  cache.delete(choirId);
  emit();
}

export function useChoirHistory() {
  const { choir } = useMyChoir();
  const [, bump] = useState(0);

  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    if (enabledState === null) {
      AsyncStorage.getItem(ENABLED_KEY)
        .then((v) => {
          if (enabledState === null) {
            enabledState = v === '1';
            emit();
          }
        })
        .catch(() => {});
    }
    return () => {
      listeners.delete(l);
    };
  }, []);

  const enabled = !!choir && enabledState === true;
  const choirId = choir?.id;
  useEffect(() => {
    if (enabled && choirId) ensure(choirId);
  });

  const setEnabled = useCallback((next: boolean) => {
    enabledState = next;
    AsyncStorage.setItem(ENABLED_KEY, next ? '1' : '0').catch(() => {});
    emit();
  }, []);

  const history = enabled && choirId ? cache.get(choirId)?.history : undefined;

  return {
    /** Hay coro elegido: se puede ofrecer el interruptor. */
    available: !!choir,
    enabled,
    setEnabled,
    /** Aún leyendo por primera vez. */
    loading: enabled && !history,
    history,
  };
}
