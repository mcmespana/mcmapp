import React from 'react';
import { View, Text, ImageBackground, StyleSheet, Dimensions, TouchableOpacity } from 'react-native'; // Added TouchableOpacity
import { Colors } from '@/constants/colors'; 
import { commonStyles } from '@/constants/uiStyles'; 

interface AlbumCardProps {
  album: {
    title: string;
    subtitle: string;
    imageUrl: string;
  };
  onPress: () => void; // Added onPress prop
}

const AlbumCard: React.FC<AlbumCardProps> = ({ album, onPress }) => { // Added onPress to destructuring
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}> {/* Wrapped with TouchableOpacity and passed onPress */}
      <ImageBackground
        source={{ uri: album.imageUrl }}
        style={styles.imageBackground}
        imageStyle={styles.image}
      >
        <View style={styles.overlay} />
        <View style={styles.textContainer}>
          <Text style={[styles.title, commonStyles.textShadow]}>{album.title}</Text>
          <Text style={[styles.subtitle, commonStyles.textShadow]}>{album.subtitle}</Text>
        </View>
      </ImageBackground>
    </View>
  );
};

const screenWidth = Dimensions.get('window').width;
const cardWidth = screenWidth * 0.9; // 90% of screen width
const cardHeight = cardWidth / 2; // Aspect ratio 2:1

const styles = StyleSheet.create({
  card: {
    width: cardWidth,
    height: cardHeight,
    borderRadius: 15,
    overflow: 'hidden',
    marginBottom: 20,
    elevation: 5, // For Android shadow
    shadowColor: Colors.light.shadow, // Using from constants
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    backgroundColor: Colors.light.background, // Fallback background
  },
  imageBackground: {
    flex: 1,
    justifyContent: 'flex-end', // Align text to the bottom
  },
  image: {
    // borderRadius: 15, // Already handled by card's overflow: 'hidden'
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)', // Semi-transparent overlay
    borderRadius: 15, // Match card's border radius
  },
  textContainer: {
    padding: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.light.text, // Using from constants
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.text, // Using from constants
  },
});

export default AlbumCard;
