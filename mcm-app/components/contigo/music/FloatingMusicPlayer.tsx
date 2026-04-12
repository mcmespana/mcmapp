import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Dimensions,
  Linking,
} from 'react-native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/useColorScheme';
import Animated, {
  useAnimatedStyle,
  withTiming,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { hexAlpha } from '@/utils/colorUtils';
import { BlurView } from 'expo-blur';
import { Audio } from 'expo-av';

const WIDGET_WIDTH = 280;

// Configura aquí tus canciones.
// Para que la app compile sin error, primero debes colocar los archivos 1.mp3 a 10.mp3 en la carpeta mcm-app/assets/music/
// Luego, descomenta las líneas "file: require(...)" de abajo.
// Nota: react-native y expo-av no soportan extraer metadatos ID3 de archivos locales de forma nativa sin librerías de terceros con dependencias nativas complejas.
// Te recomendamos poner el título manualmente aquí en 'name'.
const TRACKS = [
  {
    id: 1,
    name: 'Instrumental 1',
    file: null /* require('@/assets/music/1.mp3') */,
  },
  {
    id: 2,
    name: 'Instrumental 2',
    file: null /* require('@/assets/music/2.mp3') */,
  },
  {
    id: 3,
    name: 'Instrumental 3',
    file: null /* require('@/assets/music/3.mp3') */,
  },
  {
    id: 4,
    name: 'Instrumental 4',
    file: null /* require('@/assets/music/4.mp3') */,
  },
  {
    id: 5,
    name: 'Instrumental 5',
    file: null /* require('@/assets/music/5.mp3') */,
  },
  {
    id: 6,
    name: 'Instrumental 6',
    file: null /* require('@/assets/music/6.mp3') */,
  },
  {
    id: 7,
    name: 'Instrumental 7',
    file: null /* require('@/assets/music/7.mp3') */,
  },
  {
    id: 8,
    name: 'Instrumental 8',
    file: null /* require('@/assets/music/8.mp3') */,
  },
  {
    id: 9,
    name: 'Instrumental 9',
    file: null /* require('@/assets/music/9.mp3') */,
  },
  {
    id: 10,
    name: 'Instrumental 10',
    file: null /* require('@/assets/music/10.mp3') */,
  },
];

export function FloatingMusicPlayer() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const [isOpen, setIsOpen] = useState(false);

  // Audio state
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  const soundRef = useRef<Audio.Sound | null>(null);

  // Setup Audio
  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      // @ts-ignore
      interruptionModeIOS: 1,
      // @ts-ignore
      interruptionModeAndroid: 1,
    });

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  // Load track when index changes
  useEffect(() => {
    loadTrack(currentTrackIndex, isPlaying);
  }, [currentTrackIndex]);

  const loadTrack = async (index: number, shouldPlay: boolean) => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
        setSound(null);
      }
      setIsLoaded(false);

      const track = TRACKS[index];
      if (!track.file) {
        console.warn('No audio file provided for track', track.name);
        return; // Early return to avoid crashing
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        track.file,
        { shouldPlay, isLooping: false },
        onPlaybackStatusUpdate,
      );

      soundRef.current = newSound;
      setSound(newSound);
      setIsLoaded(true);
      if (shouldPlay) setIsPlaying(true);
    } catch (e) {
      console.warn('Error loading audio track:', e);
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      if (status.didJustFinish && !status.isLooping) {
        nextTrack(); // Auto-play next track when finished
      }
    }
  };

  const togglePlayback = async () => {
    if (!TRACKS[currentTrackIndex].file) return; // Prevent play if no file

    if (!soundRef.current) {
      await loadTrack(currentTrackIndex, true);
      return;
    }

    if (isPlaying) {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
    } else {
      await soundRef.current.playAsync();
      setIsPlaying(true);
    }
  };

  const nextTrack = () => {
    setCurrentTrackIndex((prev) => (prev + 1) % TRACKS.length);
  };

  const prevTrack = () => {
    setCurrentTrackIndex((prev) => (prev - 1 + TRACKS.length) % TRACKS.length);
  };

  // Animation values
  const expandAnim = useSharedValue(0);

  useEffect(() => {
    expandAnim.value = withSpring(isOpen ? 1 : 0, {
      damping: 20,
      stiffness: 200,
    });
  }, [isOpen]);

  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      width: isOpen ? WIDGET_WIDTH : 56,
      height: isOpen ? 120 : 56,
      borderRadius: isOpen ? 24 : 28,
      opacity: withTiming(1, { duration: 300 }),
    };
  });

  const animatedContentStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(isOpen ? 1 : 0, { duration: 200 }),
      transform: [{ scale: withTiming(isOpen ? 1 : 0.8, { duration: 200 }) }],
      display: expandAnim.value < 0.1 && !isOpen ? 'none' : 'flex',
    };
  });

  const animatedFabStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(isOpen ? 0 : 1, { duration: 200 }),
      transform: [{ scale: withTiming(isOpen ? 0.5 : 1, { duration: 200 }) }],
      position: 'absolute',
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      pointerEvents: isOpen ? 'none' : 'auto',
    };
  });

  const toggleOpen = () => setIsOpen(!isOpen);

  const openSpotify = () => {
    Linking.openURL(
      'https://open.spotify.com/playlist/2wWM7EBxdihcmP2fTmbeDA?si=7ef33c5fa17e4ada',
    );
  };

  const textColor = isDark ? '#F5EFE3' : '#3D3225';
  const subTextColor = isDark ? '#A09A94' : '#6B6560';

  const currentTrack = TRACKS[currentTrackIndex];

  return (
    <Animated.View
      style={[
        styles.container,
        { bottom: insets.bottom + 80, right: 16 },
        animatedContainerStyle,
      ]}
    >
      <BlurView
        intensity={isDark ? 30 : 60}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />

      {/* Expanded Content */}
      <Animated.View style={[styles.expandedContent, animatedContentStyle]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.title, { color: textColor }]}
              numberOfLines={1}
            >
              Música de fondo
            </Text>
            <Text style={[styles.subtitle, { color: subTextColor }]}>
              {currentTrack.name}
            </Text>
          </View>
          <TouchableOpacity onPress={toggleOpen} style={styles.closeBtn}>
            <MaterialIcons name="close" size={20} color={subTextColor} />
          </TouchableOpacity>
        </View>

        <View style={styles.controlsRow}>
          <View style={styles.playbackControls}>
            <TouchableOpacity style={styles.controlBtn} onPress={prevTrack}>
              <MaterialIcons name="skip-previous" size={24} color={textColor} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.playBtn} onPress={togglePlayback}>
              <MaterialIcons
                name={isPlaying ? 'pause' : 'play-arrow'}
                size={28}
                color={isDark ? '#1C1A17' : '#FEFBF5'}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlBtn} onPress={nextTrack}>
              <MaterialIcons name="skip-next" size={24} color={textColor} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={openSpotify} style={styles.spotifyBtn}>
            <FontAwesome5 name="spotify" size={20} color="#1DB954" />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* FAB Content */}
      <Animated.View style={animatedFabStyle}>
        <TouchableOpacity style={styles.fabBtn} onPress={toggleOpen}>
          <MaterialIcons
            name={isPlaying ? 'music-note' : 'library-music'}
            size={24}
            color={textColor}
          />
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
  },
  expandedContent: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  playbackControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  controlBtn: {
    padding: 4,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DAA520', // Accent color
    justifyContent: 'center',
    alignItems: 'center',
  },
  spotifyBtn: {
    padding: 8,
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
    borderRadius: 20,
  },
  fabBtn: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
