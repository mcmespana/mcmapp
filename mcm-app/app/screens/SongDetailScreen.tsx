import { useEffect, useState, useLayoutEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Platform,
  Dimensions,
  Animated,
  TouchableOpacity,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
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
import { hasArrangements, insertArrangementAtLine } from '@/utils/arrangements';
import { useColorScheme } from '@/hooks/useColorScheme';
import ChoirSessionBanner from '@/components/playlist/ChoirSessionBanner';
import ArrangementInputModal from '@/components/ArrangementInputModal';
import * as Clipboard from 'expo-clipboard';
import brandColors, { Colors } from '@/constants/colors';
import { durations } from '@/constants/animations';
import { h } from '@/utils/haptics';
import { getDatabase, ref, push, set } from 'firebase/database';
import { getFirebaseApp } from '@/utils/firebaseApp';
import { hasSongMedia } from '@/types/songMedia';
import SongMediaSheet from '@/components/song-media/SongMediaSheet';
import FloatingYouTubePlayer, {
  type FloatingVideoSource,
} from '@/components/song-media/FloatingYouTubePlayer';

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
    media: routeMedia,
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

  const { settings, setSettings, isLoadingSettings, isAdmin } = useSettings();
  const {
    chordsVisible,
    fontSize: currentFontSizeEm,
    fontFamily: currentFontFamily,
    notation,
  } = settings;

  // Edición de arreglos por long-press (solo admin). El índice apunta a una
  // línea del ChordPro vivo (`originalChordPro`); el texto de preview es la
  // línea sobre la que se insertará.
  const [arrModalVisible, setArrModalVisible] = useState(false);
  const [arrLineIndex, setArrLineIndex] = useState<number | null>(null);
  const [arrSaving, setArrSaving] = useState(false);
  const [arrError, setArrError] = useState<string | null>(null);

  const [isFileLoading, setIsFileLoading] = useState(true);
  const [originalChordPro, setOriginalChordPro] = useState<string | null>(null);
  // Si la canción está en la selección, su `transpose` vive en el contexto
  // (single source of truth). Si no, usamos este estado local efímero.
  const selectedMeta = getSelectedSong(filename);
  const [localTranspose, setLocalTranspose] = useState(0);
  const [localCapoOverride, setLocalCapoOverride] = useState<number | null>(
    null,
  );
  // Arreglos {arr:}: visibilidad efímera por canción. Si la canción tiene
  // arreglos, se muestran activados por defecto; ocultarlos no se persiste ni
  // se arrastra a otras canciones (se resetea al cambiar de canción).
  // Basado en el ChordPro VIVO (`originalChordPro`) para que, si el admin añade
  // un arreglo, se detecte y se muestre al instante. Cae a `content` mientras
  // el estado vivo aún no está poblado.
  const songHasArrangements = useMemo(
    () => hasArrangements(originalChordPro ?? content),
    [originalChordPro, content],
  );
  const [arrangementsVisible, setArrangementsVisible] = useState(true);
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

  const {
    songHtml,
    isLoadingSong: isSongProcessing,
    styleState,
  } = useSongProcessor({
    originalChordPro,
    currentTranspose,
    chordsVisible,
    arrangementsVisible: songHasArrangements && arrangementsVisible,
    currentFontSizeEm,
    currentFontFamily,
    notation,
    author,
    key,
    capo: effectiveCapo,
    isDark,
    adminMode: isAdmin,
  });

  const isSelected = isSongSelected(filename);

  // ── Multimedia ──
  const media = useMemo(() => routeMedia ?? null, [routeMedia]);
  const songHasMedia = hasSongMedia(media);
  const [showMediaSheet, setShowMediaSheet] = useState(false);
  const [floatingVideo, setFloatingVideo] =
    useState<FloatingVideoSource | null>(null);

  // Al cambiar de canción (swipe), cerramos el cajón pero conservamos el
  // reproductor flotante (sobrevive porque es la misma instancia montada).
  useEffect(() => {
    setShowMediaSheet(false);
  }, [filename]);

  // Header NATIVO transparente, HEREDANDO la config del stack del cantoral
  // (headerTransparent + glass en iOS 26), igual que Categorías y dentro de una
  // categoría. Solo añadimos las acciones (multimedia + añadir/quitar) como bar
  // items; el back y la transparencia los pone el stack. Sin título para no
  // tapar letra. El FAB de abajo (SongControls) se queda.
  useLayoutEffect(() => {
    const headerIconColor = isDark ? '#f4c11e' : '#3d79b9';
    navigation.setOptions({
      headerShown: true,
      headerTitle: '',
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
          {songHasMedia && (
            <TouchableOpacity
              onPress={() => {
                h.tap();
                setShowMediaSheet(true);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Multimedia y ficha"
            >
              <MaterialIcons
                name="ondemand-video"
                size={22}
                color={isDark ? brandColors.secondary : brandColors.primary}
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => {
              if (isSelected) {
                h.remove();
                removeSong(filename);
              } else {
                h.add();
                addSong(filename);
              }
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={
              isSelected ? 'Quitar de selección' : 'Añadir a selección'
            }
          >
            <IconSymbol
              name={isSelected ? 'checkmark.circle.fill' : 'plus.circle'}
              size={24}
              color={isSelected ? APPLE_SYSTEM_GREEN : headerIconColor}
            />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [
    navigation,
    isDark,
    songHasMedia,
    isSelected,
    filename,
    addSong,
    removeSong,
  ]);

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
    setArrangementsVisible(true);
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
  const handleToggleArrangements = () => setArrangementsVisible((v) => !v);
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

  // ── Arreglos por long-press (admin) ──
  // Mensaje desde el WebView/iframe: el usuario mantuvo pulsada una línea.
  const handleSongMessage = (data: any) => {
    if (!isAdmin || !data || data.type !== 'arr-longpress') return;
    if (typeof data.line !== 'number') return;
    h.select();
    setArrLineIndex(data.line);
    setArrError(null);
    setArrModalVisible(true);
  };

  // Texto (preview) de la línea sobre la que se insertará el arreglo.
  const arrPreviewLine = useMemo(() => {
    if (arrLineIndex === null || !originalChordPro) return undefined;
    const line = originalChordPro.split(/\r?\n/)[arrLineIndex];
    if (!line) return undefined;
    // Mostramos la letra sin los acordes entre corchetes, más legible.
    const clean = line.replace(/\[[^\]]*\]/g, '').trim();
    return clean || line.trim();
  }, [arrLineIndex, originalChordPro]);

  const handleSaveArrangement = async (text: string) => {
    if (arrLineIndex === null || !originalChordPro) {
      setArrModalVisible(false);
      return;
    }
    setArrSaving(true);
    setArrError(null);
    const before = originalChordPro;
    const after = insertArrangementAtLine(before, arrLineIndex, text);
    try {
      // 1) Render en vivo inmediato en el dispositivo.
      setOriginalChordPro(after);

      // 2) Proponer la edición a Firebase (songs/ediciones). Solo si tenemos
      //    los identificadores necesarios; si no, el cambio local ya está hecho.
      if (firebaseCategory && filename) {
        const db = getDatabase(getFirebaseApp());
        const edicionRef = push(ref(db, 'songs/ediciones'));
        await set(edicionRef, {
          filename,
          category: firebaseCategory,
          contentOld: before,
          contentNew: after,
          editedAt: new Date().toISOString(),
          timestamp: Date.now(),
          platform: Platform.OS,
          status: 'arrangement',
        });
      }
      h.formSuccess();
      setArrModalVisible(false);
      setArrLineIndex(null);
    } catch (err) {
      console.error('Error guardando arreglo:', err);
      // El render local ya se aplicó; avisamos de que no se pudo sincronizar.
      setArrError(
        'Se añadió en el dispositivo, pero no se pudo sincronizar. Reintenta.',
      );
    } finally {
      setArrSaving(false);
    }
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
      h.navigate();
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
      h.navigate();
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
        styleState={styleState}
        onMessage={isAdmin ? handleSongMessage : undefined}
      />
      <SongControls
        chordsVisible={chordsVisible}
        hasArrangements={songHasArrangements}
        arrangementsVisible={arrangementsVisible}
        onToggleArrangements={handleToggleArrangements}
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
    navigationList &&
    typeof currentIndex === 'number' &&
    Platform.OS !== 'web' ? (
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
      <SongMediaSheet
        visible={showMediaSheet}
        onClose={() => setShowMediaSheet(false)}
        media={media}
        songTitle={_navScreenTitle}
        onPlayVideo={(embedUrl, label) => {
          setShowMediaSheet(false);
          setFloatingVideo({ embedUrl, label });
        }}
      />
      <FloatingYouTubePlayer
        source={floatingVideo}
        onClose={() => setFloatingVideo(null)}
      />
      {isAdmin && (
        <ArrangementInputModal
          visible={arrModalVisible}
          previewLine={arrPreviewLine}
          saving={arrSaving}
          error={arrError}
          onCancel={() => {
            setArrModalVisible(false);
            setArrLineIndex(null);
            setArrError(null);
          }}
          onSave={handleSaveArrangement}
        />
      )}
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
    overflow: 'hidden',
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
  mediaDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: brandColors.accent,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
  },
});
