// La imagen a pantalla completa (plan 13: el cartel, una foto de la galería): fondo negro, la imagen entera y un botón para cerrar (44 pt). Sin
// gestos propios ni paquetes nativos: el sistema ya sabe cerrar un `Modal` (atrás en Android, deslizar en iOS con `presentationStyle`).

import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';

export default function ImageViewer({
  source,
  label,
  onClose,
}: {
  source: {
    uri: string;
    headers?: Record<string, string>;
    cacheKey?: string;
  } | null;
  label: string;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={!!source}
      transparent={false}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.wrap}>
        {source ? (
          <Image
            source={source}
            contentFit="contain"
            style={styles.image}
            accessibilityLabel={label}
          />
        ) : null}
        <PressableFeedback
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar la imagen"
          style={styles.close}
        >
          <IconSymbol name="xmark" size={22} color="#fff" />
        </PressableFeedback>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  image: { flex: 1 },
  close: {
    position: 'absolute',
    top: 56,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
