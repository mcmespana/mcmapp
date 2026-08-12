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
import { extractSongMedia, type MediaLink } from '@/types/songMedia';

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
}

interface SongCategory {
  categoryTitle: string;
  songs: Song[];
}

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
          const searchableText =
            `${song.title || ''} ${song.author || ''}`.toLowerCase();
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
      const searchableText =
        `${song.title || ''} ${song.author || ''}`.toLowerCase();
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
  const { songs, error } = useMemo(
    () => buildSongList(songsData, categoryId),
    [songsData, categoryId],
  );
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
    navigation.setOptions({
      title: isSearchAll ? 'Buscar' : cleanCategoryName,
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
      // El botón-lupa custom solo en web (donde no hay barra nativa). En
      // iOS/Android la barra nativa lo sustituye.
      headerRight: nativeSearch
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
  ]);

  const filteredSongs = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    if (!searchTerm) return songs;

    return songs.filter((song) => {
      if (!song) return false;
      return song.searchableText?.includes(searchTerm);
    });
  }, [songs, search]);

  // ¿Alguna canción de la lista tiene multimedia? Para mostrar la leyenda.
  const hasAnyMedia = useMemo(
    () => songs.some((s) => extractSongMedia(s) !== null),
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
          categoryId === '__ALL__' ? song.originalCategoryKey : categoryId,
      });
    },
    [songs, categoryId, navigation],
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
    ],
  );

  const renderItem = useCallback(
    ({ item }: { item: Song }) => {
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
          selectedTranspose={isSelected ? (getSelectedSong(item.filename)?.transpose ?? 0) : 0}
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
      <Animated.FlatList
        ref={listRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        data={filteredSongs}
        keyExtractor={(item) => item.filename}
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
          <EmptyState
            emoji="🔍"
            title="No hemos encontrado esa canción"
            subtitle={
              search.length > 0
                ? 'Prueba con otro título o nombre de autor'
                : undefined
            }
          />
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
