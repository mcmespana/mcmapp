/**
 * Pantalla "puente" del deep link de playlists. Dos variantes:
 *
 *  - `https://mcm.expo.app/playlist?p=1234` → playlist "en la nube": persiste el
 *    código de 4 dígitos para que SelectedSongs lo descargue de Firebase.
 *  - `mcmapp://playlist?d=<payload>` → playlist **offline**: el payload lleva la
 *    playlist entera embebida (categoría + número + tono/cejilla). Se persiste
 *    tal cual y se resuelve sin conexión en SelectedSongs contra el catálogo
 *    cacheado.
 *
 * En ambos casos redirige al stack del cancionero, donde `CategoriesScreen`
 * detecta el pending y navega automáticamente a "Seleccionadas".
 */
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  setPendingCloudPlaylistCode,
  setPendingOfflinePlaylist,
} from '@/utils/pendingCloudPlaylist';
import { isValidCode } from '@/utils/playlistCodes';

export default function PlaylistDeepLink() {
  const params = useLocalSearchParams<{
    p?: string;
    code?: string;
    d?: string;
  }>();
  const code =
    typeof params.p === 'string'
      ? params.p
      : typeof params.code === 'string'
        ? params.code
        : undefined;
  const offline = typeof params.d === 'string' ? params.d : undefined;

  useEffect(() => {
    if (offline) {
      setPendingOfflinePlaylist(offline);
    } else if (code && isValidCode(code)) {
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
  }, [code, offline]);

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
