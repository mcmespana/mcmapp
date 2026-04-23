// app/(tabs)/fotos.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Linking,
  useWindowDimensions,
  ViewStyle,
  Alert,
  Platform,
} from 'react-native';
import { Button, Spinner } from 'heroui-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TabScreenWrapper from '@/components/ui/TabScreenWrapper.ios';
import AlbumCard from '@/components/AlbumCard';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import OfflineBanner from '@/components/OfflineBanner';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';
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
  tags?: string[];
}

/**
 * Reglas de visibilidad:
 *  - Perfil con `['all']` → ve todos los álbumes.
 *  - Álbum sin tags (o vacío) → visible para todos (equivalente a `['general']`).
 *  - Si no, hay intersección entre `album.tags` y `albumTags` del perfil.
 */
function isAlbumVisibleForProfile(
  album: Album,
  profileTags: readonly string[],
): boolean {
  if (profileTags.includes('all')) return true;
  const albumTags = album.tags;
  if (!albumTags || albumTags.length === 0) return true;
  return albumTags.some((tag) => profileTags.includes(tag));
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
  const {
    data: allAlbumsData,
    loading,
    offline,
  } = useFirebaseData<Album[]>('albums', 'albums');
  const resolved = useResolvedProfileConfig();
  const visibleAlbums = React.useMemo(
    () =>
      (allAlbumsData ?? []).filter((album) =>
        isAlbumVisibleForProfile(album, resolved.albumTags),
      ),
    [allAlbumsData, resolved.albumTags],
  );
  const [displayedAlbums, setDisplayedAlbums] = useState<Album[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [allAlbumsLoaded, setAllAlbumsLoaded] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  useEffect(() => {
    // Ordenar álbumes por ID en orden inverso (más nuevos primero)
    const sortedAlbums = [...visibleAlbums].sort((a, b) =>
      b.id.localeCompare(a.id),
    );

    const initialAlbums = sortedAlbums.slice(0, ALBUMS_PER_PAGE);
    setDisplayedAlbums(initialAlbums);
    setCurrentPage(0);
    setAllAlbumsLoaded(
      initialAlbums.length < ALBUMS_PER_PAGE ||
        sortedAlbums.length <= ALBUMS_PER_PAGE,
    );
  }, [visibleAlbums]);

  const loadMoreAlbums = () => {
    if (allAlbumsLoaded || isLoadingMore) return;

    setIsLoadingMore(true);
    // Using a short timeout to ensure UI updates before heavy lifting, and to show spinner
    setTimeout(() => {
      // Ordenar álbumes por ID en orden inverso (más nuevos primero)
      const sortedAlbums = [...visibleAlbums].sort((a, b) =>
        b.id.localeCompare(a.id),
      );

      const nextPage = currentPage + 1;
      const startIndex = nextPage * ALBUMS_PER_PAGE;
      const endIndex = startIndex + ALBUMS_PER_PAGE;
      const newAlbums = sortedAlbums.slice(startIndex, endIndex);

      if (newAlbums.length > 0) {
        setDisplayedAlbums((prevAlbums) => [...prevAlbums, ...newAlbums]);
        setCurrentPage(nextPage);
        if (
          newAlbums.length < ALBUMS_PER_PAGE ||
          displayedAlbums.length + newAlbums.length === sortedAlbums.length
        ) {
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
        console.error('Failed to open URL:', error);
        Alert.alert('Error', 'Could not open the album link.');
      }
    } else {
      console.warn(`Don't know how to open this URL: ${albumUrl}`);
      Alert.alert('Invalid Link', `Cannot open this URL: ${albumUrl}`);
    }
  };

  const renderFooter = () => {
    if (isLoadingMore) {
      return (
        <Spinner
          size="lg"
          color={ThemeColors.light.tint}
          style={{ marginVertical: 20 }}
        />
      );
    }
    if (allAlbumsLoaded) {
      return null;
    }
    return (
      <Button
        variant="outline"
        onPress={loadMoreAlbums}
        isDisabled={isLoadingMore}
        style={styles.loadMoreButton}
      >
        <Button.Label>Cargar Más</Button.Label>
      </Button>
    );
  };

  if (loading && displayedAlbums.length === 0) {
    return <ProgressWithMessage message="Cargando álbumes..." />;
  }

  return (
    <TabScreenWrapper style={styles.container} edges={['top']}>
      {offline && <OfflineBanner text="Mostrando datos sin conexión" />}
      <FlatList
        data={displayedAlbums}
        renderItem={({ item }) => (
          <View
            style={
              width > 600
                ? styles.albumCardContainerTwoColumns
                : styles.albumCardContainerOneColumn
            }
          >
            <AlbumCard
              album={item}
              onPress={() => handleAlbumPress(item.albumUrl)}
            />
          </View>
        )}
        keyExtractor={(item) => item.id}
        numColumns={width > 600 ? 2 : 1}
        key={width > 600 ? 'TWO_COLUMNS' : 'ONE_COLUMN'} // Important for re-render on column change
        contentContainerStyle={[
          styles.listContentContainer,
          {
            maxWidth: width > 1200 ? 1600 : 1200,
            alignSelf: 'center',
          },
          Platform.OS === 'ios' && { paddingBottom: 100 },
        ]}
        onEndReached={loadMoreAlbums}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
      />
    </TabScreenWrapper>
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
      paddingTop: 12,
      paddingBottom: 20,
    },
    albumCardContainerOneColumn: {
      width: '100%',
      paddingHorizontal: 16,
    },
    albumCardContainerTwoColumns: {
      width: '50%',
      paddingHorizontal: 6,
    },
    loadMoreButton: {
      marginVertical: 20,
      alignSelf: 'center',
      backgroundColor: theme.tint,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
  });
};
