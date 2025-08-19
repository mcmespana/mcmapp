import { useState, useEffect, useMemo } from 'react';
import { FlatList, Text, View, StyleSheet } from 'react-native'; // TouchableOpacity removed
import { Searchbar } from 'react-native-paper'; // Added Searchbar
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { filterSongsData } from '@/utils/filterSongsData';
// import SongSearch from '../../components/SongSearch'; // Removed SongSearch import
import SongListItem from '../../components/SongListItem'; // Added import

// Type for song data
interface Song {
  title: string;
  filename: string;
  author?: string; // Optional
  key?: string; // Optional
  capo?: number; // Optional
  info?: string; // Optional
  content?: string; // Optional
  originalCategoryKey?: string; // For 'Search All' mode
  numericFilenamePart?: string; // For consistent number display
}

interface SongCategory {
  categoryTitle: string;
  songs: Song[];
}

// Ensure the data is in the correct format
const getSongsData = (data: any): Record<string, SongCategory> => {
  try {
    // If the data is null (expected during initial loading), return empty object
    if (data === null) {
      return {};
    }

    // If the data is already in the correct format, return it
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return data as Record<string, SongCategory>;
    }

    // If the data is an array, try to convert it to the correct format
    if (Array.isArray(data)) {
      return { All: { categoryTitle: 'All', songs: data } };
    }

    // If we can't determine the format, return an empty object
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
  >('songs', 'songs', filterSongsData);
  const songsData = useMemo(() => getSongsData(firebaseSongs), [firebaseSongs]);
  const { categoryId, categoryName } = route.params;
  const scheme = useColorScheme();
  const styles = useMemo(() => createStyles(scheme || 'light'), [scheme]);
  const [search, setSearch] = useState('');
  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          // Sort all songs alphabetically by title (removing leading numbers for sorting)
          allSongs.sort((a, b) => {
            const titleA = a.title.replace(/^\d+\.\s*/, '').toLowerCase();
            const titleB = b.title.replace(/^\d+\.\s*/, '').toLowerCase();
            return titleA.localeCompare(titleB);
          });
          setSongs(allSongs);
        } else {
          // Try to find the category (case insensitive)
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
      } catch (error) {
        console.error('Error loading songs:', error);
        setError('Error al cargar las canciones, lo sentimos :(');
        setSongs([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadSongs();
  }, [categoryId, songsData]);

  // Filter songs based on search
  const filteredSongs = songs.filter((song) => {
    if (!song) return false;
    const searchTerm = search.toLowerCase();
    const titleMatch =
      song.title && song.title.toLowerCase().includes(searchTerm);
    const authorMatch =
      song.author && song.author.toLowerCase().includes(searchTerm);
    return titleMatch || authorMatch;
  });

  // Handle song press
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

  // Render loading state
  if ((isLoading || loadingSongs) && songs.length === 0) {
    return <ProgressWithMessage message="Cargando canciones..." />;
  }

  // Render error state
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

  // Render empty state
  if (filteredSongs.length === 0) {
    return (
      <View style={styles.container}>
        <Searchbar
          placeholder="Escribe el título de una canción o el autor"
          placeholderTextColor="#8A8A8D"
          iconColor="#8A8A8D"
          onChangeText={setSearch}
          value={search}
          style={styles.searchbar} // Style will be updated below
          inputStyle={styles.searchbarInput} // Style will be updated below
        />
        <Text style={styles.categoryTitle}>{categoryName}</Text>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No hemos encontrado esa canción 🕵️‍♀️
          </Text>
          {search.length > 0 && (
            <Text style={styles.hintText}>
              Puedes buscar el título o el autor si está disponible
            </Text>
          )}
        </View>
      </View>
    );
  }

  // Render song list
  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Escribe el título de una canción o el autor"
        placeholderTextColor="#8A8A8D"
        iconColor="#8A8A8D"
        onChangeText={setSearch}
        value={search}
        style={styles.searchbar}
        inputStyle={styles.searchbarInput}
      />
      {categoryName === '🔎 Buscar una canción...' ? (
        <View style={styles.separator} />
      ) : (
        <Text style={styles.categoryTitle}>{categoryName}</Text>
      )}
      <FlatList
        data={filteredSongs}
        keyExtractor={(item) => item.filename}
        renderItem={({ item }) => (
          <SongListItem
            song={item}
            onPress={handleSongPress}
            isSearchAllMode={categoryId === '__ALL__'}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text>No hemos encontrado esa canción 🕵️‍♀️</Text>
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
      backgroundColor: isDark
        ? Colors.dark.background
        : Colors.light.background,
    },
    separator: {
      height: 5,
      backgroundColor: isDark ? '#444' : '#E0E0E0',
      marginHorizontal: 15,
      marginVertical: 10,
    },
    searchbar: {
      marginHorizontal: 16,
      marginVertical: 12,
      borderRadius: 20,
      backgroundColor: isDark ? '#2C2C2E' : '#fff',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      height: 44,
      borderWidth: 1,
      borderColor: isDark ? '#444' : '#E0E0E0',
    },
    searchbarInput: {
      fontSize: 16,
      paddingLeft: 0,
      paddingTop: 0,
      textAlignVertical: 'center',
      color: isDark ? Colors.dark.text : Colors.light.text,
    },
    categoryTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      padding: 16,
      backgroundColor: isDark ? '#2C2C2E' : '#f5f5f5',
      color: isDark ? '#FFFFFF' : '#333',
    },
    loadingText: {
      fontSize: 16,
      textAlign: 'center',
      marginTop: 20,
      color: isDark ? '#CCCCCC' : '#666',
    },
    errorText: {
      fontSize: 16,
      color: '#d32f2f',
      textAlign: 'center',
      margin: 20,
      fontWeight: 'bold',
    },
    debugText: {
      fontSize: 14,
      color: isDark ? '#AAAAAA' : '#666',
      textAlign: 'center',
      margin: 10,
      fontFamily: 'monospace',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    emptyText: {
      fontSize: 16,
      color: isDark ? '#CCCCCC' : '#666',
      marginBottom: 10,
      textAlign: 'center',
    },
    hintText: {
      fontSize: 14,
      color: isDark ? '#AAAAAA' : '#888',
      fontStyle: 'italic',
      textAlign: 'center',
    },
  });
};
