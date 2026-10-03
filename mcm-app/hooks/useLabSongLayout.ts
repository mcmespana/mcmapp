/**
 * Laboratorio (canal preview): ¿pintar la letra con la maquetación antigua?
 *
 * Existe para comparar en el móvil la maquetación de octubre de 2026 (palabras
 * que saltan enteras, sangría francesa, hueco tras el acorde) con la de antes.
 * Solo vale con el canal preview activado: fuera de él siempre es la nueva,
 * aunque se quedara guardado `true` de una prueba anterior.
 *
 * Estado de módulo + `useSyncExternalStore`: el detalle y la pantalla completa
 * lo leen a la vez y tienen que cambiar juntos. Se guarda en AsyncStorage para
 * que la comparación aguante entre canción y canción.
 *
 * Cuando se decida, se borra este hook y la clase `layout-legacy` de
 * `useSongProcessor`.
 */
import { useCallback, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePreviewChannel } from '@/contexts/PreviewChannelContext';

const STORAGE_KEY = '@mcm_lab_song_legacy_layout';

let legacy = false;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!hydrated) {
    hydrated = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw === '1' && !legacy) {
          legacy = true;
          emit();
        }
      })
      .catch(() => {});
  }
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => legacy;

export function useLabSongLayout() {
  const { enabled } = usePreviewChannel();
  const stored = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setLegacy = useCallback((next: boolean) => {
    legacy = next;
    emit();
    AsyncStorage.setItem(STORAGE_KEY, next ? '1' : '0').catch(() => {});
  }, []);

  return {
    /** El conmutador solo existe en el canal preview. */
    available: enabled,
    legacyLayout: enabled && stored,
    setLegacyLayout: setLegacy,
  };
}
