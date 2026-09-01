import { logger } from '@/utils/logger';
import Animated from 'react-native-reanimated';
import { useTabListScroll } from '@/components/tabs/useTabScroll';
import EmptyState from '@/components/ui/EmptyState';
import { useState, useMemo, useLayoutEffect, useCallback, useRef } from 'react';
import {
  FlatList,
  Text,
  View,
  StyleSheet,
  Platform,
  Share,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { filterSongsData } from '@/utils/filterSongsData';
import { useSelectedSongs } from '@/contexts/SelectedSongsContext';
import SongListItem from '../../components/SongListItem';
import BottomSheet from '@/components/BottomSheet';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  extractSongMedia,
  mediaKinds,
  type MediaLink,
} from '@/types/songMedia';
import { useSongTagIndex } from '@/hooks/useSongTags';
import TagContextBar from '@/components/song-tags/TagContextBar';
import TagCloudSheet from '@/components/song-tags/TagCloudSheet';
import {
  coOccurringTags,
  parseTagCategoryId,
  resolveTag,
  songHasAllTags,
  songTagSlugs,
  tagsTitle,
  type ResolvedTag,
  type SongTagIndex,
} from '@/utils/songTags';
import { h } from '@/utils/haptics';

interface Song {
  title: string;
  filename: string;
  author?: string;
  key?: string;
  capo?: number;
  info?: string;
  content?: string;
  // Campos multimedia (viajan desde Firebase para el cajón + indicador de lista).
  album?: string;
  liturgicalTime?: string;
  source?: string;
  rhythm?: string;
  videoEmbed?: string;
  youtubeLinks?: MediaLink[];
  audioLinks?: MediaLink[];
  originalCategoryKey?: string;
  numericFilenamePart?: string;
  sortTitle?: string;
  searchableText?: string;
  tags?: string[];
  /** Solo en modo etiqueta: título de la categoría a la que pertenece. */
  groupTitle?: string;
}

interface SongCategory {
  categoryTitle: string;
  songs: Song[];
}

/** Fila de la lista: una canción o la cabecera de una categoría. */
type ListRow =
  | { kind: 'section'; key: string; title: string; count: number }
  | { kind: 'song'; key: string; song: Song };

const getSongsData = (data: any): Record<string, SongCategory> => {
  try {
    if (data === null) return {};
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return data as Record<string, SongCategory>;
    }
    if (Array.isArray(data)) {
      return { All: { categoryTitle: 'All', songs: data } };
    }
    logger.error('Unexpected songs data format:', data);
    return {};
  } catch (error) {
    logger.error('Error parsing songs data:', error);
    return {};
  }
};

const isIOS = Platform.OS === 'ios';

/**
 * Texto sobre el que busca el buscador. Además del título y el autor incluye
 * los LABELS de las etiquetas de la canción, así buscar "ramos" saca también
 * las canciones etiquetadas aunque no lleven la palabra en el título.
 */
function makeSearchableText(song: Song, tagIndex?: SongTagIndex): string {
  const base = `${song.title || ''} ${song.author || ''}`;
  if (!tagIndex) return base.toLowerCase();
  const slugs = songTagSlugs(song, tagIndex.aliases);
  if (slugs.length === 0) return base.toLowerCase();
  const labels = slugs
    .map((slug) => `${slug} ${resolveTag(slug, tagIndex).label}`)
    .join(' ');
  return `${base} ${labels}`.toLowerCase();
}

/**
 * Lista de una ETIQUETA (o del cruce de varias, en AND): las canciones que la
 * llevan, agrupadas por categoría y en el orden normal del cantoral.
 *
 * Precisamente porque una etiqueta es transversal, la categoría es el contexto
 * que falta: sin ella la lista es un batiburrillo sin jerarquía.
 */
