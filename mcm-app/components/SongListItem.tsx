import React, { useRef } from 'react';
import { TouchableOpacity, Text, View, StyleSheet, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useSelectedSongs } from '../contexts/SelectedSongsContext'; // Corrected path
import { IconSymbol } from './ui/IconSymbol';

// Type for song data
interface Song {
  title: string;
  filename: string;
  author?: string;
  key?: string;
  capo?: number;
  info?: string;
}

interface SongListItemProps {
  song: Song;
  onPress: (song: Song) => void;
}

const SongListItem: React.FC<SongListItemProps> = ({ song, onPress }) => {
  const { addSong, removeSong, isSongSelected } = useSelectedSongs();
  const swipeableRow = useRef<Swipeable>(null);

  const isSelected = isSongSelected(song.filename);

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
      renderRightActions={!isSelected ? renderRightActions : undefined} // Show add only if not selected
      renderLeftActions={isSelected ? renderLeftActions : undefined}  // Show remove only if selected
      overshootRight={false} // Prevent over-swiping for single action
      overshootLeft={false}  // Prevent over-swiping for single action
    >
      <TouchableOpacity
        onPress={() => onPress(song)}
        style={[styles.songItem, isSelected && styles.selectedSongItem]}
      >
        <View style={styles.songInfoContainer}>
          <Text style={styles.songTitle}>
            {song.title.replace(/^\d+\.\s*/, '')} {/* Remove leading numbers */}
          </Text>
          {song.author ? (
            <Text style={styles.songAuthor}>{song.author}</Text>
          ) : null}
        </View>
        <View style={styles.keyCapoContainer}>
          {song.key ? (
            <Text style={styles.songKey}>{song.key.toUpperCase()}</Text>
          ) : null}
          {song.capo && song.capo > 0 ? (
            <Text style={styles.songCapo}>{`C/${song.capo}`}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  songItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20, // Added horizontal padding
    borderBottomWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fff', // Default background
  },
  selectedSongItem: {
    backgroundColor: '#e6ffed', // Light green for selected items
  },
  songInfoContainer: {
    flex: 1,
    marginRight: 8,
  },
  songTitle: {
    fontSize: 16,
    color: '#333',
  },
  songAuthor: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  keyCapoContainer: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  songKey: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  songCapo: {
    fontSize: 13,
    color: '#888',
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

export default SongListItem;
