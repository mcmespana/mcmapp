import React, { useEffect, useState, useLayoutEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Platform, Share } from 'react-native';
import { Provider as PaperProvider, Snackbar } from 'react-native-paper';
import * as Clipboard from 'expo-clipboard';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useSelectedSongs } from '../../contexts/SelectedSongsContext';
import SongListItem from '../../components/SongListItem';
import { IconSymbol } from '../../components/ui/IconSymbol';
import allSongsData from '../../assets/songs.json';
import { RootStackParamList } from '../(tabs)/cancionero';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';

// Define Song type based on songs.json structure
interface Song {
  title: string;
  filename: string;
  author?: string;
  key?: string;
  capo?: number;
  info?: string;
  content?: string; // Added content field
}

interface CategorizedSongs {
  categoryTitle: string;
  data: Song[];
}

// Navigation prop type
type SelectedSongsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'SongDetail'>;

const SelectedSongsScreen: React.FC = () => {
  const { selectedSongs, clearSelection } = useSelectedSongs();
  const navigation = useNavigation<SelectedSongsScreenNavigationProp>();
  const scheme = useColorScheme() || 'light'; // Default to light theme if undefined
  const styles = useMemo(() => createStyles(scheme), [scheme]);
  const [categorizedSelectedSongs, setCategorizedSelectedSongs] = useState<CategorizedSongs[]>([]);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [randomEmoji, setRandomEmoji] = useState('');

  // Generate random emoji when component mounts
  useEffect(() => {
    const musicalEmojis = ['🎵', '🎶', '🎤', '🎸', '🎹', '🎷', '🎺', '🎻'];
    const randomIndex = Math.floor(Math.random() * musicalEmojis.length);
    setRandomEmoji(musicalEmojis[randomIndex]);
  }, []);

  useEffect(() => {
    const processSongs = () => {
      if (!selectedSongs || selectedSongs.length === 0) {
        setCategorizedSelectedSongs([]);
        return;
      }

      const categories: CategorizedSongs[] = [];
      for (const categoryName in allSongsData) {
        const songsInCategory = (allSongsData as Record<string, Song[]>)[categoryName];
        const selectedInCategory = songsInCategory.filter(song => selectedSongs.includes(song.filename));

        if (selectedInCategory.length > 0) {
          categories.push({
            categoryTitle: categoryName,
            data: selectedInCategory,
          });
        }
      }
      setCategorizedSelectedSongs(categories);
    };

    processSongs();
  }, [selectedSongs]);

  const handleExport = useCallback(() => {
    // 1. Generate Header
    const date = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).toUpperCase().replace('.', '');
    const musicalEmojis = ['🎹', '🎸', '🎤', '🎶', '🎵', '🎼', '🎷', '🎺', '🎻'];
    const randomEmoji = musicalEmojis[Math.floor(Math.random() * musicalEmojis.length)];
    const header = `*CANCIONES ${date} ${randomEmoji}*`;

    // 2. Process Selected Songs
    const formattedSongLines: string[] = [];

    categorizedSelectedSongs.forEach(category => {
      const categoryLetter = category.categoryTitle.charAt(0).toUpperCase();

      category.data.forEach(song => {
        // Ensure this song is actually in the selectedSongs list (though categorizedSelectedSongs should already be filtered)
        if (selectedSongs.includes(song.filename)) {
          const songTitleClean = song.title.replace(/^\d+\.\s*/, '');

          let chordCapoString = '';
          if (song.key) {
            chordCapoString = `\`${song.key}\``;
            if (song.capo && song.capo > 0) {
              chordCapoString += ` \`C/${song.capo}\``;
            }
          }

          const songIdMatch = song.title.match(/^\d+/); // Remove the dot from the regex to get just the number
          const songId = songIdMatch ? songIdMatch[0] : '??';

          let line = `*${categoryLetter}.* ${songTitleClean}`;
          if (chordCapoString) {
            line += ` · ${chordCapoString}`;
          }
          line += ` · *[#${songId}]*`;
          if (song.author) {
            line += ` · ${song.author}`;
          }
          formattedSongLines.push(line);
        }
      });
    });

    // 3. Assemble Final String
    const finalText = [header, ...formattedSongLines].join('\n');

    // 4. Platform-specific sharing/copying
    if (Platform.OS === 'web' || Platform.OS === 'windows' || Platform.OS === 'macos') {
      try {
        Clipboard.setStringAsync(finalText);
        setSnackbarMessage('Lista de canciones copiada al portapapeles');
        setSnackbarVisible(true);
      } catch (error) {
        console.error('Error copying to clipboard:', error);
        setSnackbarMessage('Error al copiar la lista');
        setSnackbarVisible(true);
      }
    } else { // For 'ios', 'android'
      try {
        Share.share({
          message: finalText,
        });
      } catch (error) {
        console.error('Error sharing:', error);
        // Optionally set a snackbar message for sharing errors too
        // setSnackbarMessage('Error al compartir la lista');
        // setSnackbarVisible(true);
      }
    }
  }, [categorizedSelectedSongs, selectedSongs]); // Dependencies for useCallback

  const handleSongPress = (song: Song) => {
    // Retrieve full song info from JSON to ensure we have the content
    const completeSong = Object.values(allSongsData).flat().find(
      s => s.filename === song.filename
    );

    if (!completeSong) {
      console.error('Song not found in allSongsData:', song.filename);
      return;
    }

    const allSelected = categorizedSelectedSongs.flatMap(cat => cat.data);
    const index = allSelected.findIndex(s => s.filename === completeSong.filename);

    navigation.navigate('SongDetail', {
      filename: completeSong.filename,
      title: completeSong.title,
      ...(completeSong.author && { author: completeSong.author }),
      ...(completeSong.key && { key: completeSong.key }),
      ...(typeof completeSong.capo !== 'undefined' && { capo: completeSong.capo }),
      content: completeSong.content || '',
      navigationList: allSelected,
      currentIndex: index,
      source: 'selection',
    });
  };

  const renderCategory = ({ item }: { item: CategorizedSongs }) => (
    <View style={styles.categoryContainer}>
      <Text style={styles.categoryTitle}>{item.categoryTitle}</Text>
      {item.data
        .filter((song): song is Song & { filename: string } => 
          song && typeof song.filename === 'string' && song.filename.length > 0
        )
        .map(song => (
        <SongListItem
          key={song.filename} // Now song.filename is guaranteed to be a valid string
          song={song}
          onPress={handleSongPress}
        />
      ))}
    </View>
  );

  useLayoutEffect(() => {
    if (selectedSongs.length > 0) {
      const isDesktopLike = Platform.OS === 'web' || Platform.OS === 'windows' || Platform.OS === 'macos';
      navigation.setOptions({
        headerRight: () => (
          <TouchableOpacity onPress={handleExport} style={{ paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center' }}>
            <IconSymbol 
              name={isDesktopLike ? "doc.on.doc" : "square.and.arrow.up"} 
              size={24} 
              color="#fff" // Reverted to original white color, assuming header has dark background or text color will be set by theme
            />
            {isDesktopLike && (
              <Text style={{ color: '#fff', marginLeft: 8, fontSize: 16, fontWeight: '500' }}>Copiar</Text>
            )}
          </TouchableOpacity>
        ),
      });
    } else {
      navigation.setOptions({
        headerRight: () => null, // No export button if no songs are selected
      });
    }
  }, [navigation, handleExport, selectedSongs.length]);

  if (selectedSongs.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <IconSymbol name="music.note.list" size={60} color="#cccccc" />
        <Text style={styles.emptyText}>Todavía no has seleccionado canciones</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
          <Text style={styles.screenTitle}>Tu selección de temazos {randomEmoji}</Text>
          <View style={styles.buttonsContainer}>
            <TouchableOpacity onPress={clearSelection} style={styles.clearButton}>
               <IconSymbol name="trash" size={20} color="#FF4444" />
              <Text style={styles.clearButtonText}>Borrar selección</Text>
            </TouchableOpacity>
            {/* Export button moved to header */}
          </View>
      </View>

      <FlatList
        data={categorizedSelectedSongs}
        renderItem={renderCategory}
        keyExtractor={(item) => item.categoryTitle}
        contentContainerStyle={styles.listContentContainer}
      />
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        action={{
          label: 'Cerrar',
          onPress: () => {
            setSnackbarVisible(false);
          },
        }}
        duration={Snackbar.DURATION_MEDIUM}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
};

function SelectedSongsScreenWithProvider() {
  return (
    <PaperProvider>
      <SelectedSongsScreen />
    </PaperProvider>
  );
}

const createStyles = (scheme: 'light' | 'dark' | null) => {
  const isDark = scheme === 'dark';
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? Colors.dark.background : '#f8f8f8',
    },
    headerContainer: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 10,
      backgroundColor: isDark ? '#2C2C2E' : '#fff',
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#444' : '#e0e0e0',
    },
    screenTitle: {
      fontSize: 24,
      fontWeight: '600',
      marginBottom: 15,
      color: isDark ? '#FFFFFF' : '#333',
      textAlign: 'center',
    },
    buttonsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: 15,
      alignItems: 'center',
  },
    clearButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 15,
      backgroundColor: isDark ? '#663333' : '#ffebee',
      borderRadius: 8,
      flex: 0.48,
      marginHorizontal: 5,
    },
    clearButtonText: {
      marginLeft: 8,
      fontSize: 16,
      fontWeight: '500',
      color: '#FF4444',
    },
    listContentContainer: {
      paddingBottom: 20,
    },
    categoryContainer: {
      marginTop: 15,
      marginHorizontal: 10,
      backgroundColor: isDark ? '#2C2C2E' : '#fff',
      borderRadius: 8,
      overflow: 'hidden',
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    categoryTitle: {
      fontSize: 18,
      fontWeight: '600',
      padding: 15,
      backgroundColor: isDark ? '#3A3A3C' : '#f0f0f0',
      color: isDark ? '#FFFFFF' : '#444',
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#444' : '#e0e0e0',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      backgroundColor: isDark ? Colors.dark.background : '#f8f8f8',
    },
    emptyText: {
      marginTop: 16,
      fontSize: 18,
      color: isDark ? '#CCCCCC' : '#666',
      textAlign: 'center',
    },
    songNumber: {
      fontSize: 12,
      color: '#666',
      marginLeft: 4,
    },
    songAuthor: {
      fontSize: 12,
      color: '#666',
      marginLeft: 4,
    },
    songSubtitle: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
  });
};

export default SelectedSongsScreenWithProvider; // Export the wrapped component with PaperProvider
