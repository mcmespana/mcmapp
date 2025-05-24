import { useState, useEffect } from 'react';
import { FlatList, TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import rawSongsData from '../../assets/songs.json';
import SongSearch from '../../components/SongSearch';

// Type for song data
interface Song {
  title: string;
  filename: string;
  author: string;
  capo: string;
  info: string;
}

// Ensure the data is in the correct format
const getSongsData = (data: any): Record<string, Song[]> => {
  try {
    // If the data is already in the correct format, return it
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return data as Record<string, Song[]>;
    }
    
    // If the data is an array, try to convert it to the correct format
    if (Array.isArray(data)) {
      return { 'All': data };
    }
    
    // If we can't determine the format, return an empty object
    console.error('Unexpected songs data format:', data);
    return {};
  } catch (error) {
    console.error('Error parsing songs data:', error);
    return {};
  }
};

const songsData = getSongsData(rawSongsData);
console.log('Available categories:', Object.keys(songsData));

// Type for song data
interface Song {
  title: string;
  filename: string;
  author: string;
  capo: string;
  info: string;
}

export default function SongsListScreen({ route, navigation }: {
  route: { params: { categoryId: string; categoryName: string } };
  navigation: any;
}) {
  const { categoryId, categoryName } = route.params;
  const [search, setSearch] = useState('');
  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('Accessing category:', categoryId);
    console.log('Available categories:', Object.keys(songsData));
    
    const loadSongs = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Try to find the category (case insensitive)
        const categoryKey = Object.keys(songsData).find(
          key => key.trim().toLowerCase() === categoryId.trim().toLowerCase()
        );

        console.log('Found category key:', categoryKey);
        
        if (categoryKey) {
          const categorySongs = songsData[categoryKey];
          console.log(`Found category '${categoryKey}' with ${categorySongs?.length || 0} songs`);
          
          if (categorySongs && Array.isArray(categorySongs)) {
            setSongs(categorySongs);
          } else {
            setError(`No se encontraron canciones en la categoría '${categoryKey}'`);
            setSongs([]);
          }
        } else {
          setError(`Categoría '${categoryId}' no encontrada`);
          setSongs([]);
        }
      } catch (error) {
        console.error('Error loading songs:', error);
        setError('Error al cargar las canciones. Por favor, inténtalo de nuevo.');
        setSongs([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSongs();
  }, [categoryId]);

  // Filter songs based on search
  const filteredSongs = songs.filter(song =>
    song && song.title && song.title.toLowerCase().includes(search.toLowerCase())
  );

  // Handle song press
  const handleSongPress = (song: Song) => {
    navigation.navigate('SongDetail', {
      filename: song.filename,
      title: song.title
    });
  };

  // Render loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando canciones...</Text>
      </View>
    );
  }

  // Render error state
  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.debugText}>
          Categorías disponibles: {Object.keys(songsData).join(', ')}
        </Text>
      </View>
    );
  }

  // Render empty state
  if (filteredSongs.length === 0) {
    return (
      <View style={styles.container}>
        <SongSearch searchText={search} setSearchText={setSearch} />
        <Text style={styles.categoryTitle}>{categoryName}</Text>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No se encontraron canciones</Text>
          {search.length > 0 && (
            <Text style={styles.hintText}>Intenta con otros términos de búsqueda</Text>
          )}
        </View>
      </View>
    );
  }

  // Render song list
  return (
    <View style={styles.container}>
      <SongSearch searchText={search} setSearchText={setSearch} />
      <Text style={styles.categoryTitle}>{categoryName}</Text>
      <FlatList
        data={filteredSongs}
        keyExtractor={(item) => item.filename}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => handleSongPress(item)}
            style={styles.songItem}
          >
            <Text style={styles.songTitle}>
              {item.title.replace(/^\d+\.\s*/, '')} {/* Remove leading numbers */}
            </Text>
            {item.author ? (
              <Text style={styles.songAuthor}>{item.author}</Text>
            ) : null}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text>No se encontraron canciones que coincidan con la búsqueda</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    padding: 16,
    backgroundColor: '#f5f5f5',
    color: '#333',
  },
  songItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  songTitle: {
    fontSize: 16,
    color: '#333',
  },
  songAuthor: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  loadingText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
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
    color: '#666',
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
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
  },
  hintText: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
