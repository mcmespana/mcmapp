import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Representa una canción seleccionada por el usuario en su playlist actual.
 *
 *  - `transpose`: semitonos sobre el tono original (positivo sube, negativo
 *    baja). Se persiste por canción dentro de la selección. Si el usuario
 *    abre la canción desde fuera de la selección, este valor no aplica
 *    (la pantalla de detalle vuelve a un transpose efímero local).
 *  - `order`: posición global asignada cuando el usuario reordena
 *    libremente. En modo "por categoría" se ignora.
 *  - `categoryHint`: clave de la categoría original (p. ej. "entrada").
 *    Se rellena cuando se conoce y se usa como agrupador por defecto y
 *    como pista para el agrupado tras una importación.
 */
export interface SelectedSong {
  filename: string;
  transpose: number;
  order: number;
  categoryHint?: string;
  addedAt: number;
}

/** Forma persistida en AsyncStorage. */
interface StoredPlaylist {
  version: 2;
  songs: SelectedSong[];
}

const STORAGE_KEY = '@mcm_playlist_v2';
const LEGACY_STORAGE_KEY = '@mcm_selected_songs_v1';

interface SelectedSongsContextType {
  /** Lista de canciones seleccionadas, ya ordenada por `order` ascendente. */
  selectedSongs: SelectedSong[];
  /** Filenames en el mismo orden, para compatibilidad con código existente. */
  selectedFilenames: string[];
  /** Carga inicial desde AsyncStorage en curso. */
  isHydrated: boolean;

  isSongSelected: (filename: string) => boolean;
  getSelectedSong: (filename: string) => SelectedSong | undefined;

  addSong: (
    filename: string,
    opts?: { transpose?: number; categoryHint?: string },
  ) => void;
  removeSong: (filename: string) => void;
  clearSelection: () => void;
  setTranspose: (filename: string, transpose: number) => void;

  /** Mueve la canción `filename` a la posición destino `toIndex` (0-based). */
  moveSong: (filename: string, toIndex: number) => void;
  /** Reemplaza completamente la playlist (importar, sincronización coro…). */
  replaceAll: (songs: SelectedSong[]) => void;
}

const SelectedSongsContext = createContext<
  SelectedSongsContextType | undefined
>(undefined);

interface SelectedSongsProviderProps {
  children: ReactNode;
}

/** Reordena `order` para que sean enteros consecutivos empezando en 0. */
function normalizeOrder(songs: SelectedSong[]): SelectedSong[] {
  return [...songs]
    .sort((a, b) => a.order - b.order || a.addedAt - b.addedAt)
    .map((s, i) => ({ ...s, order: i }));
}

export const SelectedSongsProvider: React.FC<SelectedSongsProviderProps> = ({
  children,
}) => {
  const [selectedSongs, setSelectedSongsState] = useState<SelectedSong[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const hydrationDone = useRef(false);

  // Hidratar desde AsyncStorage en el primer render.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as StoredPlaylist;
          if (parsed && parsed.version === 2 && Array.isArray(parsed.songs)) {
            if (!cancelled) {
              setSelectedSongsState(normalizeOrder(parsed.songs));
            }
          }
        } else {
          // Migración tolerante desde el formato antiguo (array de strings).
          const legacy = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
          if (legacy) {
            try {
              const arr = JSON.parse(legacy);
              if (Array.isArray(arr)) {
                const now = Date.now();
                const migrated: SelectedSong[] = arr.map(
                  (filename: string, i: number) => ({
                    filename,
                    transpose: 0,
                    order: i,
                    addedAt: now + i,
                  }),
                );
                if (!cancelled) {
                  setSelectedSongsState(migrated);
                }
              }
            } catch {
              // ignorar
            }
            await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
          }
        }
      } catch (e) {
        console.error('Error hidratando playlist seleccionada', e);
      } finally {
        if (!cancelled) {
          hydrationDone.current = true;
          setIsHydrated(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persistencia tras cada cambio (ya hidratada).
  useEffect(() => {
    if (!hydrationDone.current) return;
    const stored: StoredPlaylist = { version: 2, songs: selectedSongs };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stored)).catch((e) => {
      console.error('Error guardando playlist seleccionada', e);
    });
  }, [selectedSongs]);

  const selectedSongsMap = useMemo(() => {
    const m = new Map<string, SelectedSong>();
    selectedSongs.forEach((s) => m.set(s.filename, s));
    return m;
  }, [selectedSongs]);

  const selectedFilenames = useMemo(
    () => selectedSongs.map((s) => s.filename),
    [selectedSongs],
  );

  const isSongSelected = useCallback(
    (filename: string) => selectedSongsMap.has(filename),
    [selectedSongsMap],
  );

  const getSelectedSong = useCallback(
    (filename: string) => selectedSongsMap.get(filename),
    [selectedSongsMap],
  );

  const addSong = useCallback<SelectedSongsContextType['addSong']>(
    (filename, opts) => {
      setSelectedSongsState((prev) => {
        if (prev.some((s) => s.filename === filename)) return prev;
        const next: SelectedSong = {
          filename,
          transpose: opts?.transpose ?? 0,
          order: prev.length,
          categoryHint: opts?.categoryHint,
          addedAt: Date.now(),
        };
        return [...prev, next];
      });
    },
    [],
  );

  const removeSong = useCallback((filename: string) => {
    setSelectedSongsState((prev) =>
      normalizeOrder(prev.filter((s) => s.filename !== filename)),
    );
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSongsState([]);
  }, []);

  const setTranspose = useCallback((filename: string, transpose: number) => {
    // Normalizamos a (-11..+11). Octavas completas no aportan nada.
    let t = transpose;
    if (t >= 12 || t <= -12) t = t % 12;
    setSelectedSongsState((prev) =>
      prev.map((s) => (s.filename === filename ? { ...s, transpose: t } : s)),
    );
  }, []);

  const moveSong = useCallback((filename: string, toIndex: number) => {
    setSelectedSongsState((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const fromIndex = sorted.findIndex((s) => s.filename === filename);
      if (fromIndex < 0) return prev;
      const clamped = Math.max(0, Math.min(toIndex, sorted.length - 1));
      if (clamped === fromIndex) return prev;
      const [moved] = sorted.splice(fromIndex, 1);
      sorted.splice(clamped, 0, moved);
      return sorted.map((s, i) => ({ ...s, order: i }));
    });
  }, []);

  const replaceAll = useCallback((songs: SelectedSong[]) => {
    setSelectedSongsState(normalizeOrder(songs));
  }, []);

  const contextValue = useMemo<SelectedSongsContextType>(
    () => ({
      selectedSongs,
      selectedFilenames,
      isHydrated,
      isSongSelected,
      getSelectedSong,
      addSong,
      removeSong,
      clearSelection,
      setTranspose,
      moveSong,
      replaceAll,
    }),
    [
      selectedSongs,
      selectedFilenames,
      isHydrated,
      isSongSelected,
      getSelectedSong,
      addSong,
      removeSong,
      clearSelection,
      setTranspose,
      moveSong,
      replaceAll,
    ],
  );

  return (
    <SelectedSongsContext.Provider value={contextValue}>
      {children}
    </SelectedSongsContext.Provider>
  );
};

export const useSelectedSongs = (): SelectedSongsContextType => {
  const context = useContext(SelectedSongsContext);
  if (context === undefined) {
    throw new Error(
      'useSelectedSongs must be used within a SelectedSongsProvider',
    );
  }
  return context;
};
