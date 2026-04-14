import { useEffect, useState, useLayoutEffect, useRef } from 'react';
import { StyleSheet, View, Platform, Dimensions, Animated } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

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

const isIOS = Platform.OS === 'ios';

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
  const insets = useSafeAreaInsets();

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
    isDark,
  });

  const isSelected = isSongSelected(filename);

  // Android/Web: header button
  useLayoutEffect(() => {
    if (isIOS || !filename) return;

    const currentlySelected = isSelected;
    const headerRight = () => (
      <PressableFeedback
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
        <PressableFeedback.Highlight />
        <IconSymbol
          name={currentlySelected ? 'checkmark.circle.fill' : 'plus.circle'}
          size={24}
          color={
            Platform.OS === 'web'
              ? currentlySelected
                ? '#34C759'
                : '#253883'
              : '#fff'
          }
        />
      </PressableFeedback>
    );

    navigation.setOptions({ headerRight, headerShown: true });

    if (Platform.OS === 'web') {
      const timer = setTimeout(() => {
        navigation.setOptions({ headerRight, headerShown: true });
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
      console.error('Error: Contenido de la canción no proporcionado.');
      setOriginalChordPro(null);
      setIsFileLoading(false);
    } else {
      console.error('Error: Sin contenido ni filename.');
      setOriginalChordPro(null);
      setIsFileLoading(false);
    }
  }, [filename, content]);

  const handleToggleChords = () =>
    setSettings({ chordsVisible: !chordsVisible });
  const handleSetTranspose = (semitones: number) => {
    let newTranspose = semitones;
    if (newTranspose >= 12 || newTranspose <= -12)
      newTranspose = newTranspose % 12;
    setCurrentTranspose(newTranspose);
  };
  const handleSetFontSize = (newSizeEm: number) =>
    setSettings({ fontSize: newSizeEm });
  const handleSetFontFamily = (newFontFamily: string) =>
    setSettings({ fontFamily: newFontFamily });
  const handleToggleNotation = () =>
    setSettings({ notation: notation === 'EN' ? 'ES' : 'EN' });

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
    let text = originalChordPro
      .replace(/\{soc\}/gi, '{start_of_chorus}')
      .replace(/\{eoc\}/gi, '{end_of_chorus}')
      .replace(
        /\{start_of_chorus\}([\s\S]*?)\{end_of_chorus\}/gi,
        (_match, inner) =>
          `{start_of_chorus}` + String(inner).toUpperCase() + `{end_of_chorus}`,
      )
      .replace(/\[[^\]]+\]/g, '')
      .replace(/\{[^}]+\}\n?/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/ *\n */g, '\n');
    text = text
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      .replace(/\n{2,}/g, '\n\n')
      .trim();
    await Clipboard.setStringAsync(text);
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
        { ...prevSong, navigationList, currentIndex: currentIndex - 1, source },
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
        { ...nextSong, navigationList, currentIndex: currentIndex + 1, source },
        'next',
      );
    }
  };

  if (isLoadingSettings) {
    // Brief settings loading
  }

  const contentView = (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateX: slideAnim }] },
        { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' },
      ]}
    >
      {isIOS && <View style={{ height: insets.top + 52 }} />}
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

      {/* iOS: floating overlay buttons (back + add-to-selection) */}
      {isIOS && (
        <View
          style={[styles.iosFloatingBar, { top: insets.top + 8 }]}
          pointerEvents="box-none"
        >
          <PressableFeedback
            style={[styles.iosFloatBtn, isDark && styles.iosFloatBtnDark]}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Volver"
          >
            <PressableFeedback.Highlight />
            <MaterialIcons
              name="chevron-left"
              size={26}
              color={isDark ? '#f4c11e' : '#253883'}
            />
          </PressableFeedback>

          <PressableFeedback
            style={[
              styles.iosFloatBtn,
              isDark && styles.iosFloatBtnDark,
              isSelected && styles.iosFloatBtnSelected,
            ]}
            onPress={() =>
              isSelected ? removeSong(filename) : addSong(filename)
            }
            accessibilityLabel={
              isSelected ? 'Quitar de selección' : 'Añadir a selección'
            }
          >
            <PressableFeedback.Highlight />
            <IconSymbol
              name={isSelected ? 'checkmark.circle.fill' : 'plus.circle'}
              size={22}
              color={isSelected ? '#34C759' : isDark ? '#f4c11e' : '#253883'}
            />
          </PressableFeedback>
        </View>
      )}
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
  headerButton: {
    padding: 8,
    marginRight: Platform.OS === 'web' ? 8 : 0,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  // iOS floating bar: back (left) + add (right)
  iosFloatingBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    pointerEvents: 'box-none',
  } as any,
  iosFloatBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  iosFloatBtnDark: {
    backgroundColor: 'rgba(44,44,46,0.88)',
  },
  iosFloatBtnSelected: {
    backgroundColor: 'rgba(52,199,89,0.15)',
  },
});