function buildTagSongList(
  songsData: Record<string, SongCategory>,
  slugs: string[],
  tagIndex: SongTagIndex,
): { songs: Song[]; error: string | null } {
  const categoryKeys = Object.keys(songsData).sort((a, b) =>
    (songsData[a]?.categoryTitle ?? a).localeCompare(
      songsData[b]?.categoryTitle ?? b,
    ),
  );

  const out: Song[] = [];
  for (const categoryKey of categoryKeys) {
    const category = songsData[categoryKey];
    const categorySongs = Array.isArray(category?.songs) ? category.songs : [];
    const matching = categorySongs
      .filter((song) => songHasAllTags(song, slugs, tagIndex.aliases))
      .map((song) => {
        const titleMatch = song.title.match(/^(\d{1,3})\.\s*/);
        let numericPart = '';
        if (titleMatch && titleMatch[1]) {
          numericPart = titleMatch[1].padStart(2, '0');
        } else {
          const filenameMatch = song.filename?.match(/_(\d+)\.html$/);
          if (filenameMatch && filenameMatch[1]) {
            numericPart = filenameMatch[1].padStart(2, '0');
          }
        }
        return {
          ...song,
          // La categoría REAL (no la letra): la usa el detalle para saber de
          // dónde viene la canción.
          originalCategoryKey: categoryKey,
          groupTitle: category.categoryTitle ?? categoryKey,
          numericFilenamePart: numericPart,
          searchableText: makeSearchableText(song, tagIndex),
        };
      });

    matching.sort((a, b) => {
      const numA = parseInt(a.numericFilenamePart, 10) || Infinity;
      const numB = parseInt(b.numericFilenamePart, 10) || Infinity;
      if (numA !== numB) return numA - numB;
      return a.title.localeCompare(b.title);
    });
    out.push(...matching);
  }

  return { songs: out, error: null };
}

/** Corta una lista YA ordenada por categoría en filas de sección + canción. */
function toGroupedRows(songs: Song[]): ListRow[] {
  const rows: ListRow[] = [];
  let currentTitle: string | null = null;
  let headerIndex = -1;

  songs.forEach((song) => {
    const title = song.groupTitle ?? '';
    if (title !== currentTitle) {
      currentTitle = title;
      headerIndex = rows.length;
      rows.push({
        kind: 'section',
        key: `section-${song.originalCategoryKey ?? title}`,
        title,
        count: 0,
      });
    }
    const header = rows[headerIndex];
    if (header.kind === 'section') header.count += 1;
    rows.push({ kind: 'song', key: song.filename, song });
  });

  return rows;
}

/**
 * Construye la lista de canciones de una categoría —o de TODAS, con
 * `__ALL__`— ya ordenada y con los campos derivados que usan el buscador y el
 * índice alfabético.
 *
 * Es una función PURA. Antes esto vivía dentro de un `useEffect` declarado
 * `async` que en realidad no esperaba a nada: la lista se copiaba a estado y
 * se recalculaba con un render de más por cada cambio de categoría.
 */
