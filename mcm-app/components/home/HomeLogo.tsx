import React from 'react';
import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { PressableFeedback } from 'heroui-native';
import colors, { CarismoColors } from '@/constants/colors';

// Tamaño del logo junto al título «MCM App» (cabe en la barra nativa).
const LOGO_SIZE = 32;

/**
 * El logo de MCM (la «M») para la cabecera de Inicio. Es la silueta de
 * `assets/images/logo-m.png` —blanca y con fondo transparente— teñida en
 * ejecución, así que el mismo fichero vale para el celeste de siempre y para el
 * verde del modo Carismochito (y para cualquier color que haga falta mañana).
 *
 * Con el modo Carismochito activo el logo pasa a ser un botón: reabre su
 * explicación y desde ahí se puede salir sin agitar el móvil.
 */
export default function HomeLogo({
  carismoActive,
  isDark,
  onCarismoPress,
}: {
  carismoActive: boolean;
  isDark: boolean;
  onCarismoPress: () => void;
}) {
  const logo = (
    <Image
      source={require('@/assets/images/logo-m.png')}
      style={styles.logo}
      contentFit="contain"
      tintColor={
        carismoActive
          ? isDark
            ? CarismoColors.dark
            : CarismoColors.light
          : colors.info
      }
      accessibilityIgnoresInvertColors
    />
  );

  if (!carismoActive) return logo;
  return (
    <PressableFeedback
      onPress={onCarismoPress}
      accessibilityRole="button"
      accessibilityLabel="Modo Carismochito activo. Toca para ver opciones"
    >
      {logo}
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
});
