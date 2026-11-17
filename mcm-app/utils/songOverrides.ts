/**
 * Lo que un administrador acaba de editar, visto YA en su móvil.
 *
 * Un cambio guardado va al cantoral (NAS → GitHub → Firebase) y la app lo
 * recibe cuando se publica y se vuelve a abrir. Mientras, quien lo ha editado
 * tiene que ver su versión: se guarda aquí, por fichero, y se pone encima de
 * la del catálogo al abrir la canción. Caduca sola a las 48 h, o antes si el
 * catálogo ya trae lo mismo.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@song_editor_overrides';
const TTL_MS = 48 * 3600_000;

export interface SongOverride {
  at: number;
  title?: string;
  author?: string;
  key?: string;
  capo?: number;
  info?: string;
  content?: string;
}

let overrides: Record<string, SongOverride> = {};
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribeSongOverrides(listener: () => void): () => void {
  listeners.add(listener);
  if (!loaded) {
    loaded = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const now = Date.now();
        const stored = JSON.parse(raw) as Record<string, SongOverride>;
        for (const [file, o] of Object.entries(stored)) {
          if (o && now - o.at < TTL_MS && !overrides[file]) overrides[file] = o;
        }
        emit();
      })
      .catch(() => {});
  }
  return () => {
    listeners.delete(listener);
  };
}

export function setSongOverride(
  filename: string,
  fields: Omit<SongOverride, 'at'>,
): void {
  overrides = {
    ...overrides,
    [filename]: { ...overrides[filename], ...fields, at: Date.now() },
  };
  AsyncStorage.setItem(KEY, JSON.stringify(overrides)).catch(() => {});
  emit();
}

/** La canción con lo editado encima (o la misma, si no hay nada). */
export function withSongOverride<
  T extends { filename?: string; content?: string },
>(song: T): T {
  const o = song.filename ? overrides[song.filename] : undefined;
  if (!o || Date.now() - o.at > TTL_MS) return song;
  const { at: _at, ...fields } = o;
  return { ...song, ...fields };
}

/** Solo para tests. */
export function __resetSongOverrides() {
  overrides = {};
  loaded = false;
}