function buildSongList(
  songsData: Record<string, SongCategory>,
  categoryId: string,
  tagIndex?: SongTagIndex,
): { songs: Song[]; error: string | null } {
  try {
    if (categoryId === '__ALL__') {
      const allSongs: Song[] = [];
      for (const originalCategoryKey in songsData) {
        if (
          !Object.prototype.hasOwnProperty.call(songsData, originalCategoryKey)
        ) {
          continue;
        }
        const categorySongs = songsData[originalCategoryKey].songs;
        const categoryTitle = songsData[originalCategoryKey].categoryTitle;
        const categoryLetterMatch = categoryTitle.match(/^[A-Za-z]/);
        const categoryLetter = categoryLetterMatch
          ? categoryLetterMatch[0].toUpperCase()
          : originalCategoryKey.charAt(0).toUpperCase();

        const songsWithMetadata = categorySongs.map((song) => {
          const titleMatch = song.title.match(/^(\d{1,3})\.\s*/);
          let numericPart = '';
          if (titleMatch && titleMatch[1]) {
            numericPart = String(parseInt(titleMatch[1], 10));
          } else {
            const filenameMatch = song.filename.match(/_(\d+)\.html$/);
            if (filenameMatch && filenameMatch[1]) {
              numericPart = String(parseInt(filenameMatch[1], 10));
            }
          }
          // Pre-calculate the clean title for sorting (Schwartzian transform)
          const sortTitle = song.title.replace(/^\d+\.\s*/, '').toLowerCase();
          const searchableText = makeSearchableText(song, tagIndex);
          return {
            ...song,
            originalCategoryKey: categoryLetter,
            numericFilenamePart: numericPart,
            sortTitle,
            searchableText,
          };
        });
        allSongs.push(...songsWithMetadata);
      }
      allSongs.sort((a, b) => {
        const titleA = a.sortTitle || a.title;
        const titleB = b.sortTitle || b.title;
        return titleA.localeCompare(titleB);
      });
      return { songs: allSongs, error: null };
    }

    const categoryKey = Object.keys(songsData).find(
      (key) => key.trim().toLowerCase() === categoryId.trim().toLowerCase(),
    );
    if (!categoryKey) {
      return { songs: [], error: `Categoría '${categoryId}' no encontrada` };
    }

    const categorySongs = songsData[categoryKey].songs;
    if (!categorySongs || !Array.isArray(categorySongs)) {
      return {
        songs: [],
        error: `No se encontraron canciones de '${categoryKey}'`,
      };
    }

    const songsWithNumericPart = categorySongs.map((song) => {
      const titleMatch = song.title.match(/^(\d{1,3})\.\s*/);
      let numericPart = '';
      if (titleMatch && titleMatch[1]) {
        numericPart = titleMatch[1].padStart(2, '0');
      } else {
        const filenameMatch = song.filename.match(/_(\d+)\.html$/);
        if (filenameMatch && filenameMatch[1]) {
          numericPart = filenameMatch[1].padStart(2, '0');
        }
      }
      const searchableText = makeSearchableText(song, tagIndex);
      return { ...song, numericFilenamePart: numericPart, searchableText };
    });
    songsWithNumericPart.sort((a, b) => {
      const numA = parseInt(a.numericFilenamePart, 10) || Infinity;
      const numB = parseInt(b.numericFilenamePart, 10) || Infinity;
      if (numA !== numB) return numA - numB;
      return a.title.localeCompare(b.title);
    });
    return { songs: songsWithNumericPart, error: null };
  } catch (err) {
    logger.error('Error loading songs:', err);
    return {
      songs: [],
      error: 'Error al cargar las canciones, lo sentimos :(',
    };
  }
}

