import { useEffect, useState, useLayoutEffect, useRef } from 'react';
import { StyleSheet, View, Platform, Dimensions, Animated } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import SongDisplay from '@/components/SongDisplay';
import { useSongProcessor } from '@/hooks/useSongProcessor';
import SongControls from '@/components/SongControls';
import { RouteProp, NavigationProp } from '@react-navigation/native';
import { RootStackParamList } from '../(tabs)/cancionero';
import { useSelectedSongs } from '@/contexts/SelectedSongsContext';
import { useChoirSession } from '@/contexts/ChoirSessionContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useSettings } from '@/contexts/SettingsContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import ChoirSessionBanner from '@/components/playlist/ChoirSessionBanner';
import * as Clipboard from 'expo-clipboard';
import colors, { Colors } from '@/constants/colors';
import { durations } from '@/constants/animations';

// Apple iOS system green — used as a "selected/done" tint inside the
// add/remove song button. Not part of the MCM brand palette: it's an
// intentional native iOS convention preserved for visual consistency.
const APPLE_SYSTEM_GREEN = '#34C759';

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
  const {
    addSong,
    removeSong,
    isSongSelected,
    getSelectedSong,
    setTranspose: setSelectionTranspose,
    setCapoOverride: setSelectionCapoOverride,
  } = useSelectedSongs();
  const choir = useChoirSession();
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
  // Si la canción está en la selección, su `transpose` vive en el contexto
  // (single source of truth). Si no, usamos este estado local efímero.
  const selectedMeta = getSelectedSong(filename);
  const [localTranspose, setLocalTranspose] = useState(0);
  const [localCapoOverride, setLocalCapoOverride] = useState<number | null>(
    null,
  );
  // En modo coro:
  //  - el MAESTRO publica el transpose visible (local o seleccionado).
  //  - el ESCLAVO usa el transpose del maestro salvo que tenga override.
  const masterCurrent = choir.session?.current;
  const slaveTransposeFromChoir =
    choir.mode === 'slave' && masterCurrent?.filename === filename
      ? (choir.overrideTranspose ?? masterCurrent.transpose)
      : null;
  const currentTranspose =
    slaveTransposeFromChoir !== null
      ? slaveTransposeFromChoir
      : selectedMeta
        ? selectedMeta.transpose
        : localTranspose;

  // Capo override: selección > local efímero. El coro master publica el
  // override; el esclavo usa el de la selección local (no el del master).
  const currentCapoOverride =
    selectedMeta?.capoOverride !== undefined
      ? (selectedMeta.capoOverride ?? null)
      : localCapoOverride;
  const effectiveCapo =
    currentCapoOverride !== null ? currentCapoOverride : capo;

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
    capo: effectiveCapo,
    isDark,
  });

  const isSelected = isSongSelected(filename);


  // Header right button: add/remove song from selection (all platforms)
  useLayoutEffect(() => {
    if (!filename) return;

    const currentlySelected = isSelected;
    const iconColor = isIOS
      ? isDark
        ? '#f4c11e'
        : '#3d79b9ff'
      : Platform.OS === 'web'
        ? currentlySelected
          ? APPLE_SYSTEM_GREEN
          : colors.primary
        : '#fff';
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
          color={currentlySelected && isIOS ? APPLE_SYSTEM_GREEN : iconColor}
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
  }, [navigation, filename, isSelected, isDark, addSong, removeSong]);

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
    // Al cambiar de canción reseteamos los estados efímeros locales.
    setLocalTranspose(0);
    setLocalCapoOverride(null);
  }, [filename, content]);

  // Modo coro - MAESTRO: cuando entro a una canción, lo publico para los
  // esclavos junto con todos los metadatos para que la puedan renderizar
  // sin tener que buscarla en su cantoral local.
  useEffect(() => {
    if (choir.mode !== 'master' || !filename) return;
    void choir.publishCurrent({
      filename,
      transpose: currentTranspose,
      capoOverride: currentCapoOverride,
      screen: 'detail',
      title: _navScreenTitle,
      author,
      songKey: key,
      capo,
      content,
      firebaseCategory,
    });
    // Solo al montar / cambiar de canción, no en cada cambio de transpose
    // (eso lo hace explícitamente handleSetTranspose).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choir.mode, filename]);

  // (la navegación del esclavo se gestiona en `cancionero.tsx` mediante
  //  un observador del contexto coro que opera sobre el navigator del stack)

  const handleSetCapoOverride = (newCapo: number | null) => {
    if (selectedMeta) {
      setSelectionCapoOverride(filename, newCapo);
    } else {
      setLocalCapoOverride(newCapo);
    }
    // Si soy maestro, publico el cambio.
    if (choir.mode === 'master') {
      void choir.publishCurrent({
        filename,
        transpose: currentTranspose,
        capoOverride: newCapo,
        screen: 'detail',
      });
    }
  };

  const handleToggleChords = () =>
    setSettings({ chordsVisible: !chordsVisible });
  const handleSetTranspose = (semitones: number) => {
    let newTranspose = semitones;
    if (newTranspose >= 12 || newTranspose <= -12)
      newTranspose = newTranspose % 12;

    if (slaveTransposeFromChoir !== null) {
      // Esclavo: cambiar tono = override local (no afecta a la sesión remota).
      choir.setOverrideTranspose(newTranspose);
      return;
    }
    if (selectedMeta) {
      // Persistir en la selección.
      setSelectionTranspose(filename, newTranspose);
    } else {
      setLocalTranspose(newTranspose);
    }
    // Si soy maestro, publico el cambio aunque la canción no esté seleccionada
    // (el maestro puede abrir cualquier canción del cantoral).
    if (choir.mode === 'master') {
      void choir.publishCurrent({
        filename,
        transpose: newTranspose,
        screen: 'detail',
      });
    }
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
      duration: durations.quick,
      useNativeDriver: true,
    }).start(() => {
      navigation.setParams(params);
      slideAnim.setValue(-toValue);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: durations.quick,
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
        {
          backgroundColor: isDark
            ? Colors.dark.background
            : Colors.light.background,
        },
      ]}
    >
      <View style={{ height: isIOS ? insets.top + 44 : 0 }} />
      <ChoirSessionBanner />
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
        currentCapoOverride={currentCapoOverride}
        onSetCapoOverride={handleSetCapoOverride}
      />

    </Animated.View>
  );

  if (navigationList && typeof currentIndex === 'number') {
    // Web has no touch screen — skip the gesture wrapper entirely.
    if (Platform.OS === 'web') return contentView;
    return (
      <PanGestureHandler
        activeOffsetX={[-20, 20]}
        failOffsetY={[-15, 15]}
        onHandlerStateChange={(event) => {
          if (event.nativeEvent.state !== State.END) return;
          const { translationX, velocityX } = event.nativeEvent;
          if (Math.abs(translationX) < 60 || Math.abs(velocityX) < 150) return;
          if (translationX > 0) handleSwipeLeft();
          else handleSwipeRight();
        }}
      >
        {contentView}
      </PanGestureHandler>
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
});
