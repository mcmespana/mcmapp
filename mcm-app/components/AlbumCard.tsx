import React from 'react';
import { View, Text, ImageBackground, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors'; 
// textShadow from uiStyles is for dark text, we'll define a new one for white text 

interface AlbumCardProps {
  album: {
    id: string; // Assuming id is part of the album object passed here, for completeness
    title: string;
    location?: string; // New field, optional
    date?: string;     // New field, optional
    imageUrl: string;
    albumUrl?: string; // Assuming albumUrl is part of the album object, for completeness
  };
  onPress: () => void;
}

const AlbumCard: React.FC<AlbumCardProps> = ({ album, onPress }) => {
  const { width } = useWindowDimensions();
  const activeStyles = styles(width);
  return (
    <TouchableOpacity style={activeStyles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={activeStyles.cardContent}>
        <ImageBackground
          source={{ uri: album.imageUrl }}
          style={activeStyles.imageBackground}
          imageStyle={activeStyles.image}
          onError={(error) => console.log(`Error loading image for ${album.title}: ${error.nativeEvent.error}`)}
        >
          <View style={activeStyles.overlay} />
          <View style={activeStyles.textContainer}>
            <Text style={[activeStyles.title, whiteTextShadow]}>{album.title}</Text>
            {(album.location || album.date) && (
              <View style={activeStyles.subtitleContainer}>
                {album.location && (
                  <View style={activeStyles.subtitleItem}>
                    <MaterialIcons name="location-pin" size={14} color={Colors.dark.tint} style={activeStyles.icon} />
                    <Text style={[activeStyles.subtitleText, whiteTextShadow]}>{album.location}</Text>
                  </View>
                )}
                {album.date && (
                  <View style={activeStyles.subtitleItem}>
                    <MaterialIcons name="calendar-today" size={14} color={Colors.dark.tint} style={activeStyles.icon} />
                    <Text style={[activeStyles.subtitleText, whiteTextShadow]}>{album.date}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </ImageBackground>
      </View>
    </TouchableOpacity>
  );
};

const whiteTextShadow = {
  textShadowColor: 'rgba(0, 0, 0, 0.7)',
  textShadowOffset: { width: 0, height: 1.5 },
  textShadowRadius: 3,
};

const styles = (screenWidth: number) => StyleSheet.create({
  card: {
    width: '100%', // Take full width of its column container
    aspectRatio: screenWidth > 600 ? 1.6 : 2, // Taller cards on desktop
    borderRadius: 15,
    marginBottom: 20, // Vertical spacing between cards
    elevation: 5,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    backgroundColor: Colors.light.background, // Fallback background
  },
  cardContent: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 15,
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
    backgroundColor: 'rgba(0,0,0,0.45)', // Darker overlay for better text contrast
    // borderRadius is handled by parent card's overflow: 'hidden'
  },
  textContainer: {
    padding: 10,
  },
  title: {
    fontSize: 18, // Slightly reduced
    fontWeight: 'bold',
    color: Colors.dark.tint, // White text (assuming Colors.dark.tint is white)
    marginBottom: 4,
  },
  subtitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap', // Allow wrapping if content is too long
    marginTop: 2, // Small space below title
  },
  subtitleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10, // Space between location and date if both present
    marginBottom: 2, // Space for wrapped items
  },
  subtitleText: {
    fontSize: 14, // Slightly reduced
    color: Colors.dark.tint, // White text
  },
  icon: {
    marginRight: 4,
  },
});

export default AlbumCard;
