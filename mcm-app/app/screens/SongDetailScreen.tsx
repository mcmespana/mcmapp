import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { ChordProParser, HtmlDivFormatter } from 'chordsheetjs';
import { RouteProp } from '@react-navigation/native';

// Define the RootStackParamList here since we can't import from the tabs directory
type RootStackParamList = {
  SongDetail: {
    songId: string;
    songTitle?: string;
  };
  // Add other screen params as needed
};

interface Props {
  route: RouteProp<RootStackParamList, 'SongDetail'>;
}

export default function SongDetailScreen({ route }: Props) {
  const { songId, songTitle } = route.params;
  const [songHtml, setSongHtml] = useState('');

  useEffect(() => {
    const loadSong = async () => {
      try {
        // Assuming songId is the filename or can be used to construct the path
        const chordPro = await FileSystem.readAsStringAsync(`songs/${songId}`);
      const parser = new ChordProParser();
      const song = parser.parse(chordPro);
      const formatter = new HtmlDivFormatter();
      setSongHtml(formatter.format(song));
      } catch (error) {
        console.error('Error loading song:', error);
        // Handle error appropriately
      }
    };
    
    if (songId) {
    loadSong();
    }
  }, [songId]);

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      {songTitle && <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 16 }}>{songTitle}</Text>}
      {songHtml ? (
      <Text>{songHtml.replace(/<[^>]*>?/gm, '')}</Text>
      ) : (
        <Text>Loading song...</Text>
      )}
    </ScrollView>
  );
}
