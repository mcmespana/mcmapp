/**
 * Pantalla "puente" del deep link `https://mcm.expo.app/playlist?p=1234`.
 *
 * Toma el código `?p=` de la URL, lo persiste en una mini-cola in-memory
 * y redirige al stack del cancionero. Allí, `CategoriesScreen` detectará
 * el pending code y navegará automáticamente a "Seleccionadas" para
 * autoimportar la playlist.
 */
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { setPendingCloudPlaylistCode } from '@/utils/pendingCloudPlaylist';
import { isValidCode } from '@/utils/playlistCodes';

export default function PlaylistDeepLink() {
  const params = useLocalSearchParams<{ p?: string; code?: string }>();
  const code =
    typeof params.p === 'string'
      ? params.p
      : typeof params.code === 'string'
        ? params.code
        : undefined;

  useEffect(() => {
    if (code && isValidCode(code)) {
      setPendingCloudPlaylistCode(code);
    }
    // En web, también limpiamos el query string para que no se quede en la URL.
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        window.history.replaceState({}, document.title, '/');
      } catch {
        // ignore
      }
    }
    router.replace('/(tabs)/cancionero' as any);
  }, [code]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
