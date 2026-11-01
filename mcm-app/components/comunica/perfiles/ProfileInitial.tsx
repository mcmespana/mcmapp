// La inicial de una persona en las piezas de perfiles (plan 11;
// `sticpa_name_initial`): en el acento lleno la que se está viendo, en gris
// las demás. Sin foto: el CRM no la da para familias.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import typography from '@/constants/typography';
import type { ProfileRef } from '@/services/comunica/contract';
import { initialOf } from '@/utils/comunica/profiles';
import { useComunicaTheme } from '../comun/useComunicaTheme';

export default function ProfileInitial({
  profile,
  selected,
  size = 36,
}: {
  profile: Pick<ProfileRef, 'firstName' | 'lastName'>;
  selected: boolean;
  size?: number;
}) {
  const t = useComunicaTheme();
  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: selected ? t.accentFill : t.backgroundSunken,
        },
      ]}
    >
      <Text
        style={[
          size > 40 ? styles.big : styles.small,
          { color: selected ? t.onAccent : t.textSecondary },
        ]}
      >
        {initialOf(profile)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  small: { ...typography.body, fontWeight: '600' },
  big: { ...typography.title },
});
