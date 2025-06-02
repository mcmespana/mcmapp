import React, { useEffect, useState, useLayoutEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ScrollView, Platform, Share } from 'react-native';
import { Button, Provider as PaperProvider, Snackbar } from 'react-native-paper';
import * as Clipboard from 'expo-clipboard';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useSelectedSongs } from '../../contexts/SelectedSongsContext';
import SongListItem from '../../components/SongListItem';
import { IconSymbol } from '../../components/ui/IconSymbol'; // Corrected path
import allSongsData from '../../assets/songs.json';
import { RootStackParamList } from '../(tabs)/cancionero'; // For navigation types

// Define Song type based on songs.json structure
interface Song {
  title: string;
  filename: string;
  author?: string;
  key?: string;
  capo?: number;
  info?: string;
}

interface CategorizedSongs {
  categoryTitle: string;
  data: Song[];
}

// Navigation prop type
type SelectedSongsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'SongDetail'>;

const SelectedSongsScreen: React.FC = () => {
  // const { selectedSongs, clearSelection } = useSelectedSongs(); // Moved up

  const { selectedSongs, clearSelection } = useSelectedSongs();
  const navigation = useNavigation<SelectedSongsScreenNavigationProp>();
  const [categorizedSelectedSongs, setCategorizedSelectedSongs] = useState<CategorizedSongs[]>([]);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

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

          const songIdMatch = song.title.match(/^(\d+)\./);
          const songId = songIdMatch ? songIdMatch[1] : '??';

          let line = `*${categoryLetter}.* ${songTitleClean}`;
          if (chordCapoString) {
            line += ` · ${chordCapoString}`;
          }
          line += ` · *[#${songId}]*`;
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
    navigation.navigate('SongDetail', {
      ...song, // Spread all properties from the song object
      content: "" // Add the missing content property directly
    });
  };

  const renderCategory = ({ item }: { item: CategorizedSongs }) => (
    <View style={styles.categoryContainer}>
      <Text style={styles.categoryTitle}>{item.categoryTitle}</Text>
      {item.data.map(song => (
        <SongListItem
          key={song.filename}
          song={song}
          onPress={() => handleSongPress(song)}
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
        <Text style={styles.screenTitle}>Tu selección de temazos</Text>
          <View style={styles.buttonsContainer}>
            <TouchableOpacity onPress={clearSelection} style={styles.clearButton}>
              <IconSymbol name="trash" size={20} color="#007AFF" />
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

// Wrap the export with PaperProvider
const SelectedSongsScreenWithProvider: React.FC = () => (
  <PaperProvider>
    <SelectedSongsScreen />
  </PaperProvider>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
    textAlign: 'center',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
    alignItems: 'center', // Align items vertically
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10, // Keep similar padding
    paddingHorizontal: 15, // Keep similar padding
    backgroundColor: '#e7e7ff',
    borderRadius: 8,
    flex: 0.48, // Adjust flex to slightly less than half to create a small gap if space-around is not enough
    marginHorizontal: 5,
  },
  clearButtonText: {
    marginLeft: 8,
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  exportButton: {
    flex: 0.48, // Adjust flex to slightly less than half
    marginHorizontal: 5,
    // backgroundColor: '#C8E6C9', // A light green, distinct from blue
  },
  listContentContainer: {
    paddingBottom: 20,
  },
  categoryContainer: {
    marginTop: 15,
    marginBottom: 5,
    marginHorizontal: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden', // Ensures SongListItem borders don't exceed rounded corners
    elevation: 1, // for Android shadow
    shadowColor: '#000', // for iOS shadow
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    padding: 15,
    backgroundColor: '#f0f0f0', // Light grey background for category header
    color: '#444',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f8f8',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
  },
});

export default SelectedSongsScreenWithProvider;
