// app/(tabs)/fotos.tsx
import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, Linking, useWindowDimensions, ViewStyle, Alert } from 'react-native';
import { Button, ActivityIndicator } from 'react-native-paper';
import AlbumCard from '@/components/AlbumCard';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { Colors as ThemeColors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

const ALBUMS_PER_PAGE = 4;

interface Album {
  id: string;
  title: string;
  location?: string;
  date?: string;
  imageUrl: string;
  albumUrl: string;
}

interface FotosScreenStyles {
  container: ViewStyle;

  listContentContainer: ViewStyle;
  albumCardContainerOneColumn: ViewStyle;
  albumCardContainerTwoColumns: ViewStyle;
  loadMoreButton: ViewStyle;
}

export default function FotosScreen() {
  const { width } = useWindowDimensions();
  const scheme = useColorScheme();
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);
  const { data: allAlbumsData, loading } = useFirebaseData<Album[]>('albums', 'albums');
  const [displayedAlbums, setDisplayedAlbums] = useState<Album[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [allAlbumsLoaded, setAllAlbumsLoaded] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  useEffect(() => {
    if (!allAlbumsData) return;
    const initialAlbums = allAlbumsData.slice(0, ALBUMS_PER_PAGE);
    setDisplayedAlbums(initialAlbums);
    if (initialAlbums.length < ALBUMS_PER_PAGE || allAlbumsData.length <= ALBUMS_PER_PAGE) {
      setAllAlbumsLoaded(true);
    }
  }, [allAlbumsData]);

  const loadMoreAlbums = () => {
    if (!allAlbumsData || allAlbumsLoaded || isLoadingMore) return;

    setIsLoadingMore(true);
    // Using a short timeout to ensure UI updates before heavy lifting, and to show spinner
    setTimeout(() => {
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
      setIsLoadingMore(false);
    }, 200); // Small delay to allow spinner to show
  };

  const handleAlbumPress = async (albumUrl: string) => {
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
    if (isLoadingMore) {
      return <ActivityIndicator size="large" color={ThemeColors.light.tint} style={{ marginVertical: 20 }} />;
    }
    if (allAlbumsLoaded) {
      return null;
    }
    return (
      <Button 
        mode="contained" 
        onPress={loadMoreAlbums} 
        loading={isLoadingMore}
        style={styles.loadMoreButton}
        contentStyle={{ paddingVertical: 8 }}
      >
        Cargar Más
      </Button>
    );
  };

  if (loading && displayedAlbums.length === 0) {
    return <ProgressWithMessage message="Cargando álbumes..." />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={displayedAlbums}
        renderItem={({ item }) => (
          <View style={width > 600 ? styles.albumCardContainerTwoColumns : styles.albumCardContainerOneColumn}>
            <AlbumCard album={item} onPress={() => handleAlbumPress(item.albumUrl)} />
          </View>
        )}
        keyExtractor={(item) => item.id}
        numColumns={width > 600 ? 2 : 1}
        key={width > 600 ? 'TWO_COLUMNS' : 'ONE_COLUMN'} // Important for re-render on column change
        contentContainerStyle={[
          styles.listContentContainer, 
          { 
            maxWidth: width > 1200 ? 1600 : 1200, // Increase maxWidth on very wide screens
            alignSelf: 'center' 
          }
        ]}
        onEndReached={loadMoreAlbums}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
      />
    </View>
  );
}

const createStyles = (scheme: 'light' | 'dark' | null) => {
  const theme = ThemeColors[scheme ?? 'light'];
  return StyleSheet.create<FotosScreenStyles>({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },

  listContentContainer: {
    paddingTop: 15,
    // paddingHorizontal will be managed by column containers or screen width directly
    paddingBottom: 20,
    // alignItems: 'center', // Removed, will be handled by alignSelf on FlatList or column styles
  },
  albumCardContainerOneColumn: {
    width: '100%',
    paddingHorizontal: 10, // Reduced side margins for mobile single column
  },
  albumCardContainerTwoColumns: {
    width: '50%', // Each item takes half the width
    paddingHorizontal: 5, // Reduced horizontal spacing between cards for desktop
  },
  loadMoreButton: {
    marginVertical: 20,
    alignSelf: 'center',
    backgroundColor: theme.tint,
  },
  });
};
