import React, { useRef, useEffect, useMemo } from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  Animated,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useSelectedSongs } from '../contexts/SelectedSongsContext';
import { IconSymbol } from './ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';
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
  originalCategoryKey?: string;
  numericFilenamePart?: string;
}

interface SongListItemProps {
  song: Song;
  onPress: (song: Song) => void;
  isSearchAllMode?: boolean;
}

const SongListItem: React.FC<SongListItemProps> = ({
  song,
  onPress,
  isSearchAllMode = false,
}) => {
  const { addSong, removeSong, isSongSelected } = useSelectedSongs();
  const { settings } = useSettings();
  const { notation } = settings;
  const scheme = useColorScheme();
  const styles = useMemo(() => createStyles(scheme || 'light'), [scheme]);
  const isDark = scheme === 'dark';
  const swipeableRow = useRef<Swipeable>(null);
  const isSelected = isSongSelected(song.filename);
  const backgroundColorAnim = useRef(
    new Animated.Value(isSelected ? 1 : 0),
  ).current;

  useEffect(() => {
    Animated.timing(backgroundColorAnim, {
      toValue: isSelected ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [isSelected, backgroundColorAnim]);

  const animatedStyle = {
    backgroundColor: backgroundColorAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [
        isDark ? '#2C2C2E' : '#fff',
        isDark ? '#1A3320' : '#E8F5E9',
      ],
    }),
  };

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const trans = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [0, 100],
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
        <Animated.View
          style={[styles.actionContent, { transform: [{ translateX: trans }] }]}
        >
          <IconSymbol name="plus.circle" size={22} color="#fff" />
          <Text style={styles.actionText}>Seleccionar</Text>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const renderLeftActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const trans = dragX.interpolate({
      inputRange: [0, 100],
      outputRange: [-100, 0],
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
        <Animated.View
          style={[styles.actionContent, { transform: [{ translateX: trans }] }]}
        >
          <IconSymbol name="minus.circle" size={22} color="#fff" />
          <Text style={styles.actionText}>Quitar</Text>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const cleanTitle = song.title.replace(/^\d+\.\s*/, '');

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
        <TouchableOpacity
          onPress={() => onPress(song)}
          style={styles.songItemInner}
          activeOpacity={0.6}
        >
          <View style={styles.leftSection}>
            {isSelected && <View style={styles.selectedDot} />}
            <View style={styles.songInfoContainer}>
              <Text
                style={styles.songTitle}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {cleanTitle}
              </Text>
              <View style={styles.metaLine}>
                {isSearchAllMode &&
                !!song.originalCategoryKey &&
                !!song.numericFilenamePart ? (
                  <View style={styles.metaPills}>
                    <View style={styles.categoryPill}>
                      <Text style={styles.categoryPillText}>
                        {song.originalCategoryKey}
                        {song.numericFilenamePart}
                      </Text>
                    </View>
                    {!!song.author && (
                      <Text
                        style={styles.authorText}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {song.author}
                      </Text>
                    )}
                  </View>
                ) : (
                  <View style={styles.metaPills}>
                    {!!song.numericFilenamePart && (
                      <Text style={styles.numberText}>
                        #{song.numericFilenamePart}
                      </Text>
                    )}
                    {!!song.numericFilenamePart && !!song.author && (
                      <Text style={styles.metaSeparator}> · </Text>
                    )}
                    {!!song.author && (
                      <Text
                        style={styles.authorText}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {song.author}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            </View>
          </View>
          <View style={styles.rightSection}>
            {song.capo && song.capo > 0 ? (
              <View style={styles.capoBadge}>
                <Text style={styles.capoText}>{`C${song.capo}`}</Text>
              </View>
            ) : null}
            {song.key ? (
              <View style={styles.keyBadge}>
                <Text style={styles.keyText}>
                  {convertChord(song.key.toUpperCase(), notation)}
                </Text>
              </View>
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
    songItemOuter: {},
    songItemInner: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    },
    leftSection: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 12,
    },
    selectedDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#34C759',
      marginRight: 10,
    },
    songInfoContainer: {
      flex: 1,
    },
    songTitle: {
      fontSize: 16,
      color: isDark ? '#FFFFFF' : '#1C1C1E',
      fontWeight: '500',
      letterSpacing: -0.2,
    },
    metaLine: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    metaPills: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    categoryPill: {
      backgroundColor: isDark ? Colors.dark.card : '#F2F2F7',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      marginRight: 8,
    },
    categoryPillText: {
      fontSize: 12,
      fontWeight: '600',
      color: isDark ? '#AEAEB2' : '#636366',
      fontVariant: ['tabular-nums'],
    },
    numberText: {
      fontSize: 13,
      color: isDark ? '#8E8E93' : '#8E8E93',
      fontVariant: ['tabular-nums'],
    },
    metaSeparator: {
      fontSize: 13,
      color: isDark ? '#636366' : '#C7C7CC',
    },
    authorText: {
      fontSize: 13,
      color: isDark ? '#AEAEB2' : '#8E8E93',
      fontStyle: 'italic',
      flex: 1,
    },
    rightSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    keyBadge: {
      backgroundColor: isDark ? '#2A3D66' : '#E8F0FE',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    keyText: {
      fontSize: 14,
      fontWeight: '700',
      color: isDark ? '#7AB3FF' : '#253883',
    },
    capoBadge: {
      backgroundColor: isDark ? Colors.dark.card : '#F2F2F7',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    capoText: {
      fontSize: 12,
      fontWeight: '600',
      color: isDark ? '#AEAEB2' : '#636366',
    },
    rightAction: {
      backgroundColor: '#34C759',
      justifyContent: 'center',
      alignItems: 'center',
      width: 100,
    },
    leftAction: {
      backgroundColor: '#FF453A',
      justifyContent: 'center',
      alignItems: 'center',
      width: 100,
    },
    actionContent: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
      marginTop: 4,
    },
  });
};

export default SongListItem;
