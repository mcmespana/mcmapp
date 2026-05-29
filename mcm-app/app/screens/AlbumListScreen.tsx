import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Linking,
  useWindowDimensions,
  Alert,
  Platform,
} from 'react-native';
import { Button, Spinner } from 'heroui-native';
import TabScreenWrapper from '@/components/ui/TabScreenWrapper.ios';
import AlbumCard from '@/components/AlbumCard';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import OfflineBanner from '@/components/OfflineBanner';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';
import { Colors as ThemeColors, TabHeaderColors } from '@/constants/colors';
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

function isAlbumVisibleForProfile(
  album: Album,
  profileTags: readonly string[],
): boolean {
  if (profileTags.includes('all')) return true;
  const albumTags = album.tags;
  if (!albumTags || albumTags.length === 0) return true;
  return albumTags.some((tag) => profileTags.includes(tag));
}

export default function AlbumListScreen() {
  const { width } = useWindowDimensions();
  const scheme = useColorScheme();
  const {
    data: allAlbumsData,
    loading,
    offline,
  } = useFirebaseData<Album[]>('albums', 'albums');
  const resolved = useResolvedProfileConfig();
  const sortedAlbums = React.useMemo(() => {
    const seen = new Set<string>();
    const visible = (allAlbumsData ?? []).filter((album) => {
      if (seen.has(album.id)) return false;
      seen.add(album.id);
      return isAlbumVisibleForProfile(album, resolved.albumTags);
    });
    return visible.sort((a, b) => b.id.localeCompare(a.id));
  }, [allAlbumsData, resolved.albumTags]);
  const [displayedAlbums, setDisplayedAlbums] = useState<Album[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [allAlbumsLoaded, setAllAlbumsLoaded] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  useEffect(() => {
    const initialAlbums = sortedAlbums.slice(0, ALBUMS_PER_PAGE);
    setDisplayedAlbums(initialAlbums);
    setCurrentPage(0);
    setAllAlbumsLoaded(
      initialAlbums.length < ALBUMS_PER_PAGE ||
        sortedAlbums.length <= ALBUMS_PER_PAGE,
    );
  }, [sortedAlbums]);

  const loadMoreAlbums = () => {
    if (allAlbumsLoaded || isLoadingMore) return;
    setIsLoadingMore(true);
    const nextPage = currentPage + 1;
    const startIndex = nextPage * ALBUMS_PER_PAGE;
    const newAlbums = sortedAlbums.slice(
      startIndex,
      startIndex + ALBUMS_PER_PAGE,
    );
    if (newAlbums.length > 0) {
      setDisplayedAlbums((prev) => [...prev, ...newAlbums]);
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
  };

  const handleAlbumPress = async (albumUrl: string) => {
    const supported = await Linking.canOpenURL(albumUrl);
    if (supported) {
      try {
        await Linking.openURL(albumUrl);
      } catch {
        Alert.alert('Error', 'No se pudo abrir el álbum.');
      }
    } else {
      Alert.alert('Enlace inválido', `No se puede abrir: ${albumUrl}`);
    }
  };

  const renderFooter = () => {
    if (isLoadingMore) {
      return (
        <Spinner
          size="lg"
          color={ThemeColors[scheme ?? 'light'].tint}
          style={{ marginVertical: 20 }}
        />
      );
    }
    if (allAlbumsLoaded) return null;
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
    <TabScreenWrapper
      style={[
        styles.container,
        { backgroundColor: ThemeColors[scheme ?? 'light'].background },
      ]}
      edges={['top']}
      tintColor={TabHeaderColors.fotos}
    >
      {offline && <OfflineBanner text="Mostrando datos sin conexión" />}
      <FlatList
        data={displayedAlbums}
        renderItem={({ item }) => (
          <View
            style={width > 600 ? styles.cardTwoColumns : styles.cardOneColumn}
          >
            <AlbumCard
              album={item}
              onPress={() => handleAlbumPress(item.albumUrl)}
            />
          </View>
        )}
        keyExtractor={(item) => item.id}
        numColumns={width > 600 ? 2 : 1}
        key={width > 600 ? 'TWO_COLUMNS' : 'ONE_COLUMN'}
        contentContainerStyle={[
          styles.listContent,
          { maxWidth: width > 1200 ? 1600 : 1200, alignSelf: 'center' },
          Platform.OS === 'ios' && { paddingBottom: 100 },
        ]}
        onEndReached={loadMoreAlbums}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
      />
    </TabScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingTop: 12,
    paddingBottom: 20,
  },
  cardOneColumn: {
    width: '100%',
    paddingHorizontal: 16,
  },
  cardTwoColumns: {
    width: '50%',
    paddingHorizontal: 6,
  },
  loadMoreButton: {
    marginVertical: 20,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
});
