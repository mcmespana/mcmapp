import {
  useState,
  useEffect,
  useMemo,
  useLayoutEffect,
  useCallback,
  useRef,
} from 'react';
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

interface Song {
  title: string;
  filename: string;
  author?: string;
  key?: string;
  capo?: number;
  info?: string;
  content?: string;
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
    console.error('Unexpected songs data format:', data);
    return {};
  } catch (error) {
    console.error('Error parsing songs data:', error);
    return {};
  }
};

const isIOS = Platform.OS === 'ios';

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
  const [searchVisible, setSearchVisible] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuSong, setMenuSong] = useState<Song | null>(null);
  // Message to share — stored in a ref so we can fire it after the sheet
  // Modal is fully dismissed (iOS can't present two Modals simultaneously).
  const pendingShareRef = useRef<string | null>(null);
  const isSearchAll = categoryId === '__ALL__';

  // In __ALL__ mode, search is always visible
  useEffect(() => {
    if (isSearchAll) setSearchVisible(true);
  }, [isSearchAll]);

  // Header: title + optional search toggle button
  useLayoutEffect(() => {
    const cleanCategoryName = categoryName.replace(/^🔎\s*/, '');
    navigation.setOptions({
      title: isSearchAll ? 'Buscar' : cleanCategoryName,
      headerRight: isSearchAll
        ? undefined
        : () => (
            <TouchableOpacity
              onPress={() => setSearchVisible((v) => !v)}
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
  }, [navigation, categoryName, isSearchAll, searchVisible, styles]);

  useEffect(() => {
    if (!songsData) return;
    setIsLoading(true);
    setError(null);

    const loadSongs = async () => {
      setIsLoading(true);
      setError(null);

      try {
        if (categoryId === '__ALL__') {
          let allSongs: Song[] = [];
          for (const originalCategoryKey in songsData) {
            if (
              Object.prototype.hasOwnProperty.call(
                songsData,
                originalCategoryKey,
              )
            ) {
              const categorySongs = songsData[originalCategoryKey].songs;
              const categoryTitle =
                songsData[originalCategoryKey].categoryTitle;
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
                const sortTitle = song.title
                  .replace(/^\d+\.\s*/, '')
                  .toLowerCase();
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
              allSongs = allSongs.concat(songsWithMetadata);
            }
          }
          allSongs.sort((a, b) => {
            const titleA = a.sortTitle || a.title;
            const titleB = b.sortTitle || b.title;
            return titleA.localeCompare(titleB);
          });
          setSongs(allSongs);
        } else {
          const categoryKey = Object.keys(songsData).find(
            (key) =>
              key.trim().toLowerCase() === categoryId.trim().toLowerCase(),
          );

          if (categoryKey) {
            const categorySongs = songsData[categoryKey].songs;

            if (categorySongs && Array.isArray(categorySongs)) {
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
                return {
                  ...song,
                  numericFilenamePart: numericPart,
                  searchableText,
                };
              });
              songsWithNumericPart.sort((a, b) => {
                const numA = parseInt(a.numericFilenamePart, 10) || Infinity;
                const numB = parseInt(b.numericFilenamePart, 10) || Infinity;
                if (numA !== numB) return numA - numB;
                return a.title.localeCompare(b.title);
              });
              setSongs(songsWithNumericPart);
            } else {
              setError(`No se encontraron canciones de '${categoryKey}'`);
              setSongs([]);
            }
          } else {
            setError(`Categoría '${categoryId}' no encontrada`);
            setSongs([]);
          }
        }
      } catch (err) {
        console.error('Error loading songs:', err);
        setError('Error al cargar las canciones, lo sentimos :(');
        setSongs([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadSongs();
  }, [categoryId, songsData]);

  const filteredSongs = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    if (!searchTerm) return songs;

    return songs.filter((song) => {
      if (!song) return false;
      return song.searchableText?.includes(searchTerm);
    });
  }, [songs, search]);

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
        navigationList: categoryId === '__ALL__' ? undefined : songs,
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
        {searchVisible && (
          <View style={styles.searchContainer}>
            <View style={styles.searchBox}>
              <MaterialIcons
                name="search"
                size={18}
                color={isDark ? '#636366' : '#8E8E93'}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Título, autor..."
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
        </View>
      </View>
    ),
    [
      searchVisible,
      search,
      isSearchAll,
      filteredSongs.length,
      styles,
      setSearch,
      isDark,
    ],
  );

  const renderItem = useCallback(
    ({ item }: { item: Song }) => (
      <SongListItem
        song={item}
        onPress={handleSongPress}
        onLongPress={handleSongLongPress}
        isSearchAllMode={isSearchAll}
        isSelected={isSongSelected(item.filename)}
        selectedTranspose={getSelectedSong(item.filename)?.transpose ?? 0}
        onAddSong={addSong}
        onRemoveSong={removeSong}
      />
    ),
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

  if ((isLoading || loadingSongs) && songs.length === 0) {
    return <ProgressWithMessage message="Cargando canciones..." />;
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
      <FlatList
        data={filteredSongs}
        keyExtractor={(item) => item.filename}
        initialNumToRender={15}
        maxToRenderPerBatch={20}
        windowSize={5}
        renderItem={renderItem}
        ListHeaderComponent={listHeaderComponent}
        contentContainerStyle={styles.listContent}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyText}>
              No hemos encontrado esa canción
            </Text>
            {search.length > 0 && (
              <Text style={styles.hintText}>
                Prueba con otro título o nombre de autor
              </Text>
            )}
          </View>
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
      paddingHorizontal: isWide ? 4 : 20,
      paddingTop: 10,
      paddingBottom: 2,
    },
    songCount: {
      fontSize: 12,
      color: isDark ? '#636366' : '#AEAEB2',
      letterSpacing: 0.2,
    },
    listContent: {
      paddingHorizontal: isWide ? 20 : 12,
      paddingBottom: bottomInset + 20,
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
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
      paddingHorizontal: 40,
    },
    emptyEmoji: {
      fontSize: 48,
      marginBottom: 16,
    },
    emptyText: {
      fontSize: 17,
      fontWeight: '600',
      color: isDark ? '#8E8E93' : '#636366',
      marginBottom: 8,
      textAlign: 'center',
    },
    hintText: {
      fontSize: 14,
      color: isDark ? '#636366' : '#AEAEB2',
      textAlign: 'center',
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
