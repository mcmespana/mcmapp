// app/(tabs)/fotos.tsx
import { logger } from '@/utils/logger';
import React from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Linking,
  Platform,
  useWindowDimensions,
  ViewStyle,
  Alert,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { createNativeStackNavigator } from 'expo-router/build/react-navigation/native-stack';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useTabListScroll } from '@/components/tabs/useTabScroll';
import { Button } from 'heroui-native';
import AlbumCard from '@/components/AlbumCard';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import OfflineBanner from '@/components/OfflineBanner';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useAlbumPagination } from '@/hooks/useAlbumPagination';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';
import { Colors as ThemeColors } from '@/constants/colors';
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
  albumCardContainerThreeColumns: ViewStyle;
  loadMoreButton: ViewStyle;
}

export function FotosScreen() {
  const { listRef, onScroll, contentPaddingBottom } =
    useTabListScroll<FlatList>('fotos');
  // El header es transparente y las portadas pasan POR DEBAJO: la lista
  // arranca justo bajo la barra y se funde con ella al deslizar.
  const headerHeight = useHeaderHeight();
  const { width } = useWindowDimensions();
  const scheme = useColorScheme();
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);
  const {
    data: allAlbumsData,
    loading,
    offline,
  } = useFirebaseData<Album[]>('albums', 'albums');
  const resolved = useResolvedProfileConfig();
  const sortedAlbums = React.useMemo(() => {
    const visible = (allAlbumsData ?? []).filter((album) =>
      isAlbumVisibleForProfile(album, resolved.albumTags),
    );
    // Orden inverso por ID (más nuevos primero).
    return visible.sort((a, b) => b.id.localeCompare(a.id));
  }, [allAlbumsData, resolved.albumTags]);
  const { displayedAlbums, allAlbumsLoaded, loadMoreAlbums } =
    useAlbumPagination(sortedAlbums);

  // ⚡ Bolt Optimization: Memoize the press handler to prevent re-creating the function
  // on every render, which in turn prevents re-rendering all AlbumCard items in the list.
  const handleAlbumPress = React.useCallback(async (albumUrl: string) => {
    const supported = await Linking.canOpenURL(albumUrl);
    if (supported) {
      try {
        await Linking.openURL(albumUrl);
      } catch (error) {
        logger.error('Failed to open URL:', error);
        Alert.alert(
          'Error',
          'No se ha podido abrir el link, qué pena más grande',
        );
      }
    } else {
      logger.warn(`Don't know how to open this URL: ${albumUrl}`);
      Alert.alert('Invalid Link', `Esta URL es un poco raruna: ${albumUrl}`);
    }
  }, []);

  const renderFooter = () => {
    if (allAlbumsLoaded) {
      return null;
    }
    return (
      <Button
        variant="outline"
        onPress={loadMoreAlbums}
        style={styles.loadMoreButton}
      >
        <Button.Label>Cargar más...</Button.Label>
      </Button>
    );
  };

  // Columnas según ancho: 3 en iPad landscape (≥1024, incluye iPad 9 a 1080),
  // 2 en tablet portrait / pantallas medianas, 1 en móvil.
  const numColumns = width >= 1024 ? 3 : width > 600 ? 2 : 1;
  const columnContainerStyle =
    numColumns === 3
      ? styles.albumCardContainerThreeColumns
      : numColumns === 2
        ? styles.albumCardContainerTwoColumns
        : styles.albumCardContainerOneColumn;

  // ⚡ Bolt Optimization: Extract renderItem and memoize it to prevent re-renders of the FlatList.
  // This ensures that when the parent component re-renders (e.g., due to scroll events),
  // the FlatList doesn't unnecessarily re-render all of its items.
  const renderItem = React.useCallback(
    ({ item }: { item: Album }) => (
      <View style={columnContainerStyle}>
        <AlbumCard
          album={item}
          onPress={() => handleAlbumPress(item.albumUrl)}
        />
      </View>
    ),
    [columnContainerStyle, handleAlbumPress],
  );

  if (loading && displayedAlbums.length === 0) {
    return <ProgressWithMessage message="Cargando álbumes..." />;
  }

  return (
    <View style={styles.container}>
      {/* El header flota sobre el contenido: el aviso de "sin conexión" tiene
          que bajar hasta debajo de la barra para no quedar tapado. */}
      {offline && (
        <View style={{ marginTop: headerHeight }}>
          <OfflineBanner text="Mostrando datos sin conexión" />
        </View>
      )}
      <Animated.FlatList
        ref={listRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        data={displayedAlbums}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        // ⚡ Bolt Optimization: Virtualization props added to improve performance.
        // Impact: Reduces initial render time and memory usage by only rendering
        // a small subset of items initially and limiting batch sizes.
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={5}
        // SIN título: la pestaña ya se llama Fotos y las portadas se explican
        // solas, así que un hero de dos líneas solo robaba una pantalla entera
        // de álbumes. El `TabScreenWrapper` con `edges={['top']}` ya deja el
        // hueco de la barra de estado; el contenido arranca ahí y se va con el
        // scroll, sin nada fijo que lo tape.
        numColumns={numColumns}
        key={`COLS_${numColumns}`} // Important for re-render on column change
        contentContainerStyle={[
          styles.listContentContainer,
          {
            maxWidth: width > 1200 ? 1600 : 1200,
            alignSelf: 'center',
          },
          {
            paddingTop: offline ? 12 : headerHeight + 12,
            paddingBottom: contentPaddingBottom,
          },
        ]}
        // El contenido ya reserva el hueco del header; sin esto iOS lo suma
        // otra vez y deja una franja vacía.
        contentInsetAdjustmentBehavior="never"
        onEndReached={loadMoreAlbums}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
      />
    </View>
  );
}

/**
 * Tab de Fotos: stack propio para tener un header NATIVO transparente —
 * las portadas pasan por debajo y se funden con él al deslizar, igual que en
 * el cantoral, pero SIN texto de título (la pestaña ya se llama Fotos).
 */
const FotosStack = createNativeStackNavigator();
export default function FotosTab() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const isIOS = Platform.OS === 'ios';
  return (
    <FotosStack.Navigator
      screenOptions={{
        title: '',
        headerShadowVisible: false,
        headerTransparent: true,
        headerTintColor: isDark ? '#FFFFFF' : '#1a1a1a',
        // iOS <26 necesita el blur explícito; en iOS 26+ lo pone el sistema
        // (combinarlo provoca solape, ver cancionero.tsx).
        ...(isIOS && parseInt(String(Platform.Version), 10) < 26
          ? { headerBlurEffect: 'systemChromeMaterial' as const }
          : {}),
        // Android/Web no tienen blur nativo: una barra semitransparente del
        // color del fondo deja intuir las fotos por debajo.
        ...(isIOS
          ? {}
          : {
              headerStyle: {
                backgroundColor: isDark
                  ? 'rgba(21,23,24,0.72)'
                  : 'rgba(255,255,255,0.72)',
              },
            }),
      }}
    >
      <FotosStack.Screen name="FotosMain" component={FotosScreen} />
    </FotosStack.Navigator>
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
    },
    albumCardContainerOneColumn: {
      width: '100%',
      paddingHorizontal: 16,
    },
    albumCardContainerTwoColumns: {
      width: '50%',
      paddingHorizontal: 6,
    },
    albumCardContainerThreeColumns: {
      width: '33.333%',
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
