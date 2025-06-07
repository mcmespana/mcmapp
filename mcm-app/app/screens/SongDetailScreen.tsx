import { useEffect, useState, useLayoutEffect } from 'react'; // Added useLayoutEffect
// Cleaned up unused imports
import { StyleSheet, View, TouchableOpacity, Platform } from 'react-native';
import GestureRecognizer from 'react-native-swipe-gestures';
import SongDisplay from '../../components/SongDisplay';
import { useSongProcessor } from '../../hooks/useSongProcessor';
import SongControls from '../../components/SongControls'; // Added import
import { RouteProp, NavigationProp } from '@react-navigation/native'; // Added NavigationProp
import { RootStackParamList } from '../(tabs)/cancionero';
import { useSelectedSongs } from '../../contexts/SelectedSongsContext'; // Import context hook
import { IconSymbol } from '../../components/ui/IconSymbol'; // Import IconSymbol
import { useSettings } from '../../contexts/SettingsContext'; // <<<--- ADD THIS IMPORT

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
  const {
    filename,
    title: _navScreenTitle,
    author,
    key,
    capo,
    content,
    navigationList,
    currentIndex,
    source,
  } = route.params;
  const { addSong, removeSong, isSongSelected } = useSelectedSongs(); // Use context

  // Settings from context
  const { settings, setSettings, isLoadingSettings } = useSettings(); // <<<--- USE SETTINGS HOOK
  const { chordsVisible, fontSize: currentFontSizeEm, fontFamily: currentFontFamily, notation } = settings;

  // songHtml state is now managed by useSongProcessor
  const [isFileLoading, setIsFileLoading] = useState(true); // Renamed from isLoading

  // Ancho de pantalla no utilizado

  // New states for controls
  const [originalChordPro, setOriginalChordPro] = useState<string | null>(null);
  // const [chordsVisible, setChordsVisible] = useState(true); // From context
  const [currentTranspose, setCurrentTranspose] = useState(0); // Transpose remains local
  // const [notation, setNotation] = useState<'english' | 'spanish'>('english'); // From context
  // const [currentFontSizeEm, setCurrentFontSizeEm] = useState(1.0); // From context
  // const [currentFontFamily, setCurrentFontFamily] = useState(availableFonts[0].cssValue); // From context


  // Call the hook to process the song
  const { songHtml, isLoadingSong: isSongProcessing } = useSongProcessor({
    originalChordPro,
    currentTranspose,
    chordsVisible, // From context
    currentFontSizeEm, // From context
    currentFontFamily, // From context
    author, // Pass author from route.params
    key,    // Pass key from route.params
    capo,   // Pass capo from route.params
    notation, // From context
  });

  // Effect for setting header button
  useLayoutEffect(() => {
    if (!filename) return; // Don't set header if filename is not available

    const currentlySelected = isSongSelected(filename);
    
    // Configuración del botón derecho
    const headerRight = () => (
      <View style={styles.headerButtonContainer}>
        <TouchableOpacity
          onPress={() => {
            if (currentlySelected) {
              removeSong(filename);
            } else {
              addSong(filename);
            }
          }}
          style={styles.headerButton}
          accessibilityLabel={currentlySelected ? 'Quitar de selección' : 'Añadir a selección'}
        >
          <IconSymbol
            name={currentlySelected ? 'checkmark.circle.fill' : 'plus.circle'}
            size={26}
            color={'#fff'}
          />
        </TouchableOpacity>
      </View>
    );

    // Configurar opciones de navegación
    navigation.setOptions({
      headerRight,
      // Asegurarse de que el header esté visible en web
      headerShown: true,
    });

    // Forzar actualización adicional para web
    if (Platform.OS === 'web') {
      const timer = setTimeout(() => {
        navigation.setOptions({
          headerRight,
          headerShown: true,
        });
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [navigation, filename, isSongSelected(filename), addSong, removeSong]);

  // Effect for loading the ChordPro file content
  useEffect(() => {
    setIsFileLoading(true);
    if (content) {
      setOriginalChordPro(content);
      setIsFileLoading(false);
    } else if (filename) {
      // Fallback or error handling if content is not provided but filename is
      // This block could attempt to load from filename if that's desired,
      // but per instructions, we should rely on content.
      // For now, let's assume content should always be there.
      console.error('Error: Contenido de la canción no proporcionado, pero sí el nombre del archivo.');
      setOriginalChordPro(null); // Ensure originalChordPro is null on error so hook can show error state
      setIsFileLoading(false);
    } else {
      console.error('Error: Ni el contenido de la canción ni el nombre del archivo fueron proporcionados.');
      setOriginalChordPro(null);
      setIsFileLoading(false);
    }
  }, [filename, content]); // Added content to dependencies

  // displaySong function and its useEffect have been removed, logic is in useSongProcessor.

  // Handlers for actual state changes (passed to SongControls)
  // Handlers for actual state changes, now using setSettings from context
  const handleToggleChords = () => setSettings({ chordsVisible: !chordsVisible });

  const handleChangeNotation = () => {
    setSettings({ notation: notation === 'english' ? 'spanish' : 'english' });
  };

  const handleSetTranspose = (semitones: number) => {
    let newTranspose = semitones;
    if (newTranspose >= 12 || newTranspose <= -12) {
      newTranspose = newTranspose % 12;
    }
    setCurrentTranspose(newTranspose); // Transpose is local
  };

  const handleSetFontSize = (newSizeEm: number) => {
    setSettings({ fontSize: newSizeEm });
  };

  const handleSetFontFamily = (newFontFamily: string) => {
    setSettings({ fontFamily: newFontFamily });
  };

  const handleSwipeLeft = () => {
    if (navigationList && typeof currentIndex === 'number' && currentIndex > 0) {
      const prevSong = navigationList[currentIndex - 1];
      navigation.replace('SongDetail', {
        ...prevSong,
        navigationList,
        currentIndex: currentIndex - 1,
        source,
      });
    }
  };

  const handleSwipeRight = () => {
    if (
      navigationList &&
      typeof currentIndex === 'number' &&
      currentIndex < navigationList.length - 1
    ) {
      const nextSong = navigationList[currentIndex + 1];
      navigation.replace('SongDetail', {
        ...nextSong,
        navigationList,
        currentIndex: currentIndex + 1,
        source,
      });
    }
  };

  // If settings are loading, you might want to show a loading indicator or return null
  if (isLoadingSettings) {
    // Optionally, render a loading indicator specific to settings being loaded
    // For now, SongDisplay already handles its own loading state for song content
    // and this screen handles file loading. If settings load quickly, this might not be noticeable.
    // Consider if a brief blank or loading state is preferred here.
  }

  // Removed handleOpenTransposeModal, handleOpenFontSizeModal, handleOpenFontFamilyModal

  const contentView = (
    <View style={styles.container}>
      <SongDisplay songHtml={songHtml} isLoading={isFileLoading || isSongProcessing || isLoadingSettings} />
      <SongControls
        chordsVisible={chordsVisible}
        currentTranspose={currentTranspose} // Transpose is local
        currentFontSizeEm={currentFontSizeEm}
        currentFontFamily={currentFontFamily}
        notation={notation} // Pass notation state
        availableFonts={availableFonts}
        onToggleChords={handleToggleChords}
        onSetTranspose={handleSetTranspose} // Local handler
        onSetFontSize={handleSetFontSize}
        onSetFontFamily={handleSetFontFamily}
        onChangeNotation={handleChangeNotation}
      />
    </View>
  );

  if (navigationList && typeof currentIndex === 'number') {
    return (
      <GestureRecognizer
        style={{ flex: 1 }}
        onSwipeLeft={handleSwipeRight}
        onSwipeRight={handleSwipeLeft}
      >
        {contentView}
      </GestureRecognizer>
    );
  }

  return contentView;

}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 10 
  },
  headerButtonContainer: {
    marginRight: 16,
    // Asegurar que el botón sea visible en web
    zIndex: 1000,
    position: 'relative',
  },
  headerButton: {
    padding: 8,
    // Hacer el área de toque más grande en web
    minWidth: 40,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    // Estilo adicional para web
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      ':hover': {
        opacity: 0.8,
      },
    } : {}),
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    marginBottom: 10, 
    textAlign: 'center' 
  },
  messageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { 
    fontSize: 16, 
    fontFamily: 'monospace' 
  },
});