export default function SongsListScreen({
  route,
  navigation,
}: {
  route: { params: { categoryId: string; categoryName: string } };
  navigation: {
    navigate: (screen: string, params?: object) => void;
    goBack: () => void;
    setOptions: (opts: object) => void;
  };
}) {
  const { data: firebaseSongs, loading: loadingSongs } = useFirebaseData<
    Record<string, SongCategory>
  >(
    'songs',
    'songs',
    filterSongsData as (data: any) => Record<string, SongCategory>,
  );
  const songsData = useMemo(() => getSongsData(firebaseSongs), [firebaseSongs]);
  const { categoryId, categoryName } = route.params;
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();
  // Se registra con la clave del tab igual que CategoriesScreen: gana el
  // último montado, así el re-tap sube ESTA lista mientras se está viendo.
  const { listRef, onScroll, contentPaddingBottom } =
    useTabListScroll<FlatList>('cancionero');
  const styles = useMemo(
    () =>
      createStyles(
        scheme || 'light',
        insets.bottom,
        layout.isWide,
        layout.readableMaxWidth,
      ),
    [scheme, insets.bottom, layout.isWide, layout.readableMaxWidth],
  );
  const isDark = scheme === 'dark';
  const { addSong, removeSong, isSongSelected, getSelectedSong } =
    useSelectedSongs();
  const [search, setSearch] = useState('');
  const [searchToggled, setSearchToggled] = useState(false);

  // ── Modo etiqueta ────────────────────────────────────────────────────────
  // La categoría virtual `__TAG__:<slug>` (hermana de `__ALL__`) hereda gratis
  // la lista, el buscador, el swipe para añadir a la playlist y el estado
  // vacío. El cruce de etiquetas vive en estado LOCAL: cada refinamiento es un
  // cambio dentro de la misma pantalla, no una pantalla nueva, así que "atrás"
  // siempre devuelve al cantoral y no a un cruce intermedio.
  const isTagMode = useMemo(
    () => parseTagCategoryId(categoryId) !== null,
    [categoryId],
  );
  const [activeSlugs, setActiveSlugs] = useState<string[]>(
    () => parseTagCategoryId(categoryId) ?? [],
  );
  // Ajuste de estado al cambiar de prop, no `useEffect`: si algún día se llega
  // a esta misma pantalla con otra etiqueta sin remontarla, el cruce se
  // reinicia en el MISMO render, sin un fotograma con la lista anterior.
  const [prevCategoryId, setPrevCategoryId] = useState(categoryId);
  if (prevCategoryId !== categoryId) {
    setPrevCategoryId(categoryId);
    setActiveSlugs(parseTagCategoryId(categoryId) ?? []);
  }
  const tagIndex = useSongTagIndex(songsData);
  const [showTagSheet, setShowTagSheet] = useState(false);
  const pendingTagRef = useRef<ResolvedTag | null>(null);

  const { songs, error } = useMemo(
    () =>
      isTagMode
        ? buildTagSongList(songsData, activeSlugs, tagIndex)
        : buildSongList(songsData, categoryId, tagIndex),
    [songsData, categoryId, isTagMode, activeSlugs, tagIndex],
  );

  const activeTags = useMemo(
    () => activeSlugs.map((slug) => resolveTag(slug, tagIndex)),
    [activeSlugs, tagIndex],
  );
  // Candidatas de refinamiento sobre el resultado SIN filtrar por el buscador:
  // así la barra no baila mientras se escribe.
  const candidateTags = useMemo(
    () => (isTagMode ? coOccurringTags(songs, activeSlugs, tagIndex) : []),
    [isTagMode, songs, activeSlugs, tagIndex],
  );

  const handleAddTag = useCallback((tag: ResolvedTag) => {
    setActiveSlugs((prev) =>
      prev.includes(tag.slug) ? prev : [...prev, tag.slug],
    );
  }, []);

  // Soltar la última etiqueta activa es salir de la pantalla: una lista de
  // etiqueta sin etiqueta no es nada.
  const handleRemoveTag = useCallback(
    (tag: ResolvedTag) => {
      if (activeSlugs.length <= 1) {
        navigation.goBack();
        return;
      }
      setActiveSlugs((prev) => prev.filter((slug) => slug !== tag.slug));
    },
    [activeSlugs.length, navigation],
  );

  const handleTagSheetCloseComplete = useCallback(() => {
    const tag = pendingTagRef.current;
    if (!tag) return;
    pendingTagRef.current = null;
    setActiveSlugs([tag.slug]);
    setSearch('');
  }, []);
  const [menuSong, setMenuSong] = useState<Song | null>(null);
  // Message to share — stored in a ref so we can fire it after the sheet
  // Modal is fully dismissed (iOS can't present two Modals simultaneously).
  const pendingShareRef = useRef<string | null>(null);
  const isSearchAll = categoryId === '__ALL__';
  // Búsqueda NATIVA de iOS/Android (headerSearchBarOptions) en TODAS las
  // categorías —no solo en "Buscar general"— para que sea el mismo buscador en
  // todas partes. En web native-stack no la soporta, así que ahí seguimos con
  // el input/toggle propio.
  const nativeSearch = Platform.OS !== 'web';

  // En "Buscar general" el buscador está SIEMPRE visible; en una categoría lo
  // enseña y lo esconde el botón de la cabecera. Derivado, no sincronizado con
  // un efecto.
  const searchVisible = isSearchAll || searchToggled;

  // Header: title + optional search toggle button
  useLayoutEffect(() => {
    const cleanCategoryName = categoryName.replace(/^🔎\s*/, '');
    // En modo etiqueta el título lo manda el estado, no el parámetro: al
    // cruzar o soltar etiquetas cambia sin salir de la pantalla.
    const tagTitle = isTagMode
      ? [
          activeTags.length === 1 ? activeTags[0]?.emoji : undefined,
          tagsTitle(activeSlugs, tagIndex),
        ]
          .filter(Boolean)
          .join(' ')
      : '';
    navigation.setOptions({
      title: isTagMode ? tagTitle : isSearchAll ? 'Buscar' : cleanCategoryName,
      headerSearchBarOptions: nativeSearch
        ? {
            placeholder: 'Busca por título, autor...',
            // En "Buscar general" la barra está siempre visible y con foco; en
            // una categoría se oculta al hacer scroll (estándar iOS) y no roba
            // el foco al entrar.
            hideWhenScrolling: !isSearchAll,
            autoFocus: isSearchAll,
            textColor: isDark ? '#FFFFFF' : '#000000',
            onChangeText: (e: { nativeEvent: { text: string } }) =>
              setSearch(e.nativeEvent.text),
          }
        : undefined,
      // En modo etiqueta el header lleva además el botón de etiquetas, para
      // saltar a otra sin volver al cantoral. En el resto, el botón-lupa
      // custom solo en web (donde no hay barra nativa): en iOS/Android la
      // barra nativa lo sustituye.
      headerRight: isTagMode
        ? () => (
            <TouchableOpacity
              onPress={() => {
                h.tap();
                setShowTagSheet(true);
              }}
              style={styles.headerButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Cambiar de etiqueta"
            >
              <MaterialIcons
                name="sell"
                size={22}
                color={isIOS ? '#f4c11e' : isDark ? '#FFFFFF' : '#1a1a1a'}
              />
            </TouchableOpacity>
          )
        : nativeSearch
          ? undefined
          : isSearchAll
            ? undefined
            : () => (
                <TouchableOpacity
                  onPress={() => setSearchToggled((v) => !v)}
                  style={styles.headerButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialIcons
                    name={searchVisible ? 'search-off' : 'search'}
                    size={24}
                    color={
                      isIOS
                        ? '#f4c11e'
                        : Platform.OS === 'web'
                          ? '#1a1a1a'
                          : '#1a1a1a'
                    }
                  />
                </TouchableOpacity>
              ),
    });
  }, [
    navigation,
    categoryName,
    isSearchAll,
    searchVisible,
    styles.headerButton,
    nativeSearch,
    isDark,
    isTagMode,
    activeSlugs,
    activeTags,
    tagIndex,
  ]);

  const filteredSongs = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    if (!searchTerm) return songs;

    return songs.filter((song) => {
      if (!song) return false;
      return song.searchableText?.includes(searchTerm);
    });
  }, [songs, search]);

  // En modo etiqueta la lista lleva cabeceras de categoría intercaladas; en el
  // resto es la lista de canciones de siempre.
  const listRows = useMemo<ListRow[]>(
    () =>
      isTagMode
        ? toGroupedRows(filteredSongs)
        : filteredSongs.map((song) => ({
            kind: 'song' as const,
            key: song.filename,
            song,
          })),
    [isTagMode, filteredSongs],
  );

  const categoryCount = useMemo(
    () =>
      isTagMode ? listRows.filter((row) => row.kind === 'section').length : 0,
    [isTagMode, listRows],
  );

  // ¿Alguna canción de la lista tiene vídeo o audio? La leyenda explica esos
  // dos puntitos, así que se mira eso y no la ficha entera (que ahora también
  // incluye las etiquetas).
  const hasAnyMedia = useMemo(
    () =>
      songs.some((s) => {
        const kinds = mediaKinds(extractSongMedia(s));
        return kinds.video || kinds.audio || kinds.links;
      }),
    [songs],
  );

  const handleSongLongPress = useCallback((song: Song) => {
    setMenuSong(song);
  }, []);

  const handleMenuSelect = useCallback(() => {
    if (!menuSong) return;
    if (isSongSelected(menuSong.filename)) {
      removeSong(menuSong.filename);
    } else {
      addSong(menuSong.filename);
    }
    setMenuSong(null);
  }, [menuSong, isSongSelected, addSong, removeSong]);

  // Captures the share message and closes the sheet. The actual Share.share()
  // call happens in handleSheetCloseComplete, fired after the Modal is gone.
  const handleMenuShare = useCallback(() => {
    if (!menuSong) return;
    const cleanTitle = menuSong.title.replace(/^\d+\.\s*/, '');
    pendingShareRef.current = menuSong.author
      ? `${cleanTitle} — ${menuSong.author}`
      : cleanTitle;
    setMenuSong(null);
  }, [menuSong]);

  const handleSheetCloseComplete = useCallback(() => {
    const msg = pendingShareRef.current;
    if (msg) {
      pendingShareRef.current = null;
      Share.share({ message: msg });
    }
  }, []);

  const handleSongPress = useCallback(
    (song: Song) => {
      const index = songs.findIndex((s) => s.filename === song.filename);

      navigation.navigate('SongDetail', {
        filename: song.filename,
        title: song.title.replace(/^\d+\.\s*/, ''),
        author: song.author,
        key: song.key,
        capo: song.capo,
        content: song.content || '',
        media: extractSongMedia(song) ?? undefined,
        // En modo etiqueta la lista de navegación es la de la etiqueta: el
        // swipe entre canciones se mueve dentro de la etiqueta, no de la
        // categoría de la que salga cada canción.
        navigationList:
          categoryId === '__ALL__'
            ? undefined
            : songs.map((s) => ({
                title: s.title,
                filename: s.filename,
                author: s.author,
                key: s.key,
                capo: s.capo,
                content: s.content,
                media: extractSongMedia(s) ?? undefined,
              })),
        currentIndex: categoryId === '__ALL__' ? undefined : index,
        source: categoryId === '__ALL__' ? undefined : 'category',
        firebaseCategory:
          categoryId === '__ALL__' || isTagMode
            ? song.originalCategoryKey
            : categoryId,
      });
    },
    [songs, categoryId, isTagMode, navigation],
  );

  // ListHeaderComponent: search bar + song count
  // Goes inside the FlatList so it scrolls with content on iOS
  // (avoids getting hidden behind transparent header)
  const listHeaderComponent = useMemo(
    () => (
      <View>
        {searchVisible && !nativeSearch && (
          <View style={styles.searchContainer}>
            <View style={styles.searchBox}>
              <MaterialIcons
                name="search"
                size={18}
                color={isDark ? '#636366' : '#8E8E93'}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Busca por título, autor..."
                placeholderTextColor={isDark ? '#636366' : '#8E8E93'}
                value={search}
                onChangeText={setSearch}
                autoFocus={!isSearchAll}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
              {Platform.OS !== 'ios' && search.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearch('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons
                    name="cancel"
                    size={16}
                    color={isDark ? '#636366' : '#8E8E93'}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        {/* Conteo de canciones — siempre visible, muy sutil */}
        <View style={styles.countRow}>
          <Text style={styles.songCount}>
            {filteredSongs.length}{' '}
            {filteredSongs.length === 1 ? 'canción' : 'canciones'}
            {search.length > 0 ? ' encontradas' : ''}
            {isTagMode && categoryCount > 0
              ? ` · ${categoryCount} ${
                  categoryCount === 1 ? 'categoría' : 'categorías'
                }`
              : ''}
          </Text>
          {hasAnyMedia && (
            <View style={styles.legend}>
              <MaterialIcons
                name="play-arrow"
                size={13}
                color={isDark ? '#6C6C70' : '#B0B0B5'}
              />
              <Text style={styles.legendText}>vídeo</Text>
              <Text style={styles.legendDot}>·</Text>
              <MaterialIcons
                name="headphones"
                size={12}
                color={isDark ? '#6C6C70' : '#B0B0B5'}
              />
              <Text style={styles.legendText}>audio</Text>
            </View>
          )}
        </View>
      </View>
    ),
    [
      searchVisible,
      search,
      isSearchAll,
      nativeSearch,
      filteredSongs.length,
      hasAnyMedia,
      styles,
      setSearch,
      isDark,
      isTagMode,
      categoryCount,
    ],
  );

  const renderItem = useCallback(
    ({ item: row }: { item: ListRow }) => {
      if (row.kind === 'section') {
        return (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText} numberOfLines={1}>
              {row.title}
            </Text>
            <Text style={styles.sectionHeaderCount}>{row.count}</Text>
          </View>
        );
      }
      const item = row.song;
      // ⚡ Bolt: Short-circuit optimization. We check the O(1) boolean `isSongSelected` first.
      // If false, we skip the `getSelectedSong` lookup entirely, avoiding redundant object mapping
      // for the vast majority of unselected songs during list re-renders.
      const isSelected = isSongSelected(item.filename);
      return (
        <SongListItem
          song={item}
          onPress={handleSongPress}
          onLongPress={handleSongLongPress}
          isSearchAllMode={isSearchAll}
          isSelected={isSelected}
          selectedTranspose={
            isSelected ? (getSelectedSong(item.filename)?.transpose ?? 0) : 0
          }
          onAddSong={addSong}
          onRemoveSong={removeSong}
        />
      );
    },
    [
      handleSongPress,
      handleSongLongPress,
      isSearchAll,
      isSongSelected,
      getSelectedSong,
      addSong,
      removeSong,
      styles.sectionHeader,
      styles.sectionHeaderText,
      styles.sectionHeaderCount,
    ],
  );

  if (loadingSongs && songs.length === 0) {
    return (
      <ProgressWithMessage message="Cargando canciones un momentito porfi..." />
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.debugText}>
          Categorías disponibles:{' '}
          {songsData ? Object.keys(songsData).join(', ') : 'N/A'}
        </Text>
      </View>
    );
  }

  const menuSongClean = menuSong ? menuSong.title.replace(/^\d+\.\s*/, '') : '';
  const menuSongSelected = menuSong ? isSongSelected(menuSong.filename) : false;

  return (
    <View style={styles.container}>
      <BottomSheet
        visible={!!menuSong}
        onClose={() => setMenuSong(null)}
        title={menuSongClean}
        onCloseComplete={handleSheetCloseComplete}
      >
        <View style={styles.menuActions}>
          <TouchableOpacity
            style={styles.menuAction}
            onPress={handleMenuSelect}
          >
            <MaterialIcons
              name={menuSongSelected ? 'playlist-remove' : 'playlist-add'}
              size={22}
              color={isDark ? '#7AB3FF' : '#253883'}
            />
            <Text
              style={[
                styles.menuActionText,
                { color: isDark ? '#F5F5F7' : '#1C1C1E' },
              ]}
            >
              {menuSongSelected ? 'Quitar de la lista' : 'Añadir a la lista'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuAction} onPress={handleMenuShare}>
            <MaterialIcons
              name="share"
              size={22}
              color={isDark ? '#7AB3FF' : '#253883'}
            />
            <Text
              style={[
                styles.menuActionText,
                { color: isDark ? '#F5F5F7' : '#1C1C1E' },
              ]}
            >
              Compartir
            </Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
      {isTagMode && (
        <TagContextBar
          activeTags={activeTags}
          candidates={candidateTags}
          isDark={isDark}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTag}
        />
      )}

      {isTagMode && (
        <TagCloudSheet
          visible={showTagSheet}
          onClose={() => setShowTagSheet(false)}
          tags={tagIndex.tags}
          activeSlugs={activeSlugs}
          onSelectTag={(tag) => {
            pendingTagRef.current = tag;
            setShowTagSheet(false);
          }}
          onCloseComplete={handleTagSheetCloseComplete}
        />
      )}

      <Animated.FlatList
        ref={listRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        data={listRows}
        keyExtractor={(item: ListRow) => item.key}
        initialNumToRender={15}
        maxToRenderPerBatch={20}
        windowSize={5}
        renderItem={renderItem}
        ListHeaderComponent={listHeaderComponent}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: contentPaddingBottom },
        ]}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          isTagMode && search.length === 0 ? (
            <EmptyState
              emoji="🏷️"
              title="Ninguna canción con estas etiquetas"
              subtitle="Suelta alguna de las etiquetas de arriba para ver más"
            />
          ) : (
            <EmptyState
              emoji="🔍"
              title="No hemos encontrado esa canción"
              subtitle={
                search.length > 0
                  ? 'Prueba con otro título o nombre de autor'
                  : undefined
              }
            />
          )
        }
      />
    </View>
  );
}

