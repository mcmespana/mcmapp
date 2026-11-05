// El círculo de una persona: las iniciales SIEMPRE debajo y la foto encima,
// si la tiene (plan 05; `sticpa_pl_avatar_html` del plugin). Si no hay foto,
// o tarda, o falla, se ven las iniciales: ni hueco ni salto.
//
// La foto la pide `expo-image` con lo que diga el cliente (`photoSource`: la
// URL con el token, o la imagen inventada del falso), en segundo plano
// (`priority="low"`), con la versión en la URL como clave de caché. Sin
// `photoUrl` no se pide nada. Salir vacía su caché (plan 05, `photos.ts`).

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { radii } from '@/constants/uiStyles';
import typography from '@/constants/typography';
import { getComunicaApi, isComunicaApiAvailable } from '@/services/comunica';
import BrandGradient from './BrandGradient';
import { useComunicaTheme } from './useComunicaTheme';

export const initialsOf = (p: { firstName: string; lastName: string }) =>
  `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase();

interface Props {
  person: {
    id: string;
    firstName: string;
    lastName: string;
    photoUrl?: string;
  };
  size?: number;
  /**
   * `neutral` (por defecto, listas), `accent` (acento lleno) o `brand`: el
   * degradado de marca de la cabecera de una ficha (≤ 72 pt; nunca en una fila
   * de lista larga). `background`/`ink` mandan sobre el tono si se pasan.
   */
  tone?: 'neutral' | 'accent' | 'brand';
  /** Fondo de las iniciales (sobre el fondo hundido, el de tarjeta). */
  background?: string;
  /** Color de las iniciales (sobre un `background` de color). */
  ink?: string;
}

export default function PersonAvatar({
  person,
  size = 40,
  tone = 'neutral',
  background,
  ink,
}: Props) {
  const t = useComunicaTheme();
  const source = useMemo(
    () =>
      person.photoUrl && isComunicaApiAvailable()
        ? getComunicaApi().photoSource(person.photoUrl)
        : null,
    [person.photoUrl],
  );
  const big = size >= 64;
  const brand = tone === 'brand';
  const fill =
    background ?? (tone === 'neutral' ? t.backgroundSunken : t.accentFill);
  const inkColor =
    ink ??
    (brand ? t.onGradient : tone === 'accent' ? t.onAccent : t.textSecondary);
  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          backgroundColor: fill,
        },
      ]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {brand && !background ? <BrandGradient variant="mark" /> : null}
      <Text
        style={[
          big ? styles.initialsBig : styles.initials,
          brand && styles.initialsBrand,
          { color: inkColor },
        ]}
      >
        {initialsOf(person)}
      </Text>
      {source ? (
        <Image
          source={source}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          priority="low"
          cachePolicy="disk"
          recyclingKey={person.id}
          transition={120}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: { ...typography.subhead, fontWeight: '600' },
  initialsBig: { ...typography.h2 },
  initialsBrand: { fontWeight: '800' },
});
