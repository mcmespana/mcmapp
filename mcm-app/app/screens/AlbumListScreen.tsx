import React, { useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Linking,
  useWindowDimensions,
  Alert,
  Platform,
} from 'react-native';
import { Button } from 'heroui-native';
import TabScreenWrapper from '@/components/ui/TabScreenWrapper';
import AlbumCard from '@/components/AlbumCard';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import OfflineBanner from '@/components/OfflineBanner';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useAlbumPagination } from '@/hooks/useAlbumPagination';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';
import { Colors as ThemeColors, TabHeaderColors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

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
  const { displayedAlbums, allAlbumsLoaded, loadMoreAlbums } =
    useAlbumPagination(sortedAlbums);

  const handleAlbumPress = useCallback(async (albumUrl: string) => {
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
  }, []);

  const listFooterComponent = useMemo(() => {
    if (allAlbumsLoaded) return null;
    return (
      <Button
        variant="outline"
        onPress={loadMoreAlbums}
        style={styles.loadMoreButton}
        accessibilityRole="button"
        accessibilityLabel="Cargar más álbumes"
      >
        <Button.Label>Cargar Más</Button.Label>
      </Button>
    );
  }, [allAlbumsLoaded, loadMoreAlbums]);

  const renderItem = useCallback(
    ({ item }: { item: Album }) => (
      <View style={width > 600 ? styles.cardTwoColumns : styles.cardOneColumn}>
        <AlbumCard
          album={item}
          onPress={() => handleAlbumPress(item.albumUrl)}
        />
      </View>
    ),
    [width, handleAlbumPress],
  );

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
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={width > 600 ? 2 : 1}
        key={width > 600 ? 'TWO_COLUMNS' : 'ONE_COLUMN'}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={5}
        contentContainerStyle={[
          styles.listContent,
          { maxWidth: width > 1200 ? 1600 : 1200, alignSelf: 'center' },
          Platform.OS === 'ios' && { paddingBottom: 100 },
        ]}
        onEndReached={loadMoreAlbums}
        onEndReachedThreshold={0.5}
        ListFooterComponent={listFooterComponent}
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
