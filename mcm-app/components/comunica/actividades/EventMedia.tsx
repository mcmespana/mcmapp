// Una imagen de un evento (cartel, imagen del cuerpo, galería) con
// `expo-image`: entera (`contain`) y a SU proporción, que se sabe al cargar.
// Las de `{ documentId }` se piden con la sesión por la ruta del evento
// (`useEventFileSource`); la caché en disco va por `documentId`, así que sin
// conexión salen de ahí. Tocarla abre el visor a pantalla completa.

import React, { useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { PressableFeedback } from 'heroui-native';
import { radii } from '@/constants/uiStyles';
import type { PhotoSource } from '@/services/comunica/client';
import type { ImageRef } from '@/services/comunica/contract';
import { useComunicaTheme } from '../comun/useComunicaTheme';

export type ImageResolver = (ref: ImageRef) => PhotoSource | null;

/** `{ url }` tal cual; `{ documentId }`, con la sesión. */
export const resolveImage =
  (fileSource: (documentId: string) => PhotoSource | null): ImageResolver =>
  (ref) =>
    'url' in ref
      ? { uri: ref.url, cacheKey: ref.url }
      : fileSource(ref.documentId);

interface Props {
  image: ImageRef;
  resolve: ImageResolver;
  alt: string;
  onPress?: () => void;
  /** Proporción mientras carga (el cartel, 3:4). */
  initialRatio?: number;
  /** Recorta para llenar (miniaturas de la galería) en vez de enseñarla entera. */
  cover?: boolean;
  style?: ViewStyle;
}

export default function EventMedia({
  image,
  resolve,
  alt,
  onPress,
  initialRatio = 4 / 3,
  cover = false,
  style,
}: Props) {
  const t = useComunicaTheme();
  const [ratio, setRatio] = useState(initialRatio);
  const source = resolve(image);
  const picture = (
    <Image
      source={source ?? undefined}
      cachePolicy="disk"
      contentFit={cover ? 'cover' : 'contain'}
      accessibilityLabel={alt}
      transition={150}
      onLoad={(e) => {
        const { width, height } = e.source;
        if (!cover && width > 0 && height > 0) setRatio(width / height);
      }}
      style={[styles.image, { aspectRatio: cover ? 1 : ratio }]}
    />
  );
  return (
    <View
      style={[styles.frame, { backgroundColor: t.backgroundSunken }, style]}
    >
      {onPress ? (
        <PressableFeedback
          onPress={onPress}
          accessibilityRole="imagebutton"
          accessibilityLabel={alt}
          accessibilityHint="Abre la imagen a pantalla completa"
        >
          {picture}
        </PressableFeedback>
      ) : (
        picture
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radii.lg, overflow: 'hidden' },
  image: { width: '100%' },
});
