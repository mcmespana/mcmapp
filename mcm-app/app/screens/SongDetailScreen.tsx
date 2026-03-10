import { useEffect, useState, useLayoutEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Platform,
  Dimensions,
  Animated,
} from 'react-native';
import GestureRecognizer from 'react-native-swipe-gestures';
import SongDisplay from '../../components/SongDisplay';
import { useSongProcessor } from '../../hooks/useSongProcessor';
import SongControls from '../../components/SongControls';
import { RouteProp, NavigationProp } from '@react-navigation/native';
import { RootStackParamList } from '../(tabs)/cancionero';
import { useSelectedSongs } from '../../contexts/SelectedSongsContext';
import { IconSymbol } from '../../components/ui/IconSymbol';
import { useSettings } from '../../contexts/SettingsContext';
import { useColorScheme } from '../../hooks/useColorScheme';
import * as Clipboard from 'expo-clipboard';

const availableFonts = [
  {
    name: 'Monoespaciada',
    cssValue: "'Roboto Mono', 'Courier New', monospace",
  },
  {
    name: 'Serif',
    cssValue: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
  },
  { name: 'Sans-Serif', cssValue: "'Helvetica Neue', 'Arial', sans-serif" },
];

type SongDetailScreenRouteProp = RouteProp<RootStackParamList, 'SongDetail'>;
type SongDetailScreenNavigationProp = NavigationProp<
  RootStackParamList,
  'SongDetail'
> & {
  replace: (screen: keyof RootStackParamList, params: any) => void;
};

interface SongDetailScreenProps {
  route: SongDetailScreenRouteProp;
  navigation: SongDetailScreenNavigationProp;
}

