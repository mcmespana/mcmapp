/**
 * Pantalla "puente" del enlace a una canción: `/cancion?f=<fichero>`.
 *
 * Es el enlace corto y estable de una canción (la ruta de verdad,
 * `/cancionero/cancion?filename=…&list=…`, lleva detalles de la navegación
 * que no sirven para compartir). Resuelve el fichero contra el catálogo (la
 * misma caché de `useFirebaseData` que las pantallas del cantoral) y la abre
 * en su ruta, sobre las categorías del cantoral. Es lo mismo que hace la
 * paleta ⌘K.
 *
 * En web, el detalle de canción escribe este mismo enlace en la barra de
 * direcciones (`hooks/useSongWebLocation.ts`): así F5 vuelve a la canción y
 * copiar la URL sirve para pasarla. También vale como deep link en el móvil.
 *
 * Si el fichero no existe (borrada, renombrada, enlace mal copiado) se llega
 * al cantoral sin más.
 */
import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useColorScheme } from '@/hooks/useColorScheme';
import { themeColors } from '@/constants/colors';
import { filterSongsData, type SongsData } from '@/utils/filterSongsData';
import {
  buildSongIndex,
  findSongByFilename,
  songOpenParams,
} from '@/utils/songIndex';
import { cantoralHref } from '@/utils/eventRoutes';

export default function SongDeepLink() {
  const params = useLocalSearchParams<{ f?: string }>();
  const filename = typeof params.f === 'string' ? params.f : '';
  const isDark = useColorScheme() === 'dark';
  const { data, loading } = useFirebaseData<SongsData>(
    'songs',
    'songs',
    filterSongsData as (data: unknown) => SongsData,
  );

  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    const song =
      filename && data
        ? findSongByFilename(buildSongIndex(data), filename)
        : null;
    // Con caché caliente la canción llega en el primer render. Si no está,
    // se espera a que termine la carga (disco o Firebase) antes de darla por
    // perdida: puede ser una canción nueva que la caché aún no tenía.
    if (filename && !song && loading) return;
    done.current = true;
    router.replace(
      (song
        ? cantoralHref('SongDetail', songOpenParams(song))
        : cantoralHref('Categories')) as never,
    );
  }, [data, loading, filename]);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: themeColors(isDark).background },
      ]}
    >
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
