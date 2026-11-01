// El visor de archivos a pantalla completa (plan 16, regla C1; lo usa también el plan 13): una imagen con `expo-image` o un PDF en la WebView del sistema (iOS), con
// «Compartir» en la cabecera. La copia que se bajó se BORRA al cerrar el visor. Lo que se enseña llega por un hueco en memoria (`fileViewer.ts`), no por la URL.

import React, { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { WebView } from 'react-native-webview';
import { PressableFeedback } from 'heroui-native';
import EmptyState from '@/components/ui/EmptyState';
import typography from '@/constants/typography';
import {
  clearOpenCopies,
  shareLocalFile,
} from '@/services/comunica/eventFiles';
import {
  clearViewingFile,
  getViewingFile,
} from '@/services/comunica/fileViewer';
import { useComunicaTheme } from '../comun/useComunicaTheme';

export default function FileViewerScreen() {
  const t = useComunicaTheme();
  const router = useRouter();
  const file = getViewingFile();

  // Al cerrar el visor, fuera la copia.
  useEffect(
    () => () => {
      clearViewingFile();
      void clearOpenCopies();
    },
    [],
  );

  if (!file) {
    return (
      <View style={[styles.root, { backgroundColor: t.background }]}>
        <Stack.Screen options={{ title: 'Documento' }} />
        <EmptyState
          icon="inbox"
          title="Este archivo ya no está abierto"
          actionLabel="Volver"
          onAction={() => router.back()}
          accentColor={t.accentText}
          titleColor={t.text}
          subtitleColor={t.textSecondary}
        />
      </View>
    );
  }
  return (
    <View style={[styles.root, { backgroundColor: t.background }]}>
      <Stack.Screen
        options={{
          title: file.title,
          headerRight: () => (
            <PressableFeedback
              onPress={() => void shareLocalFile(file.uri, file.fileName)}
              accessibilityRole="button"
              accessibilityLabel="Compartir"
              style={styles.share}
            >
              <Text style={[styles.shareLabel, { color: t.accentText }]}>
                Compartir
              </Text>
            </PressableFeedback>
          ),
        }}
      />
      {file.kind === 'image' ? (
        <Image
          source={{ uri: file.uri }}
          contentFit="contain"
          style={styles.fill}
          accessibilityLabel={file.title}
        />
      ) : (
        <WebView
          source={{ uri: file.uri }}
          originWhitelist={['*']}
          allowFileAccess
          allowingReadAccessToURL={
            Platform.OS === 'ios' ? file.uri.replace(/[^/]+$/, '') : undefined
          }
          style={styles.fill}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  share: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  shareLabel: { ...typography.button },
});
