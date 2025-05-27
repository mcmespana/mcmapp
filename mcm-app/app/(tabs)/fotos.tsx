// app/(tabs)/fotos.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Platform, TouchableOpacity, ViewStyle, TextStyle, Linking, Alert } from 'react-native'; // Added Linking, Alert
import AlbumCard from '@/components/AlbumCard';
import allAlbumsData from '@/assets/albums.json';
import { Colors } from '@/constants/colors';
import { commonStyles } from '@/constants/uiStyles';

const ALBUMS_PER_PAGE = 3;

interface Album {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  albumUrl: string;
}

interface FotosScreenStyles {
  container: ViewStyle;
  titleContainer: ViewStyle;
  title: TextStyle;
  listContentContainer: ViewStyle;
  loadMoreButton: ViewStyle;
  loadMoreButtonText: TextStyle;
}

export default function FotosScreen() {
  const [displayedAlbums, setDisplayedAlbums] = useState<Album[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [allAlbumsLoaded, setAllAlbumsLoaded] = useState<boolean>(false);

  useEffect(() => {
    const initialAlbums = allAlbumsData.slice(0, ALBUMS_PER_PAGE);
    setDisplayedAlbums(initialAlbums);
    if (initialAlbums.length < ALBUMS_PER_PAGE || allAlbumsData.length <= ALBUMS_PER_PAGE) {
      setAllAlbumsLoaded(true);
    }
  }, []);

  const loadMoreAlbums = () => {
    if (allAlbumsLoaded) return;

    const nextPage = currentPage + 1;
    const startIndex = nextPage * ALBUMS_PER_PAGE;
    const endIndex = startIndex + ALBUMS_PER_PAGE;
    const newAlbums = allAlbumsData.slice(startIndex, endIndex);

    if (newAlbums.length > 0) {
      setDisplayedAlbums(prevAlbums => [...prevAlbums, ...newAlbums]);
      setCurrentPage(nextPage);
      if (newAlbums.length < ALBUMS_PER_PAGE || (displayedAlbums.length + newAlbums.length) === allAlbumsData.length) {
        setAllAlbumsLoaded(true);
      }
    } else {
      setAllAlbumsLoaded(true);
    }
  };

  const handleAlbumPress = async (albumUrl: string) => {
    // Check if the URL is valid and can be opened
    const supported = await Linking.canOpenURL(albumUrl);
    if (supported) {
      try {
        await Linking.openURL(albumUrl);
      } catch (error) {
        console.error("Failed to open URL:", error);
        Alert.alert("Error", "Could not open the album link.");
      }
    } else {
      console.warn(`Don't know how to open this URL: ${albumUrl}`);
      Alert.alert("Invalid Link", `Cannot open this URL: ${albumUrl}`);
    }
  };

  const renderFooter = () => {
    if (allAlbumsLoaded) {
      return null;
    }
    return (
      <TouchableOpacity style={styles.loadMoreButton} onPress={loadMoreAlbums}>
        <Text style={styles.loadMoreButtonText}>Load More</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleContainer}>
        <Text style={[styles.title, commonStyles.textShadow]}>Photo Albums</Text>
      </View>
      <FlatList
        data={displayedAlbums}
        renderItem={({ item }) => (
          <AlbumCard
            album={item}
            onPress={() => handleAlbumPress(item.albumUrl)} // Passed onPress handler
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContentContainer}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={renderFooter} // Add Load More button footer
        onEndReachedThreshold={0.1} // Optional: for triggering load on scroll end, though button is explicit
      />
    </View>
  );
}

const styles = StyleSheet.create<FotosScreenStyles>({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    paddingTop: Platform.OS === 'android' ? 20 : 0,
  },
  titleContainer: {
    paddingHorizontal: commonStyles.pagePadding.paddingHorizontal,
    paddingVertical: 15,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.light.text,
  },
  listContentContainer: {
    paddingHorizontal: commonStyles.pagePadding.paddingHorizontal,
    paddingBottom: 20,
    alignItems: 'center',
  },
  loadMoreButton: {
    marginTop: 15,
    marginBottom: 25, // Extra margin at the bottom of the list
    paddingVertical: 12,
    paddingHorizontal: 30,
    backgroundColor: Colors.light.tint, // Use tint color for button
    borderRadius: commonStyles.buttonBorderRadius.borderRadius, // Use common style for border radius
    alignSelf: 'center', // Center button
    elevation: 3, // Android shadow
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  loadMoreButtonText: {
    color: Colors.dark.text, // Text color that contrasts with tint
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
