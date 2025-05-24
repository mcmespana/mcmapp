import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { ChordProParser, HtmlDivFormatter } from 'chordsheetjs';
import { RouteProp } from '@react-navigation/native';

interface SongDetailParams {
  filename: string;
  title: string;
}

interface Props {
  route: RouteProp<Record<string, SongDetailParams>, string>;
}

export default function SongDetailScreen({ route }: Props) {
  const { filename, title } = route.params;
  const [songHtml, setSongHtml] = useState('');

  useEffect(() => {
    const loadSong = async () => {
      const chordPro = await FileSystem.readAsStringAsync(`songs/${filename}`);
      const parser = new ChordProParser();
      const song = parser.parse(chordPro);
      const formatter = new HtmlDivFormatter();
      setSongHtml(formatter.format(song));
    };
    loadSong();
  }, [filename]);

  return (
    <ScrollView style={{ padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 10 }}>{title}</Text>
      <Text>{songHtml.replace(/<[^>]*>?/gm, '')}</Text>
    </ScrollView>
  );
}
