/**
 * Pantalla "puente" del deep link `https://mcm.expo.app/coro?c=1234`.
 *
 * Toma el código `?c=` de la URL, lo persiste en una mini-cola in-memory
 * y redirige al stack del cancionero. Allí, `CategoriesScreen` detectará
 * el pending code y navegará automáticamente a "Seleccionadas" para
 * unirse al coro.
 */
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { setPendingChoirCode } from '@/utils/pendingCloudPlaylist';
import { isValidCode } from '@/utils/playlistCodes';

export default function ChoirDeepLink() {
  const params = useLocalSearchParams<{ c?: string; code?: string }>();
  const code =
    typeof params.c === 'string'
      ? params.c
      : typeof params.code === 'string'
        ? params.code
        : undefined;

  useEffect(() => {
    if (code && isValidCode(code)) {
      setPendingChoirCode(code);
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
