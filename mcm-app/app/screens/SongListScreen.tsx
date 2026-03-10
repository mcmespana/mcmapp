import { useState, useEffect, useMemo } from 'react';
import { FlatList, Text, View, StyleSheet, Platform } from 'react-native';
import { Searchbar } from 'react-native-paper';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { filterSongsData } from '@/utils/filterSongsData';
import SongListItem from '../../components/SongListItem';

// Type for song data
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
  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isSearchAll = categoryId === '__ALL__';

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

  const handleSongPress = (song: Song) => {
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
  };

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

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Buscar por título o autor..."
          placeholderTextColor={isDark ? '#636366' : '#8E8E93'}
          iconColor={isDark ? '#636366' : '#8E8E93'}
          onChangeText={setSearch}
          value={search}
          style={styles.searchbar}
          inputStyle={styles.searchbarInput}
        />
      </View>
      {!isSearchAll && (
        <View style={styles.headerSection}>
          <Text style={styles.categoryTitle}>
            {categoryName.replace(/^🔎\s*/, '')}
          </Text>
          <Text style={styles.songCount}>
            {filteredSongs.length}{' '}
            {filteredSongs.length === 1 ? 'canción' : 'canciones'}
            {search.length > 0 ? ' encontradas' : ''}
          </Text>
        </View>
      )}
      {isSearchAll && <View style={styles.thinSeparator} />}
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
        contentContainerStyle={styles.listContent}
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
    searchContainer: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 4,
      backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
    },
    searchbar: {
      borderRadius: 12,
      backgroundColor: isDark ? '#2C2C2E' : '#fff',
      elevation: 0,
      height: 44,
      ...(Platform.OS === 'web'
        ? {
            boxShadow: isDark
              ? '0 1px 3px rgba(0,0,0,0.4)'
              : '0 1px 3px rgba(0,0,0,0.08)',
          }
        : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: isDark ? 0.25 : 0.06,
            shadowRadius: 3,
          }),
    },
    searchbarInput: {
      fontSize: 16,
      paddingLeft: 0,
      paddingTop: 0,
      textAlignVertical: 'center',
      color: isDark ? Colors.dark.text : Colors.light.text,
    },
    headerSection: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 8,
    },
    categoryTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : '#1C1C1E',
      letterSpacing: -0.4,
    },
    songCount: {
      fontSize: 13,
      color: isDark ? '#8E8E93' : '#8E8E93',
      marginTop: 2,
    },
    thinSeparator: {
      height: 8,
    },
    listContent: {
      paddingBottom: 24,
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
