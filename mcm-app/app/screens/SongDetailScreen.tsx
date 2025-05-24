import { useEffect, useState } from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { ChordProParser, HtmlDivFormatter } from 'chordsheetjs';
import { SongFilename } from '../../assets/songs';
import { songAssets } from '../../assets/songs/index';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../(tabs)/cancionero';

type SongDetailScreenRouteProp = RouteProp<RootStackParamList, 'SongDetail'>;

interface SongDetailScreenProps {
  route: SongDetailScreenRouteProp;
}

export default function SongDetailScreen({ route }: SongDetailScreenProps) {
  const { filename, title } = route.params;
  const [songHtml, setSongHtml] = useState<string>('Cargando…');

  useEffect(() => {
    (async () => {
      try {
        // 1. Get the asset module (an internal number)
        const assetModule = songAssets[filename as keyof typeof songAssets];
        if (!assetModule) throw new Error(`Asset no encontrado: ${filename}`);

        // 2. Creamos el Asset de expo-asset y lo descargamos
        const asset = Asset.fromModule(assetModule);
        await asset.downloadAsync();

        // 3. Leemos el contenido raw desde su localUri
        const chordPro = await FileSystem.readAsStringAsync(asset.localUri!);

        // 4. Parseamos y formateamos con chordsheetjs
        const parser = new ChordProParser();
        const song = parser.parse(chordPro);
        const formatter = new HtmlDivFormatter();
        const formattedSongContent = formatter.format(song);

        const injectedCss = `
          body {
            font-family: 'Menlo', 'DejaVu Sans Mono', 'Liberation Mono', 'Consolas', 'Courier New', monospace;
            font-size: 15px; /* Ajusta el tamaño de fuente base */
            line-height: 1.6; /* Altura de línea general para el cuerpo */
            margin: 10px;
            background-color: #FFFFFF;
            color: #000000;
          }
          .title { /* Para <h1 class="title"> */
            font-size: 1.5em; /* Más grande que el texto normal */
            font-weight: bold;
            margin-bottom: 1em;
            text-align: center;
          }
          .chord-sheet { /* Para <div class="chord-sheet"> */
            /* Estilos para el contenedor principal si son necesarios */
          }
          .paragraph { /* Para <div class="paragraph"> */
            margin-bottom: 1.2em; /* Espacio entre estrofas/secciones */
          }
          .row { /* Para <div class="row"> */
            margin-bottom: 0.6em; /* Espacio después de cada línea de canción (par acorde/letra) */
            line-height: 1.3; /* Altura de línea para las filas de canción */
            /* white-space: nowrap; /* Descomentar si prefieres scroll horizontal a que las líneas largas se rompan */
          }
          .column { /* Para <div class="column"> */
            display: inline-block;
            vertical-align: bottom;
            padding-right: 3px; /* Espacio entre segmentos de acorde/letra */
            white-space: pre; /* Mantiene los espacios dentro de cada segmento */
          }
          .chord { /* Para <div class="chord"> */
            font-weight: bold;
            color: #0000FF; /* Color de los acordes */
            font-size: 0.95em; /* Un poco más pequeño si es necesario para alineación */
            display: block; /* Asegura que el acorde esté encima de la letra DENTRO de su columna */
            min-height: 1.1em; /* Espacio para el acorde incluso si está vacío */
          }
          .lyrics { /* Para <div class="lyrics"> */
            font-size: 1em; /* Tamaño de la letra */
            display: block; /* Asegura que la letra esté debajo del acorde DENTRO de su columna */
          }
        `;

        const finalHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <style>
              ${injectedCss}
            </style>
          </head>
          <body>
            ${formattedSongContent}
          </body>
          </html>
        `;

        // 5. Usamos el HTML final con CSS inyectado
        setSongHtml(finalHtml);
      } catch (err) {
        console.error('Error cargando canción en SongDetailScreen:', err);
        setSongHtml('❌ Error cargando canción');
      }
    })();
  }, [filename]);

  // Estilo para el contenedor del WebView para que ocupe espacio
  const webViewContainerStyle = songHtml.startsWith('❌') || songHtml === 'Cargando…' 
    ? styles.messageContainer // Estilo para mensajes de carga/error
    : styles.webViewContainer; // Estilo para el WebView con contenido

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <View style={webViewContainerStyle}>
        {songHtml.startsWith('❌') || songHtml === 'Cargando…' ? (
          <Text style={styles.content}>{songHtml}</Text>
        ) : (
          <WebView
            originWhitelist={['*']}
            source={{ html: songHtml }}
            style={styles.webView}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  messageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webViewContainer: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  content: { fontSize: 16, fontFamily: 'monospace' }, // Cambiado a monospace para mejor visualización de acordes si se usara Text
  webView: {
    flex: 1,
  }
});





// ESTO FUE LA PRIMERA OPCIÓN


/*import { useEffect, useState } from 'react';
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
        /*const asset = Asset.fromModule(require(`songs/${songId}`));
        await asset.downloadAsync(); // Asegurarse de que el asset esté descargado

        const chordPro = await FileSystem.readAsStringAsync(asset.localUri || asset.uri);*/
      
      
      //const chordPro = await FileSystem.readAsStringAsync(`songs/${songId}`);
      //const fileUri = `${FileSystem.bundleDirectory}assets/songs/${songId}`;
            
      //const chordPro = await FileSystem.readAsStringAsync(fileUri);
/*
      const fileUri = `${FileSystem.bundleDirectory}assets/songs/${songId}`;
      const chordPro = await FileSystem.readAsStringAsync(fileUri);
      
      const parser = new ChordProParser();
      const song = parser.parse(chordPro);
      const formatter = new HtmlDivFormatter();
      setSongHtml(formatter.format(song));

      } catch (error) {
        console.error('Error cargando canción en SongDetailSecreen:', error);
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
*/