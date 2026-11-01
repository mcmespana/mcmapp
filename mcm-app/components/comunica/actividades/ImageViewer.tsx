// Visor a pantalla completa de una imagen del evento (el cartel, una foto del
// cuerpo o de la galería). Se cierra con el botón, con «atrás» de Android o
// deslizando hacia abajo. La imagen sale de la misma caché que la ficha.

import React, { useMemo } from 'react';
import { Modal, PanResponder, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { PressableFeedback } from 'heroui-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { radii } from '@/constants/uiStyles';
import typography from '@/constants/typography';
import type { ImageRef } from '@/services/comunica/contract';
import { h } from '@/utils/haptics';
import type { ImageResolver } from './EventMedia';

/** Lo que hay que deslizar hacia abajo para cerrar. */
const DISMISS_DISTANCE = 90;

interface Props {
  image: ImageRef | null;
  resolve: ImageResolver;
  alt: string;
  onClose: () => void;
}

export default function ImageViewer({ image, resolve, alt, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderRelease: (_, g) => {
          if (g.dy > DISMISS_DISTANCE) onClose();
        },
      }),
    [onClose],
  );
  const source = image ? resolve(image) : null;
  return (
    <Modal
      visible={!!image}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop} {...pan.panHandlers}>
        {source ? (
          <Image
            source={source}
            cachePolicy="disk"
            contentFit="contain"
            accessibilityLabel={alt}
            style={styles.image}
          />
        ) : null}
        <PressableFeedback
          onPress={() => {
            h.tap();
            onClose();
          }}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          style={[styles.close, { top: insets.top + 8 }]}
        >
          <IconSymbol name="xmark" size={20} color="#fff" />
        </PressableFeedback>
        <Text style={[styles.hint, { bottom: insets.bottom + 16 }]}>
          Desliza hacia abajo para cerrar
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  close: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  hint: {
    position: 'absolute',
    alignSelf: 'center',
    color: 'rgba(255,255,255,0.7)',
    ...typography.caption,
  },
});
