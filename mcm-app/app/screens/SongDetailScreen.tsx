import { useEffect, useState, useLayoutEffect, useRef } from 'react';
import { StyleSheet, View, Platform, Dimensions, Animated, TouchableOpacity } from 'react-native';
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
import { Colors } from '@/constants/colors';
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

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

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

  const screenBg = isDark ? Colors.dark.background : Colors.light.background;
  const floatBtnBg = isDark ? 'rgba(44,44,46,0.92)' : 'rgba(255,255,255,0.92)';
  const floatIconColor = isDark ? '#F5F5F7' : '#1C1C1E';
  const btnTop = insets.top + 8;

  const floatingButtons = (
    <>
      <TouchableOpacity
        style={[styles.floatBtn, { top: btnTop, left: 16, backgroundColor: floatBtnBg }]}
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
        accessibilityLabel="Volver"
      >
        <IconSymbol name="chevron.left" size={20} color={floatIconColor} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.floatBtn, { top: btnTop, right: 16, backgroundColor: floatBtnBg }]}
        onPress={() => {
          if (isSelected) removeSong(filename);
          else addSong(filename);
        }}
        activeOpacity={0.7}
        accessibilityLabel={isSelected ? 'Quitar de selección' : 'Añadir a selección'}
      >
        <IconSymbol
          name={isSelected ? 'checkmark.circle.fill' : 'plus.circle'}
          size={24}
          color={isSelected ? APPLE_SYSTEM_GREEN : floatIconColor}
        />
      </TouchableOpacity>
    </>
  );

  const contentView = (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateX: slideAnim }] },
        { backgroundColor: screenBg },
      ]}
    >
      <View style={{ height: insets.top + 44 }} />
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

  const gestureContent =
    navigationList && typeof currentIndex === 'number' && Platform.OS !== 'web' ? (
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
    ) : (
      contentView
    );

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      {gestureContent}
      {floatingButtons}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 0,
  },
  floatBtn: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.15)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
      },
    }),
  },
});
