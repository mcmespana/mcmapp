import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { MaterialIcons } from '@expo/vector-icons';
import { shadows } from '@/constants/uiStyles';
import GlassSurface from './GlassSurface';

interface Props {
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  /** Tinte opcional del cristal. Sin tinte → cristal neutro (chrome material). */
  tintColor?: string;
  iconColor?: string;
  /** Tamaño del icono. Por defecto 22. */
  iconSize?: number;
  /** Diámetro del botón circular. Por defecto 44. */
  diameter?: number;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

/**
 * Botón circular liquid-glass, posición *relativa* (a diferencia de GlassFAB,
 * que es absoluto). Pensado para colocarse en filas — p.ej. las acciones de
 * evento flotantes arriba a la derecha (ver `EventActionButtons`).
 *
 * Usa `GlassSurface` (resuelve cristal real en iOS, backdrop-filter en web y
 * superficie tintada en Android), así que funciona en las tres plataformas con
 * un único archivo.
 */
export default function GlassIconButton({
  icon,
  onPress,
  tintColor,
  iconColor = '#1A1A1A',
  iconSize = 22,
  diameter = 44,
  accessibilityLabel,
  style,
}: Props) {
  const round = { borderRadius: diameter / 2 };
  return (
    <View
      style={[
        styles.shadowWrap,
        { width: diameter, height: diameter },
        round,
        style,
      ]}
    >
      <PressableFeedback
        onPress={onPress}
        style={[styles.btn, round]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        hitSlop={6}
      >
        <PressableFeedback.Scale />
        <GlassSurface
          variant="regular"
          tintColor={tintColor}
          style={[round, styles.rim]}
        />
        <MaterialIcons name={icon} size={iconSize} color={iconColor} />
      </PressableFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    ...(shadows.md as ViewStyle),
  },
  btn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  rim: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
});
