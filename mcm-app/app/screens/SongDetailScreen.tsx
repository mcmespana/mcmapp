import { useEffect, useState } from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { ChordProParser, HtmlDivFormatter } from 'chordsheetjs';
import { SongFilename } from '../../assets/songs'; // Re-added
import { songAssets } from '../../assets/songs/index'; // Re-added
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../(tabs)/cancionero';

type SongDetailScreenRouteProp = RouteProp<RootStackParamList, 'SongDetail'>;

interface SongDetailScreenProps {
  route: SongDetailScreenRouteProp;
}

export default function SongDetailScreen({ route }: SongDetailScreenProps) {
  // title from params is for the navigation screen header, actual song title rendered by WebView
  const { filename, title: navScreenTitle, author, key, capo } = route.params;
  const [songHtml, setSongHtml] = useState<string>('Cargando…');

  useEffect(() => {
    (async () => {
      try {
        // 1. Get the asset module (an internal number) using the static index
        const assetModule = songAssets[filename as SongFilename]; // Cast filename to SongFilename
        if (!assetModule) {
          throw new Error(`Asset no encontrado para el filename: ${filename}. Asegúrate de que está en assets/songs/index.ts`);
        }

        // 2. Create the Asset from the module and download it
        const asset = Asset.fromModule(assetModule);
        await asset.downloadAsync();

        if (!asset.localUri) {
          throw new Error(`Failed to download asset or localUri is not set for ${filename}`);
        }

        // 3. Read the raw content from its localUri
        const chordPro = await FileSystem.readAsStringAsync(asset.localUri);

        // 4. Parse and format with chordsheetjs
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
            margin-bottom: 0.2em; /* Reducido para acercar metadatos */
            text-align: center;
          }
          .song-meta-author {
            font-size: 0.9em;
            color: #555;
            text-align: center;
            margin-bottom: 0.5em;
          }
          .song-meta-keycapo {
            font-size: 1em;
            font-weight: bold;
            color: #333;
            text-align: center;
            margin-bottom: 1.5em;
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

        let metaHtml = '';
        if (author) {
          metaHtml += `<div class="song-meta-author">${author}</div>`;
        }
        let keyCapoString = '';
        if (key) {
          keyCapoString += key.toUpperCase();
        }
        if (capo !== undefined && capo > 0) {
          keyCapoString += (key ? ' - ' : '') + `Cejilla ${capo}`;
        }
        if (keyCapoString) {
          metaHtml += `<div class="song-meta-keycapo">${keyCapoString}</div>`;
        }

        // metaHtml (for author, key, capo) is already prepared from the successfully applied part of the previous edit.
        
        let finalSongContentWithMeta = formattedSongContent;
        const titleEndTag = '</h1>';
        const titleEndIndex = formattedSongContent.indexOf(titleEndTag);

        if (titleEndIndex !== -1 && metaHtml) {
          const insertionPoint = titleEndIndex + titleEndTag.length;
          finalSongContentWithMeta = 
            formattedSongContent.substring(0, insertionPoint) +
            metaHtml + // Inject author, key, capo here
            formattedSongContent.substring(insertionPoint);
        } else if (metaHtml) {
          // Fallback: if no <h1> or metaHtml is empty, but we have meta, prepend it.
          finalSongContentWithMeta = metaHtml + formattedSongContent;
        }
        // If metaHtml is empty, finalSongContentWithMeta remains formattedSongContent

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
            ${finalSongContentWithMeta} 
          </body>
          </html>
        `;

        // 5. Usamos el HTML final con CSS inyectado
        setSongHtml(finalHtml);
      } catch (err) {
        console.error('Error cargando canción en SongDetailScreen:', err);
        setSongHtml('❌ Error cargando canción disculpas 🥺');
      }
    })();
  }, [filename]);

  // Estilo para el contenedor del WebView para que ocupe espacio
  const webViewContainerStyle = songHtml.startsWith('❌') || songHtml === 'Cargando…' 
    ? styles.messageContainer // Estilo para mensajes de carga/error
    : styles.webViewContainer; // Estilo para el WebView con contenido

  return (
    <View style={styles.container}>
      {/* The screen title for React Navigation is set in cancionero.tsx options */}
      {/* The song's main title, author, key, capo are now rendered inside the WebView below */}
      {/* <Text style={styles.title}>{navScreenTitle}</Text> */}
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