const createStyles = (
  scheme: 'light' | 'dark' | null,
  bottomInset: number = 0,
  isWide: boolean = false,
  maxWidth: number = 9999,
) => {
  const isDark = scheme === 'dark';
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
    },
    headerButton: {
      padding: 8,
      marginRight: Platform.OS === 'web' ? 8 : 0,
    },
    searchContainer: {
      paddingHorizontal: isWide ? 0 : 16,
      paddingTop: 10,
      paddingBottom: 4,
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
      borderRadius: isWide ? 14 : 10,
      paddingHorizontal: isWide ? 14 : 10,
      paddingVertical: isWide ? 12 : Platform.OS === 'ios' ? 9 : 7,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: isWide ? 17 : 16,
      color: isDark ? '#F5F5F7' : '#1C1C1E',
      padding: 0,
      margin: 0,
    },
    countRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: isWide ? 4 : 20,
      paddingTop: 10,
      paddingBottom: 2,
    },
    songCount: {
      fontSize: 12,
      color: isDark ? '#636366' : '#AEAEB2',
      letterSpacing: 0.2,
    },
    legend: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    legendText: {
      fontSize: 11,
      color: isDark ? '#6C6C70' : '#B0B0B5',
    },
    legendDot: {
      fontSize: 11,
      color: isDark ? '#48484A' : '#D1D1D6',
      marginHorizontal: 1,
    },
    // Cabecera de categoría dentro de una etiqueta. Mismo peso visual que las
    // cabeceras de sección del resto de la app: la categoría es el contexto
    // que le falta a una etiqueta, no un adorno.
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
      paddingHorizontal: 16,
      paddingVertical: 9,
      marginTop: 8,
      marginHorizontal: isWide ? 0 : -12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    },
    sectionHeaderText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: isDark ? '#AEAEB2' : '#636366',
    },
    sectionHeaderCount: {
      fontSize: 12,
      fontWeight: '600',
      color: isDark ? '#8E8E93' : '#8E8E93',
      fontVariant: ['tabular-nums'],
    },
    listContent: {
      paddingHorizontal: isWide ? 20 : 12,
      ...(isWide
        ? {
            maxWidth,
            width: '100%',
            alignSelf: 'center',
          }
        : null),
    },
    errorText: {
      fontSize: 16,
      color: '#FF453A',
      textAlign: 'center',
      margin: 20,
      fontWeight: '600',
    },
    debugText: {
      fontSize: 14,
      color: isDark ? '#8E8E93' : '#8E8E93',
      textAlign: 'center',
      margin: 10,
      fontFamily: 'monospace',
    },
    menuActions: {
      paddingBottom: 8,
    },
    menuAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    },
    menuActionText: {
      fontSize: 16,
      fontWeight: '500',
    },
  });
};
