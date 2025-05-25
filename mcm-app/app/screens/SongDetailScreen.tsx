import { useEffect, useState } from 'react';
import { ScrollView, Text, StyleSheet, useWindowDimensions, ActivityIndicator, View, TouchableOpacity, Modal, Button, TouchableWithoutFeedback } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../styles/theme';
import { ChordProParser, HtmlDivFormatter } from 'chordsheetjs';
import { SongFilename } from '../../assets/songs'; // Re-added
import { songAssets } from '../../assets/songs/index'; // Re-added
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../(tabs)/cancionero';

const availableFonts = [
  { name: 'Monoespaciada', cssValue: "'Roboto Mono', 'Courier New', monospace" },
  { name: 'Serif', cssValue: "'Georgia', 'Times New Roman', serif" },
  { name: 'Sans-Serif', cssValue: "'Helvetica Neue', 'Arial', sans-serif" },
];

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
  const [isNotationFabActive, setIsNotationFabActive] = useState(false);
  const [currentFontSizeEm, setCurrentFontSizeEm] = useState(1.0); // Base font size is 1em
  const [showFontSizeModal, setShowFontSizeModal] = useState(false);
  const [currentFontFamily, setCurrentFontFamily] = useState(availableFonts[0].cssValue); // Default to mono, availableFonts is now at top
  const [showFontFamilyModal, setShowFontFamilyModal] = useState(false);

  // Function to parse and display the song
  const displaySong = async (chordProContent: string, transposeSteps: number, showChords: boolean, fontSize: number, fontFamily: string) => {
    setIsLoading(true);
    try {
      let processedChordPro = chordProContent;

      // Normalize ChordPro section tags (e.g., {soc} to {start_of_chorus})
      processedChordPro = processedChordPro.replace(/\{sov\}/gi, '{start_of_verse}')
                                     .replace(/\{eov\}/gi, '{end_of_verse}')
                                     .replace(/\{soc\}/gi, '{start_of_chorus}')
                                     .replace(/\{eoc\}/gi, '{end_of_chorus}')
                                     .replace(/\{sob\}/gi, '{start_of_bridge}')
                                     .replace(/\{eob\}/gi, '{end_of_bridge}');

      // Remove existing transpose directive if any, to apply a new one cleanly
      processedChordPro = processedChordPro.replace(/\{transpose:.*\}\n?/gi, '');

      if (transposeSteps !== 0) {
        const chordProValueForDirective = transposeSteps < 0 ? transposeSteps + 12 : transposeSteps;
        if (chordProValueForDirective !== 0) {
          processedChordPro = `{transpose: ${chordProValueForDirective}}\n${processedChordPro}`;
        }
      }

      // Apply font size adjustments
      // Ensure base font size for lyrics and chords is 1em in the main style block
      // The title (h1) and meta info should not be affected by this specific adjustment
      const fontSizeCss = `
        .chord-sheet .lyrics, .chord-sheet .chord {
          font-size: ${fontSize}em !important;
        }
      `;

      const parser = new ChordProParser();
      const song = parser.parse(processedChordPro);
      const formatter = new HtmlDivFormatter();
      let formattedSong = formatter.format(song);

      // Build meta HTML for author, key, capo (title comes from formattedSong)
      let metaInsert = '';
      if (author) {
        metaInsert += `<div class="song-meta-author">${author}</div>`;
      }
      let finalKeyCapoString = '';
      if (key) {
        finalKeyCapoString += `<strong>${key.toUpperCase()}</strong>`;
      }

      if (capo !== undefined && capo > 0) {
        if (finalKeyCapoString) finalKeyCapoString += ' - ';
        finalKeyCapoString += `Cejilla ${capo}`;
      }

      if (currentTranspose !== 0) {
        if (finalKeyCapoString) finalKeyCapoString += ' / ';
        const transposeDisplay = currentTranspose > 0 ? `+${currentTranspose}` : `${currentTranspose}`;
        finalKeyCapoString += `<strong>Semitonos: ${transposeDisplay}</strong>`;
      }

      if (finalKeyCapoString) {
        metaInsert += `<div class="song-meta-keycapo">${finalKeyCapoString}</div>`;
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
              font-family: ${fontFamily};
              margin: 10px;
              background-color: #ffffff; /* UPDATED: White background */
              color: ${AppColors.textDark};
              font-size: 100%; /* Base for em units */
            }
            h1 {
              color: #333;
              margin-bottom: 0.2em;
              font-size: 1.6em; /* Fixed size relative to body */
              text-align: center; /* ADDED: Centered title */
            }
            .song-meta-author {
              color: #777; /* UPDATED: Lighter grey */
              font-size: 0.9em; /* Relative to body */
              margin-bottom: 5px; /* Adjusted margin */
              font-style: italic; /* ADDED: Italic author */
              text-align: center; /* ADDED: Centered author */
            }
            .song-meta-keycapo {
              color: #555; /* Original color for non-bold parts */
              font-size: 0.9em; /* Relative to body */
              margin-bottom: 10px;
              text-align: center; /* ADDED: Centered key/capo info */
            }
            .song-meta-keycapo strong {
              font-weight: bold; /* Ensures parts wrapped in <strong> are bold */
            }
            .chord-sheet {
              margin-top: 1em;
              text-align: left; /* Ensure song content itself is left-aligned */
            }
            .row {
              display: flex;
              flex-wrap: wrap;
              margin-bottom: 0.2em;
            }
            .column {
              padding-right: 0; /* Ajustado para evitar espacios extra dentro de las palabras */
            }
            .chord-sheet .chord {
              color: ${AppColors.primary};
              font-weight: bold;
              white-space: pre;
              display: block;
              min-height: 1.2em;
            }
            .chord-sheet .lyrics {
              white-space: pre;
              display: block;
              min-height: 1.2em;
            }
            .comment, .c {
              color: ${AppColors.secondaryText};
              font-style: italic;
              white-space: pre;
              display: block;
              margin-top: 0.5em;
              margin-bottom: 0.5em;
            }
            /* Styles for song sections (verse, chorus, bridge) */
            .paragraph {
              margin-top: 1.75em; /* Aumentado para mayor separación entre estrofas (0.7em * 2.5) */
              margin-bottom: 1.75em; /* Aumentado para mayor separación entre estrofas (0.7em * 2.5) */
            }
            .paragraph.chorus {
              font-weight: bold;
              margin-top: 1.2em; /* More spacing for choruses */
              margin-bottom: 1.2em;
            }
            /* Verses and bridges will use .paragraph styling by default */
            /* Add specific styles for .paragraph.verse or .paragraph.bridge if needed */

            ${fontSizeCss} /* Injects: .chord-sheet .lyrics, .chord-sheet .chord { font-size: ${fontSize}em !important; } */
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
        setSongHtml('Error: Nombre de archivo no proporcionado.');
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const asset = Asset.fromModule(songAssets[filename as SongFilename]);
        await asset.downloadAsync();
        if (asset.localUri) {
          const fileContent = await FileSystem.readAsStringAsync(asset.localUri);
          setOriginalChordPro(fileContent); // Store original content
          // Initial display:
          displaySong(fileContent, currentTranspose, chordsVisible, currentFontSizeEm, currentFontFamily);
        } else {
          throw new Error('No se pudo obtener la URI local del archivo.');
        }
      } catch (err: any) {
        console.error('Error cargando la canción:', err);
        setSongHtml(`Error al cargar la canción: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [filename]);

  useEffect(() => {
    if (originalChordPro) {
      displaySong(originalChordPro, currentTranspose, chordsVisible, currentFontSizeEm, currentFontFamily);
    }
  }, [originalChordPro, currentTranspose, chordsVisible, currentFontSizeEm, currentFontFamily]);

const handleToggleChords = () => setChordsVisible(!chordsVisible);
const handleOpenTransposeModal = () => setShowTransposeModal(true);
const handleChangeNotation = () => {
  setIsNotationFabActive(!isNotationFabActive);
  alert('Notación (Próximamente)');
};
const handleOpenFontSizeModal = () => setShowFontSizeModal(true);
const handleChangeFontFamily = () => setShowFontFamilyModal(true);
const handleSetTranspose = (semitones: number) => {
  let newTranspose = semitones;
  // Wrap around at +12 and -12 to 0
  if (newTranspose >= 12 || newTranspose <= -12) {
    newTranspose = newTranspose % 12;
  }
  setCurrentTranspose(newTranspose);
  setShowTransposeModal(false);
};

const handleSetFontSize = (newSizeEm: number) => {
  // Optional: Add min/max font size limits if desired
  // Example: if (newSizeEm < 0.5) newSizeEm = 0.5;
  //          if (newSizeEm > 2.0) newSizeEm = 2.0;
  setCurrentFontSizeEm(newSizeEm);
  // setShowFontSizeModal(false); // Keep modal open to see changes
};

const handleSetFontFamily = (newFontFamily: string) => {
  setCurrentFontFamily(newFontFamily);
  setShowFontFamilyModal(false);
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
          <TouchableOpacity style={[styles.fabAction, !chordsVisible && styles.fabActionActive]} onPress={handleToggleChords}>
            <Text style={[styles.fabActionText, !chordsVisible && styles.fabActionTextActive]}>Acordes {chordsVisible ? 'ON' : 'OFF'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.fabAction, currentTranspose !== 0 && styles.fabActionActive]} onPress={handleOpenTransposeModal}>
            <Text style={[styles.fabActionText, currentTranspose !== 0 && styles.fabActionTextActive]}>Cambiar tono</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.fabAction, isNotationFabActive && styles.fabActionActive]} onPress={handleChangeNotation}>
            <Text style={[styles.fabActionText, isNotationFabActive && styles.fabActionTextActive]}>Notación</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.fabAction, currentFontSizeEm !== 1.0 && styles.fabActionActive]} onPress={handleOpenFontSizeModal}>
            <Text style={[styles.fabActionText, currentFontSizeEm !== 1.0 && styles.fabActionTextActive]}>Tamaño Letra</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.fabAction, currentFontFamily !== availableFonts[0].cssValue && styles.fabActionActive]} onPress={handleChangeFontFamily}>
            <Text style={[styles.fabActionText, currentFontFamily !== availableFonts[0].cssValue && styles.fabActionTextActive]}>Tipo de Letra</Text>
          </TouchableOpacity>
        </View>
      )}
      <TouchableOpacity style={styles.fabMain} onPress={() => setShowActionButtons(!showActionButtons)}>
        <Text style={styles.fabMainText}>{showActionButtons ? '✕' : '🛠️'}</Text>
      </TouchableOpacity>
    </View>

    {/* Font Size Modal */}
    <Modal
      transparent={true}
      visible={showFontSizeModal}
      onRequestClose={() => setShowFontSizeModal(false)}
      animationType="fade"
    >
      <TouchableWithoutFeedback onPress={() => setShowFontSizeModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Ajustar Tamaño Letra</Text>
              <View style={styles.fontSizeButtonRow}>
                <Button title="A+" onPress={() => handleSetFontSize(currentFontSizeEm + 0.1)} />
                <Button title="A-" onPress={() => handleSetFontSize(Math.max(0.5, currentFontSizeEm - 0.1))} />
              </View>
              <Button title={`Original (${(currentFontSizeEm * 100).toFixed(0)}%)`} onPress={() => handleSetFontSize(1.0)} />
              <Button title="Cerrar" onPress={() => setShowFontSizeModal(false)} color="#888"/>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>

    {/* Font Family Modal */}
    <Modal
      transparent={true}
      visible={showFontFamilyModal}
      onRequestClose={() => setShowFontFamilyModal(false)}
      animationType="fade"
    >
      <TouchableWithoutFeedback onPress={() => setShowFontFamilyModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Seleccionar Tipo de Letra</Text>
              {availableFonts.map((font) => (
                <TouchableOpacity
                  key={font.cssValue}
                  style={styles.fontFamilyOptionButton}
                  onPress={() => handleSetFontFamily(font.cssValue)}
                >
                  <Text style={[styles.fontFamilyOptionText, { fontFamily: font.cssValue }]}>{font.name}</Text>
                </TouchableOpacity>
              ))}
              <Button title="Cerrar" onPress={() => setShowFontFamilyModal(false)} color="#888"/>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>

    {/* Transpose Modal */}
    <Modal
      transparent={true}
      visible={showTransposeModal}
      onRequestClose={() => setShowTransposeModal(false)}
      animationType="fade"
    >
      <TouchableWithoutFeedback onPress={() => setShowTransposeModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
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
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  </View>
);

}

const styles = StyleSheet.create({
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
  fabAction: { 
    backgroundColor: AppColors.backgroundLight, 
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    borderWidth: 1.5,
    borderColor: AppColors.primary, 
  },
  fabActionActive: { 
    backgroundColor: AppColors.primary, 
    borderColor: AppColors.primaryDark, 
  },
  fabActionText: { 
    color: AppColors.primary, 
    fontWeight: 'bold',
  },
  fabActionTextActive: { 
    color: AppColors.textLight, 
  },
  fabMain: { 
    backgroundColor: AppColors.accentYellow,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  fabMainText: {
    color: AppColors.textLight,
    fontSize: 28,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.modalOverlay,
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
  fontFamilyOptionButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#e9ecef', // Using a light gray as AppColors.lightGray is not defined in theme
    marginBottom: 10,
    alignItems: 'center',
  },
  fontFamilyOptionText: {
    fontSize: 16,
    color: AppColors.textDark,
  },
  transposeButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
    width: '100%',
  },
  fontSizeButtonRow: {
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

