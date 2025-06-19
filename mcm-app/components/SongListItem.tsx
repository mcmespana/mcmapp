import React, { useRef, useEffect, useMemo } from 'react'; // Added useEffect
import { TouchableOpacity, Text, View, StyleSheet, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useSelectedSongs } from '../contexts/SelectedSongsContext'; // Corrected path
import { IconSymbol } from './ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useSettings } from '../contexts/SettingsContext';
import { convertChord } from '../utils/chordNotation';

// Type for song data
interface Song {
  title: string;
  filename: string;
  author?: string;
  key?: string;
  capo?: number;
  info?: string;
  originalCategoryKey?: string; // Added for 'Search All' mode
  numericFilenamePart?: string; // Added for consistent number display
}

interface SongListItemProps {
  song: Song;
  onPress: (song: Song) => void;
  isSearchAllMode?: boolean; // Optional, as it's specific to SongListScreen's usage
}

const SongListItem: React.FC<SongListItemProps> = ({ song, onPress, isSearchAllMode = false }) => {
  const { addSong, removeSong, isSongSelected } = useSelectedSongs();
  const { settings } = useSettings();
  const { notation } = settings;
  const scheme = useColorScheme();
  const styles = useMemo(() => createStyles(scheme || 'light'), [scheme]);
  const swipeableRow = useRef<Swipeable>(null);
  const isSelected = isSongSelected(song.filename);
  const backgroundColorAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(backgroundColorAnim, {
      toValue: isSelected ? 1 : 0,
      duration: 200, // Smooth transition
      useNativeDriver: false, // backgroundColor is not supported by native driver
    }).start();
  }, [isSelected, backgroundColorAnim]);

  const isDark = scheme === 'dark';
  const animatedStyle = {
    backgroundColor: backgroundColorAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [isDark ? '#1C1C1E' : '#fff', isDark ? '#324831' : '#e6ffed'],
    }),
  };

  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    const trans = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [0, 100], // Adjust this for how much the button should "follow" the swipe
      extrapolate: 'clamp',
    });
    return (
      <TouchableOpacity
        style={styles.rightAction}
        onPress={() => {
          addSong(song.filename);
          swipeableRow.current?.close();
        }}
      >
        <Animated.View style={{ transform: [{ translateX: trans }] }}>
          <IconSymbol name="plus.circle" size={24} color="#fff" style={styles.actionIcon} />
          <Text style={styles.actionText}>Seleccionar</Text>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const renderLeftActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    const trans = dragX.interpolate({
      inputRange: [0, 100],
      outputRange: [-100, 0], // Adjust this for how much the button should "follow" the swipe
      extrapolate: 'clamp',
    });
    return (
      <TouchableOpacity
        style={styles.leftAction}
        onPress={() => {
          removeSong(song.filename);
          swipeableRow.current?.close();
        }}
      >
        <Animated.View style={{ transform: [{ translateX: trans }] }}>
          <IconSymbol name="minus.circle" size={24} color="#fff" style={styles.actionIcon} />
          <Text style={styles.actionText}>Quitar</Text>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  return (
    <Swipeable
      ref={swipeableRow}
      renderRightActions={!isSelected ? renderRightActions : undefined}
      renderLeftActions={isSelected ? renderLeftActions : undefined}
      onSwipeableOpen={(direction) => {
        if (direction === 'right' && !isSelected) {
          addSong(song.filename);
          swipeableRow.current?.close();
        } else if (direction === 'left' && isSelected) {
          removeSong(song.filename);
          swipeableRow.current?.close();
        }
      }}
    >
      <Animated.View style={[styles.songItemOuter, animatedStyle]}>
        <TouchableOpacity onPress={() => onPress(song)} style={styles.songItemInner}>
          {/* Contenedor principal de la información de la canción y la tonalidad/capo */}
          <View style={styles.songInfoContainer}>
            <Text style={styles.songTitle} numberOfLines={1} ellipsizeMode="tail">
              {song.title.replace(/^\d+\.\s*/, '')}
            </Text>
            <View style={styles.metaLine}>
              {isSearchAllMode && song.originalCategoryKey && song.numericFilenamePart ? (
                <Text style={styles.subtitleText} numberOfLines={1} ellipsizeMode="tail">
                  {`${song.originalCategoryKey}${song.numericFilenamePart}`}
                  {song.author && (
                    <Text style={styles.subtitleAuthor}>
                      {`   ${song.author}`}
                    </Text>
                  )}
                </Text>
              ) : (
                <>
                  {song.numericFilenamePart && (
                    <Text style={styles.subtitleText}>#{song.numericFilenamePart}</Text>
                  )}
                  {song.author && (
                    <Text style={[styles.subtitleText, styles.subtitleAuthor, song.numericFilenamePart ? { marginLeft: 0 } : {}]} numberOfLines={1} ellipsizeMode="tail">
                      {/* Add three spaces if numericFilenamePart is NOT present, to maintain spacing logic, otherwise rely on structure */}
                      {song.numericFilenamePart ? `ㅤ${song.author}` : song.author}
                    </Text>
                  )}
                </>
              )}
            </View>
          </View>
          <View style={styles.keyCapoContainer}>
            {song.key ? (
              <Text style={styles.songKey}>{convertChord(song.key.toUpperCase(), notation)}</Text>
            ) : null}
            {song.capo && song.capo > 0 ? (
              <Text style={styles.songCapo}>{`C/${song.capo}`}</Text>
            ) : null}
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Swipeable>
  );
};

const createStyles = (scheme: 'light' | 'dark' | null) => {
  const isDark = scheme === 'dark';
  return StyleSheet.create({
    songItemOuter: { // Renamed from songItem to be the Animated.View container
      // backgroundColor will be handled by animatedStyle
    },
    songItemInner: { // This will contain the flexDirection and padding previously in songItem
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderColor: isDark ? '#444' : '#eee',
    },
  // selectedSongItem: { // This style is now handled by the animation
  //   backgroundColor: '#e6ffed',
  // },
  // songInfoContainer: { // This definition of songInfoContainer seems to be a leftover/duplicate
  //   flexDirection: 'row',
  //   justifyContent: 'space-between',
  //   alignItems: 'center',
  //   paddingVertical: 16,
  //   paddingHorizontal: 20, // Added horizontal padding
  //   borderBottomWidth: 1,
  //   borderColor: '#eee',
  //   backgroundColor: '#fff', // Default background
  // },
  // selectedSongItem: { // This style is now handled by the animation
  //   backgroundColor: '#e6ffed',
  // },
  songInfoContainer: {
    flex: 1,
    marginRight: 8,
  },
    songTitle: {
      fontSize: 16,
      color: isDark ? '#FFFFFF' : '#333',
      fontWeight: '500',
    },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
    subtitleText: {
      fontSize: 13,
      color: isDark ? '#CCCCCC' : '#666',
    },
  subtitleAuthor: {
    fontStyle: 'italic',
  },
  keyCapoContainer: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
    songKey: {
      fontSize: 16,
      fontWeight: 'bold',
      color: isDark ? '#FFFFFF' : '#000000',
    },
    songCapo: {
      fontSize: 13,
      color: isDark ? '#CCCCCC' : '#888',
      fontWeight: 'normal',
    },
    rightAction: {
      backgroundColor: '#4CAF50', // Green for add
      justifyContent: 'center',
      alignItems: 'center',
      width: 100, // Fixed width for the action button
      flexDirection: 'row',
    },
    leftAction: {
      backgroundColor: '#f44336', // Red for remove
      justifyContent: 'center',
      alignItems: 'center',
      width: 100, // Fixed width for the action button
      flexDirection: 'row',
    },
    actionText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
      paddingLeft: 10, // Space between icon and text
    },
    actionIcon: {
      // No specific styles needed here if already applied in IconSymbol,
      // but can be used for margin/padding if necessary
    },
  });
};

export default SongListItem;