export default function SongDetailScreen({
  route,
  navigation,
}: SongDetailScreenProps) {
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
    firebaseCategory,
  } = route.params;
  const { addSong, removeSong, isSongSelected } = useSelectedSongs();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const { settings, setSettings, isLoadingSettings } = useSettings();
  const {
    chordsVisible,
    fontSize: currentFontSizeEm,
    fontFamily: currentFontFamily,
    notation,
  } = settings;

  const [isFileLoading, setIsFileLoading] = useState(true);
  const [originalChordPro, setOriginalChordPro] = useState<string | null>(null);
  const [currentTranspose, setCurrentTranspose] = useState(0);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get('window').width;

  const { songHtml, isLoadingSong: isSongProcessing } = useSongProcessor({
    originalChordPro,
    currentTranspose,
    chordsVisible,
    currentFontSizeEm,
    currentFontFamily,
    notation,
    author,
    key,
    capo,
  });

  const isSelected = isSongSelected(filename);
  useLayoutEffect(() => {
    if (!filename) return;

    const currentlySelected = isSelected;
    const iconColor =
      Platform.OS === 'ios'
        ? '#1a1a1a'
        : Platform.OS === 'web'
          ? '#1a1a1a'
          : '#fff';

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
          accessibilityLabel={
            currentlySelected ? 'Quitar de selección' : 'Añadir a selección'
          }
        >
          <IconSymbol
            name={currentlySelected ? 'checkmark.circle.fill' : 'plus.circle'}
            size={26}
            color={iconColor}
          />
        </TouchableOpacity>
      </View>
    );

    navigation.setOptions({
      headerRight,
      headerShown: true,
    });

    if (Platform.OS === 'web') {
      const timer = setTimeout(() => {
        navigation.setOptions({
          headerRight,
          headerShown: true,
        });
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [navigation, filename, isSelected, addSong, removeSong]);

  useEffect(() => {
    setIsFileLoading(true);
    if (content) {
      setOriginalChordPro(content);
      setIsFileLoading(false);
    } else if (filename) {
      console.error(
        'Error: Contenido de la canción no proporcionado, pero sí el nombre del archivo.',
      );
      setOriginalChordPro(null);
      setIsFileLoading(false);
    } else {
      console.error(
        'Error: Ni el contenido de la canción ni el nombre del archivo fueron proporcionados.',
      );
      setOriginalChordPro(null);
      setIsFileLoading(false);
    }
  }, [filename, content]);

  const handleToggleChords = () =>
    setSettings({ chordsVisible: !chordsVisible });

  const handleSetTranspose = (semitones: number) => {
    let newTranspose = semitones;
    if (newTranspose >= 12 || newTranspose <= -12) {
      newTranspose = newTranspose % 12;
    }
    setCurrentTranspose(newTranspose);
  };

  const handleSetFontSize = (newSizeEm: number) => {
    setSettings({ fontSize: newSizeEm });
  };

  const handleSetFontFamily = (newFontFamily: string) => {
    setSettings({ fontFamily: newFontFamily });
  };

  const handleToggleNotation = () => {
    setSettings({ notation: notation === 'EN' ? 'ES' : 'EN' });
  };

  const handleNavigateToFullscreen = () => {
    navigation.navigate('SongFullscreen', {
      filename,
      title: _navScreenTitle,
      author,
      key,
      capo,
      content: content || '',
    });
  };

  const handleCopyLyrics = async () => {
    if (!originalChordPro) return;
    let textWithUppercaseChorus = originalChordPro
      .replace(/\{soc\}/gi, '{start_of_chorus}')
      .replace(/\{eoc\}/gi, '{end_of_chorus}')
      .replace(
        /\{start_of_chorus\}([\s\S]*?)\{end_of_chorus\}/gi,
        (_match, inner) =>
          `{start_of_chorus}` + String(inner).toUpperCase() + `{end_of_chorus}`,
      );

    let lyrics = textWithUppercaseChorus
      .replace(/\[[^\]]+\]/g, '')
      .replace(/\{[^}]+\}\n?/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/ *\n */g, '\n');
    lyrics = lyrics
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      .replace(/\n{2,}/g, '\n\n')
      .trim();
    await Clipboard.setStringAsync(lyrics);
  };

  const animateAndSet = (params: any, direction: 'next' | 'prev') => {
    const toValue = direction === 'next' ? -screenWidth : screenWidth;
    Animated.timing(slideAnim, {
      toValue,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      navigation.setParams(params);
      slideAnim.setValue(-toValue);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleSwipeLeft = () => {
    if (
      navigationList &&
      typeof currentIndex === 'number' &&
      currentIndex > 0
    ) {
      const prevSong = navigationList[currentIndex - 1];
      animateAndSet(
        {
          ...prevSong,
          navigationList,
          currentIndex: currentIndex - 1,
          source,
        },
        'prev',
      );
    }
  };

  const handleSwipeRight = () => {
    if (
      navigationList &&
      typeof currentIndex === 'number' &&
      currentIndex < navigationList.length - 1
    ) {
      const nextSong = navigationList[currentIndex + 1];
      animateAndSet(
        {
          ...nextSong,
          navigationList,
          currentIndex: currentIndex + 1,
          source,
        },
        'next',
      );
    }
  };

  if (isLoadingSettings) {
    // Settings loading briefly
  }

  const contentView = (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateX: slideAnim }] },
        { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' },
      ]}
    >
      <SongDisplay
        songHtml={songHtml}
        isLoading={isFileLoading || isSongProcessing || isLoadingSettings}
      />
      <SongControls
        chordsVisible={chordsVisible}
        currentTranspose={currentTranspose}
        currentFontSizeEm={currentFontSizeEm}
        currentFontFamily={currentFontFamily}
        availableFonts={availableFonts}
        notation={notation}
        onToggleChords={handleToggleChords}
        onSetTranspose={handleSetTranspose}
        onSetFontSize={handleSetFontSize}
        onSetFontFamily={handleSetFontFamily}
        onToggleNotation={handleToggleNotation}
        onNavigateToFullscreen={handleNavigateToFullscreen}
        onCopyLyrics={handleCopyLyrics}
        songTitle={_navScreenTitle}
        songFilename={filename}
        songAuthor={author}
        songKey={key}
        songCapo={capo}
        songInfo=""
        songContent={content}
        firebaseCategory={firebaseCategory}
      />
    </Animated.View>
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
    padding: 0,
  },
  headerButtonContainer: {
    marginRight: 8,
    zIndex: 1000,
    position: 'relative',
  },
  headerButton: {
    padding: 8,
    minWidth: 40,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? {
          cursor: 'pointer',
        }
      : {}),
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  messageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    fontSize: 16,
    fontFamily: 'monospace',
  },
});
