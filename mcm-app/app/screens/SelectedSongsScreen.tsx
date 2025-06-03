import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
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
  const [categorizedSelectedSongs, setCategorizedSelectedSongs] = useState<CategorizedSongs[]>([]);

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

  const handleSongPress = (song: Song) => {
    navigation.navigate('SongDetail', {
      filename: song.filename,
      title: song.title,
      ...(song.author && { author: song.author }),
      ...(song.key && { key: song.key }),
      ...(typeof song.capo !== 'undefined' && { capo: song.capo }),
      content: song.content || '', // Ensure content is not undefined
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
          onPress={() => handleSongPress(song)}
        />
      ))}
    </View>
  );

  if (selectedSongs.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <IconSymbol name="music.note.list" size={60} color="#cccccc" />
        <Text style={styles.emptyText}>No has seleccionado ninguna canción todavía.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.screenTitle}>Tu selección de canciones</Text>
        <TouchableOpacity onPress={clearSelection} style={styles.clearButton}>
          <IconSymbol name="trash" size={20} color="#007AFF" />
          <Text style={styles.clearButtonText}>Limpiar selección</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={categorizedSelectedSongs}
        renderItem={renderCategory}
        keyExtractor={(item) => item.categoryTitle}
        contentContainerStyle={styles.listContentContainer}
      />
    </View>
  );
};

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
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: '#e7e7ff',
    borderRadius: 8,
    alignSelf: 'center', // Center button
    marginBottom: 10,
  },
  clearButtonText: {
    marginLeft: 8,
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
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

export default SelectedSongsScreen;
