import { useEffect, useState, useLayoutEffect } from 'react'; // Added useLayoutEffect
// Unused imports (TouchableOpacity, Modal, Button, TouchableWithoutFeedback) removed
import { ScrollView, Text, StyleSheet, useWindowDimensions, View, TouchableOpacity } from 'react-native'; // Added TouchableOpacity
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../styles/theme';
// ChordProParser and HtmlDivFormatter removed as they are now in the hook
import { SongFilename } from '../../assets/songs';
import { songAssets } from '../../assets/songs/index';
import SongDisplay from '../../components/SongDisplay';
import { useSongProcessor } from '../../hooks/useSongProcessor';
import SongControls from '../../components/SongControls'; // Added import
import { RouteProp, NavigationProp } from '@react-navigation/native'; // Added NavigationProp
import { RootStackParamList } from '../(tabs)/cancionero';
import { useSelectedSongs } from '../../contexts/SelectedSongsContext'; // Import context hook
import { IconSymbol } from '../../components/ui/IconSymbol'; // Import IconSymbol

const availableFonts = [
  { name: 'Monoespaciada', cssValue: "'Roboto Mono', 'Courier New', monospace" },
  { name: 'Serif', cssValue: "'Georgia', 'Times New Roman', serif" },
  { name: 'Sans-Serif', cssValue: "'Helvetica Neue', 'Arial', sans-serif" },
];

type SongDetailScreenRouteProp = RouteProp<RootStackParamList, 'SongDetail'>;
// Define navigation prop type
type SongDetailScreenNavigationProp = NavigationProp<RootStackParamList, 'SongDetail'>;

interface SongDetailScreenProps {
  route: SongDetailScreenRouteProp;
  navigation: SongDetailScreenNavigationProp; // Add navigation to props
}

export default function SongDetailScreen({ route, navigation }: SongDetailScreenProps) { // Destructure navigation
  // title from params is for the navigation screen header, actual song title rendered by WebView
  const { filename, title: navScreenTitle, author, key, capo } = route.params;
  const { addSong, removeSong, isSongSelected } = useSelectedSongs(); // Use context

  // songHtml state is now managed by useSongProcessor
  const [isFileLoading, setIsFileLoading] = useState(true); // Renamed from isLoading

  const { width } = useWindowDimensions();

  // New states for controls
  const [originalChordPro, setOriginalChordPro] = useState<string | null>(null);
  const [chordsVisible, setChordsVisible] = useState(true);
  const [currentTranspose, setCurrentTranspose] = useState(0); // Semitones: 0 is original, positive up, negative down
  // showActionButtons, showTransposeModal, showFontSizeModal, showFontFamilyModal states removed
  const [notation, setNotation] = useState<'english' | 'spanish'>('english');
  const [currentFontSizeEm, setCurrentFontSizeEm] = useState(1.0); // Base font size is 1em
  const [currentFontFamily, setCurrentFontFamily] = useState(availableFonts[0].cssValue); // Default to mono, availableFonts is now at top

  // Call the hook to process the song
  const { songHtml, isLoadingSong: isSongProcessing } = useSongProcessor({
    originalChordPro,
    currentTranspose,
    chordsVisible,
    currentFontSizeEm,
    currentFontFamily,
    author, // Pass author from route.params
    key,    // Pass key from route.params
    capo,   // Pass capo from route.params
    notation,
  });

  // Effect for setting header button
  useLayoutEffect(() => {
    if (!filename) return; // Don't set header if filename is not available

    const currentlySelected = isSongSelected(filename);

    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => {
            if (currentlySelected) {
              removeSong(filename);
            } else {
              addSong(filename);
            }
          }}
          style={{ marginRight: 15 }} // Add some margin to the button
        >
          <IconSymbol
            name={currentlySelected ? "checkmark.circle.fill" : "plus.circle"}
            size={26}
            color={'#fff'} // Assuming headerTintColor is white from cancionero.tsx
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, filename, isSongSelected, addSong, removeSong]); // Dependencies

  // Effect for loading the ChordPro file content
  useEffect(() => {
    (async () => {
      if (!filename) {
        // setSongHtml('Error: Nombre de archivo no proporcionado.'); // This will be handled by the hook if originalChordPro is null
        setIsFileLoading(false);
        return;
      }
      try {
        setIsFileLoading(true);
        const asset = Asset.fromModule(songAssets[filename as SongFilename]);
        await asset.downloadAsync();
        if (asset.localUri) {
          const fileContent = await FileSystem.readAsStringAsync(asset.localUri);
          setOriginalChordPro(fileContent); // Store original content
          // displaySong is now handled by the useSongProcessor hook via useEffect when originalChordPro changes
        } else {
          throw new Error('No se pudo obtener la URI local del archivo.');
        }
      } catch (err: any) {
        console.error('Error cargando la canción:', err);
        // setSongHtml(`Error al cargar la canción: ${err.message}`); // Hook will display its own error
        setOriginalChordPro(null); // Ensure originalChordPro is null on error so hook can show error state
      } finally {
        setIsFileLoading(false);
      }
    })();
  }, [filename]);

  // displaySong function and its useEffect have been removed, logic is in useSongProcessor.

  // Handlers for actual state changes (passed to SongControls)
  const handleToggleChords = () => setChordsVisible(!chordsVisible);

  const handleChangeNotation = () => {
    setNotation(prev => prev === 'english' ? 'spanish' : 'english');
    //console.log(songHtml);

  };

  const handleSetTranspose = (semitones: number) => {
    let newTranspose = semitones;
    if (newTranspose >= 12 || newTranspose <= -12) {
      newTranspose = newTranspose % 12;
    }
    setCurrentTranspose(newTranspose);
    // setShowTransposeModal(false); // Modal state is now in SongControls
  };

  const handleSetFontSize = (newSizeEm: number) => {
    setCurrentFontSizeEm(newSizeEm);
    // setShowFontSizeModal(false); // Modal state is now in SongControls
  };

  const handleSetFontFamily = (newFontFamily: string) => {
    setCurrentFontFamily(newFontFamily);
    // setShowFontFamilyModal(false); // Modal state is now in SongControls
  };

  // Removed handleOpenTransposeModal, handleOpenFontSizeModal, handleOpenFontFamilyModal

  return (

    <View style={styles.container}>
      <SongDisplay songHtml={songHtml} isLoading={isFileLoading || isSongProcessing} />
      <SongControls
        chordsVisible={chordsVisible}
        currentTranspose={currentTranspose}
        currentFontSizeEm={currentFontSizeEm}
        currentFontFamily={currentFontFamily}
        notation={notation} // Pass notation state
        availableFonts={availableFonts}
        onToggleChords={handleToggleChords}
        onSetTranspose={handleSetTranspose}
        onSetFontSize={handleSetFontSize}
        onSetFontFamily={handleSetFontFamily}
        onChangeNotation={handleChangeNotation}
      />
    </View>
  );
            console.log(songHtml)

}

const styles = StyleSheet.create({
  // Removed styles: fabContainer, fabActionsContainer, fabAction, fabActionActive,
  // fabActionText, fabActionTextActive, fabMain, fabMainText, modalOverlay,
  // modalContent, modalTitle, fontFamilyOptionButton, fontFamilyOptionText,
  // transposeButtonRow, fontSizeButtonRow
  container: { flex: 1, padding: 10 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  messageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { fontSize: 16, fontFamily: 'monospace' },
});

