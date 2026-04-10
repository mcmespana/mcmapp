import React from 'react';
import {
  View,
  Text,
  ImageBackground,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

interface AlbumCardProps {
  album: {
    id: string;
    title: string;
    location?: string;
    date?: string;
    imageUrl: string;
    albumUrl?: string;
  };
  onPress: () => void;
}

const AlbumCard: React.FC<AlbumCardProps> = ({ album, onPress }) => {
  const { width } = useWindowDimensions();
  const activeStyles = createStyles(width);
  return (
    <PressableFeedback style={activeStyles.card} onPress={onPress}>
      <PressableFeedback.Highlight />
      <View style={activeStyles.cardContent}>
        <ImageBackground
          source={{ uri: album.imageUrl }}
          style={activeStyles.imageBackground}
          imageStyle={activeStyles.image}
          onError={(error) =>
            console.log(
              `Error loading image for ${album.title}: ${error.nativeEvent.error}`,
            )
          }
        >
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.65)']}
            locations={[0.3, 1]}
            style={activeStyles.gradient}
          />
          <View style={activeStyles.textContainer}>
            <Text style={activeStyles.title} numberOfLines={2}>
              {album.title}
            </Text>
            {(album.location || album.date) && (
              <View style={activeStyles.metaRow}>
                {album.location && (
                  <View style={activeStyles.metaItem}>
                    <MaterialIcons
                      name="location-on"
                      size={13}
                      color="rgba(255,255,255,0.85)"
                      style={activeStyles.icon}
                    />
                    <Text style={activeStyles.metaText}>
                      {album.location}
                    </Text>
                  </View>
                )}
                {album.date && (
                  <View style={activeStyles.metaItem}>
                    <MaterialIcons
                      name="event"
                      size={13}
                      color="rgba(255,255,255,0.85)"
                      style={activeStyles.icon}
                    />
                    <Text style={activeStyles.metaText}>
                      {album.date}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </ImageBackground>
      </View>
    </PressableFeedback>
  );
};

const createStyles = (screenWidth: number) =>
  StyleSheet.create({
    card: {
      width: '100%',
      aspectRatio: screenWidth > 600 ? 1.6 : 1.8,
      borderRadius: 18,
      marginBottom: 14,
      backgroundColor: '#2C2C2E',
      ...(Platform.OS === 'web'
        ? {
            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
          }
        : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 5,
          }),
    },
    cardContent: {
      flex: 1,
      overflow: 'hidden',
      borderRadius: 18,
    },
    imageBackground: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    image: {},
    gradient: {
      ...StyleSheet.absoluteFillObject,
    },
    textContainer: {
      padding: 16,
      paddingBottom: 14,
    },
    title: {
      fontSize: 19,
      fontWeight: '700',
      color: '#fff',
      letterSpacing: -0.3,
      lineHeight: 24,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      marginTop: 6,
      gap: 12,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    metaText: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.85)',
      fontWeight: '500',
    },
    icon: {
      marginRight: 3,
    },
  });

export default AlbumCard;
