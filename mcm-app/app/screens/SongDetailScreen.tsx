import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { ChordProParser, HtmlDivFormatter } from 'chordsheetjs';
import { RouteProp } from '@react-navigation/native';

type RootStackParamList = {
  SongDetail: {
    songId: string;
    songTitle?: string;
  };
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
        // Obtener la referencia al asset
        const asset = Asset.fromModule(require('../../assets/songs/' + songId));
        
        // Esperar a que el asset esté descargado
        if (!asset.localUri) {
          await asset.downloadAsync();
        }

        // Leer el archivo
        const chordPro = await FileSystem.readAsStringAsync(asset.localUri || asset.uri);
        const parser = new ChordProParser();
        const song = parser.parse(chordPro);
        const formatter = new HtmlDivFormatter();
        setSongHtml(formatter.format(song));
      } catch (error) {
        console.error('Error cargando canción en SongDetailScreen:', error);
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