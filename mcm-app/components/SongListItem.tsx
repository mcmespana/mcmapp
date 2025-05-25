import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';

// Type for song data (ensure this matches the one in SongListScreen.tsx or a shared types file)
interface Song {
  title: string;
  filename: string;
  author?: string; // Made optional to match usage
  key?: string;
  capo?: number; // Changed to number to match usage
  info?: string; // Made optional
}

interface SongListItemProps {
  song: Song;
  onPress: (song: Song) => void;
}

const SongListItem: React.FC<SongListItemProps> = ({ song, onPress }) => {
  return (
    <TouchableOpacity
      onPress={() => onPress(song)}
      style={styles.songItem}
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
        {song.capo && song.capo > 0 ? ( // Ensure capo is a number and greater than 0
          <Text style={styles.songCapo}>{`C/${song.capo}`}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  songItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#eee', // From SongListScreen styles
  },
  songInfoContainer: {
    flex: 1,
    marginRight: 8,
  },
  songTitle: {
    fontSize: 16,
    color: '#333', // From SongListScreen styles
  },
  songAuthor: {
    fontSize: 14,
    color: '#666', // From SongListScreen styles
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
    color: '#000000', // From SongListScreen styles
  },
  songCapo: {
    fontSize: 13,
    color: '#888', // From SongListScreen styles
    fontWeight: 'normal',
  },
});

export default SongListItem;
