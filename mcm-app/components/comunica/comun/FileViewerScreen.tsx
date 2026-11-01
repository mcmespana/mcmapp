// El visor de archivos del área (plan 16, C1; lo comparte el plan 13 con los
// archivos de un evento): una imagen con `expo-image` o un PDF con el visor
// del sistema (WebView en iOS), a pantalla completa, con «Compartir» en la
// cabecera. Recibe un archivo YA bajado a la caché (`useOpenFile`) y lo
// borra al cerrarse: nada abierto se queda en el móvil.

import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { Image } from 'expo-image';
import { WebView } from 'react-native-webview';
import EmptyState from '@/components/ui/EmptyState';
import { holdOpenFile, shareOpenFile } from '@/services/comunica/openFiles';
import { openModeOf } from '@/utils/comunica/files';
import HeaderIconButton from './HeaderIconButton';
import { useComunicaTheme } from './useComunicaTheme';

/** Solo archivos nuestros: de la caché de la app o un `blob:`/`data:` del navegador. */
export const isLocalFileUri = (uri: string) =>
  /^(file:\/\/|blob:|data:)/.test(uri);

export default function FileViewerScreen({
  uri,
  name,
  mime,
}: {
  uri: string;
  name: string;
  mime: string;
}) {
  const t = useComunicaTheme();
  const ok = isLocalFileUri(uri);
  const mode = openModeOf(mime, Platform.OS);
  useEffect(() => (ok ? holdOpenFile(uri) : undefined), [ok, uri]);
  const file = { localUri: uri, fileName: name, mimeType: mime };
  const folder = uri.slice(0, uri.lastIndexOf('/') + 1);

  return (
    <View style={[styles.root, { backgroundColor: t.background }]}>
      <Stack.Screen
        options={{
          title: name || 'Archivo',
          headerRight: ok
            ? () => (
                <HeaderIconButton
                  icon="square.and.arrow.up"
                  label="Compartir"
                  onPress={() => void shareOpenFile(file).catch(() => {})}
                />
              )
            : undefined,
        }}
      />
      {!ok ? (
        <EmptyState
          icon="error-outline"
          title="No se puede abrir este archivo"
          titleColor={t.text}
        />
      ) : mode === 'image' ? (
        <Image
          source={{ uri }}
          style={styles.fill}
          contentFit="contain"
          accessibilityLabel={name}
          // Ni a disco ni a memoria de `expo-image`: se borra al cerrar.
          cachePolicy="none"
        />
      ) : mode !== 'pdf' ? (
        // En web y Android el PDF va fuera del visor (`useOpenFile`): por si
        // llega igual, se ofrece compartir.
        <EmptyState
          icon="description"
          title={name}
          subtitle="Este archivo se abre con otra aplicación."
          actionLabel="Compartir"
          onAction={() => void shareOpenFile(file).catch(() => {})}
          accentColor={t.accentText}
          titleColor={t.text}
          subtitleColor={t.textSecondary}
        />
      ) : (
        <WebView
          source={{ uri }}
          originWhitelist={['file://*']}
          allowingReadAccessToURL={folder}
          allowFileAccess
          style={styles.fill}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
});
