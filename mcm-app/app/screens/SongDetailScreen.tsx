import { useEffect, useState } from 'react';
import { ScrollView, Text, StyleSheet, useWindowDimensions, ActivityIndicator, View, TouchableOpacity, Modal, Button } from 'react-native';
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
  const [isLoading, setIsLoading] = useState(true);

  const { width } = useWindowDimensions();

  // New states for controls
  const [originalChordPro, setOriginalChordPro] = useState<string | null>(null);
  const [chordsVisible, setChordsVisible] = useState(true);
  const [currentTranspose, setCurrentTranspose] = useState(0); // Semitones: 0 is original, positive up, negative down
  const [showActionButtons, setShowActionButtons] = useState(false);
  const [showTransposeModal, setShowTransposeModal] = useState(false);

  // Function to parse and display the song
  const displaySong = async (chordProContent: string, transposeSteps: number, showChords: boolean) => {
    setIsLoading(true);
    try {
      let processedChordPro = chordProContent;

      // Remove existing transpose directive if any, to apply a new one cleanly
      processedChordPro = processedChordPro.replace(/\{transpose:.*\}\n?/gi, '');

      if (transposeSteps !== 0) {
        // ChordPro transpose: 1-11. 1 is +1 semitone, 11 is -1 semitone (or +11).
        let chordProTransposeValue = transposeSteps > 0 ? transposeSteps % 12 : (transposeSteps % 12 + 12) % 12;
        if (chordProTransposeValue === 0 && transposeSteps !==0) chordProTransposeValue = 12; // Should not happen if logic is correct, but as a fallback for full octave.
        // Actually, chordsheetjs might handle negative values or values outside 1-11 directly or via its own logic.
        // For simplicity with {transpose: N}, we'll stick to positive N for now and test.
        // Let's assume chordsheetjs handles {transpose: N} where N is semitones directly.
        // If not, we'd need to convert: e.g. -1 semitone -> {transpose: 11}, -2 -> {transpose: 10}
        // For now, let's try passing the direct semitone count.
        processedChordPro = `{transpose: ${transposeSteps}}\n${processedChordPro}`;
      }

      const parser = new ChordProParser();
      const song = parser.parse(processedChordPro);
      const formatter = new HtmlDivFormatter();
      let formattedSong = formatter.format(song);

      // Build meta HTML for author, key, capo (title comes from formattedSong)
      let metaInsert = '';
      if (author) {
        metaInsert += `<div class="song-meta-author">${author}</div>`;
      }
      let keyCapoString = '';
      if (key) {
        keyCapoString += key.toUpperCase();
      }
      if (capo !== undefined && capo > 0) {
        keyCapoString += (key ? ' - ' : '') + `Cejilla ${capo}`;
      }
      if (currentTranspose !== 0) {
        keyCapoString += (keyCapoString ? ' | ' : '') + `Cambio tono: ${currentTranspose > 0 ? '+' : ''}${currentTranspose}`;
      }
      if (keyCapoString) {
        metaInsert += `<div class="song-meta-keycapo">${keyCapoString}</div>`;
      }

      // Inject metaInsert after the main title in formattedSong
      let finalSongContentWithMeta = formattedSong;
      if (metaInsert) {
        const titleEndTag = '</h1>'; // Assuming chordsheetjs uses <h1> for title
        const titleEndIndex = formattedSong.indexOf(titleEndTag);
        if (titleEndIndex !== -1) {
          const insertionPoint = titleEndIndex + titleEndTag.length;
          finalSongContentWithMeta =
            formattedSong.substring(0, insertionPoint) +
            metaInsert +
            formattedSong.substring(insertionPoint);
        } else {
          // Fallback: if no <h1>, prepend meta to the whole song (less ideal)
          finalSongContentWithMeta = metaInsert + formattedSong;
        }
      }

      const chordsCss = showChords ? '' : '<style>.chord { display: none !important; }</style>';

      const finalHtml = `
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
          <style>
            body {
              font-family: 'Menlo', 'DejaVu Sans Mono', 'Liberation Mono', 'Consolas', 'Courier New', monospace;
              font-size: 15px;
              line-height: 1.6;
              margin: 10px;
              color: #000000;
            }
            /* Song Title (from ChordPro, e.g., h1 or .title) */
            h1, .title {
              font-size: 1.6em;
              font-weight: bold;
              color: #000;
              margin-top: 0;
              margin-bottom: 0.3em; /* Space after title */
              text-align: center;
            }
            /* Meta information (author, key/capo) */
            .song-meta-author, .song-meta-keycapo {
              font-size: 1em;
              color: #333;
              text-align: center;
              margin-bottom: 0.5em;
            }
            .song-meta-keycapo {
              margin-bottom: 1.5em; /* More space before song content */
            }
            /* ChordSheetJS generated content */
            .chord-sheet { /* Main container by chordsheetjs */
            }
            .paragraph { /* Groups of rows, e.g., verse, chorus */
              margin-bottom: 1em; /* Space between paragraphs/sections */
            }
            .row {
              line-height: 1.4; /* Specific line height for song lines */
              margin-bottom: 0.2em; /* Minimal space after each song line */
            }
            .column {
              display: inline-block;
              vertical-align: bottom;
              padding-right: 2px;
              white-space: pre; /* CRITICAL for monospace alignment */
            }
            .chord {
              font-weight: bold;
              color: #007bff; /* User likes this blue */
              font-size: 0.95em;
              display: block;
              min-height: 1.1em;
            }
            .lyrics {
              font-size: 1em;
              display: block;
            }
            .comment, .c {
              color: #6c757d; /* Subtler comment color */
              font-style: italic;
            }
            .chorus .lyrics, .chorus .chord {
              /* font-style: italic; */ /* User might not want this globally */
            }
          </style>
          ${chordsCss}
        </head>
        <body>
          ${finalSongContentWithMeta} 
        </body>
        </html>
      `;

      setSongHtml(finalHtml);
    } catch (err) {
      console.error('Error procesando canción en SongDetailScreen:', err);
      setSongHtml('❌ Error cargando canción disculpas 🥺');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      if (!filename) {
        setSongHtml('No se ha proporcionado un nombre de archivo para la canción.');
        setIsLoading(false);
        return;
      }
      try {
        const assetModule = songAssets[filename as SongFilename];
        if (!assetModule) {
          throw new Error(`Asset no encontrado para el filename: ${filename}.`);
        }
        const asset = Asset.fromModule(assetModule);
        await asset.downloadAsync();
        if (!asset.localUri) {
          throw new Error(`Failed to download asset or localUri is not set for ${filename}`);
        }
        const rawChordPro = await FileSystem.readAsStringAsync(asset.localUri);
        setOriginalChordPro(rawChordPro);
      } catch (err) {
        console.error('Error cargando canción en SongDetailScreen (useEffect filename):', err);
        setSongHtml('❌ Error crítico al cargar datos de la canción.');
        setIsLoading(false);
      }
    })();
  }, [filename]);
  useEffect(() => {
    if (originalChordPro !== null) {
      displaySong(originalChordPro, currentTranspose, chordsVisible);
    }
  }, [originalChordPro, currentTranspose, chordsVisible]);

  const handleToggleChords = () => setChordsVisible(!chordsVisible);
  const handleOpenTransposeModal = () => setShowTransposeModal(true);
  const handleChangeNotation = () => { /* Placeholder */ alert('Notación (Próximamente)'); };
  const handleSetTranspose = (semitones: number) => {
    setCurrentTranspose(semitones);
    setShowTransposeModal(false);
  };

  return (
    <View style={styles.container}>
      {/* The screen title for React Navigation is set in cancionero.tsx options */}
      {/* The song's main title, author, key, capo are now rendered inside the WebView below */}
      {/* <Text style={styles.title}>{navScreenTitle}</Text> */}
      <View style={styles.webViewContainer}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#0000ff" />
        ) : (
          <WebView
            originWhitelist={['*']}
            source={{ html: songHtml }}
            style={styles.webView}
          />
        )}
      </View>

      {/* FABs */}
      <View style={styles.fabContainer}>
        {showActionButtons && (
          <View style={styles.fabActionsContainer}>
            <TouchableOpacity style={styles.fabAction} onPress={handleToggleChords}>
              <Text style={styles.fabActionText}>{chordsVisible ? 'Acordes OFF' : 'Acordes ON'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.fabAction} onPress={handleOpenTransposeModal}>
              <Text style={styles.fabActionText}>Cambiar tono</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.fabAction} onPress={handleChangeNotation}>
              <Text style={styles.fabActionText}>Notación</Text>
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity style={styles.fabMain} onPress={() => setShowActionButtons(!showActionButtons)}>
          <Text style={styles.fabMainText}>{showActionButtons ? '✕' : '🛠️'}</Text>
        </TouchableOpacity>
      </View>

      {/* Transpose Modal */}
      <Modal
        transparent={true}
        visible={showTransposeModal}
        onRequestClose={() => setShowTransposeModal(false)}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cambio tono</Text>
            <View style={styles.transposeButtonRow}>
              <Button title="+1/2 tono" onPress={() => handleSetTranspose(currentTranspose + 1)} />
              <Button title="+1 tono" onPress={() => handleSetTranspose(currentTranspose + 2)} />
            </View>
            <View style={styles.transposeButtonRow}>
              <Button title="-1/2 tono" onPress={() => handleSetTranspose(currentTranspose - 1)} />
              <Button title="-1 tono" onPress={() => handleSetTranspose(currentTranspose - 2)} />
            </View>
            <Button title="Tono Original 🔄" onPress={() => handleSetTranspose(0)} />
            <Button title="Volver" onPress={() => setShowTransposeModal(false)} color="#888"/>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // ... existing styles ...
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    alignItems: 'flex-end',
  },
  fabActionsContainer: {
    marginBottom: 10,
    alignItems: 'flex-end',
  },
  fabMain: {
    backgroundColor: '#f4c11e',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8, // Android shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  fabMainText: {
    fontSize: 24,
    color: 'white',
  },
  fabAction: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    borderWidth: 1,
    borderColor: '#f4c11e',
  },
  fabActionText: {
    color: '#f4c11e',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  transposeButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 10,
  },
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

