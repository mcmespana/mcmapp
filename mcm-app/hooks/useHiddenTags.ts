/**
 * Etiquetas que la persona ha ocultado de SU cantoral (p. ej. «Consolación»
 * si no es de esa casa).
 *
 * Ocultar una etiqueta la quita de la hoja de etiquetas, de las candidatas
 * para combinar y de la ficha de las canciones. Las canciones NO se ocultan:
 * siguen en sus categorías y en el buscador. Es una preferencia de este
 * dispositivo, en AsyncStorage; no se sube a ningún sitio.
 *
 * Estado de módulo + `useSyncExternalStore`: la hoja, la lista y la ficha lo
 * leen a la vez y tienen que cambiar juntas.
 */
import { useCallback, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@mcm_hidden_tags_v1';

let hidden: ReadonlySet<string> = new Set();
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
        const parsed = raw ? JSON.parse(raw) : null;
        if (Array.isArray(parsed) && parsed.length > 0) {
          hidden = new Set(parsed.filter((s) => typeof s === 'string'));
          emit();
        }
      })
      .catch(() => {});
  }
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => hidden;

export function useHiddenTags() {
  const hiddenSlugs = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const toggleHidden = useCallback((slug: string) => {
    const next = new Set(hidden);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    hidden = next;
    emit();
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...next])).catch(
      () => {},
    );
  }, []);

  return { hiddenSlugs, toggleHidden };
}
