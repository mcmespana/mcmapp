import {
  useState,
  useEffect,
  useMemo,
  useLayoutEffect,
  useCallback,
} from 'react';
import {
  FlatList,
  Text,
  View,
  StyleSheet,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SearchField } from 'heroui-native';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { filterSongsData } from '@/utils/filterSongsData';
import SongListItem from '../../components/SongListItem';
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
  navigation: any;
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
  const styles = useMemo(() => createStyles(scheme || 'light'), [scheme]);
  const isDark = scheme === 'dark';
  const [search, setSearch] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
  }, [navigation, categoryName, isSearchAll, searchVisible]);

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
                return {
                  ...song,
                  originalCategoryKey: categoryLetter,
                  numericFilenamePart: numericPart,
                };
              });
              allSongs = allSongs.concat(songsWithMetadata);
            }
          }
          allSongs.sort((a, b) => {
            const titleA = a.title.replace(/^\d+\.\s*/, '').toLowerCase();
            const titleB = b.title.replace(/^\d+\.\s*/, '').toLowerCase();
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
                return { ...song, numericFilenamePart: numericPart };
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

  const filteredSongs = songs.filter((song) => {
    if (!song) return false;
    const searchTerm = search.toLowerCase();
    const titleMatch =
      song.title && song.title.toLowerCase().includes(searchTerm);
    const authorMatch =
      song.author && song.author.toLowerCase().includes(searchTerm);
    return titleMatch || authorMatch;
  });

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

  // ListHeaderComponent: search bar + song count
  // Goes inside the FlatList so it scrolls with content on iOS
  // (avoids getting hidden behind transparent header)
  const ListHeader = () => (
    <View>
      {searchVisible && (
        <View style={styles.searchContainer}>
          <SearchField value={search} onChange={setSearch}>
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input
                placeholder="Buscar por título o autor..."
                autoFocus={!isSearchAll}
                returnKeyType="search"
              />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
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
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredSongs}
        keyExtractor={(item) => item.filename}
        renderItem={({ item }) => (
          <SongListItem
            song={item}
            onPress={handleSongPress}
            isSearchAllMode={isSearchAll}
          />
        )}
        ListHeaderComponent={<ListHeader />}
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

const createStyles = (scheme: 'light' | 'dark' | null) => {
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
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 4,
    },
    countRow: {
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 2,
    },
    songCount: {
      fontSize: 12,
      color: isDark ? '#636366' : '#AEAEB2',
      letterSpacing: 0.2,
    },
    listContent: {
      paddingBottom: isIOS ? 100 : 24,
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
  });
};
