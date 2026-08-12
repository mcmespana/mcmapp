import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';
import { radii } from '@/constants/uiStyles';
import { h } from '@/utils/haptics';

/**
 * Botón CTA unificado (Fase 2 de PLAN_UI_NATIVA).
 *
 * Sustituye el patrón "Enviar/Guardar/Aceptar" que cada modal reimplementaba a
 * mano con `TouchableOpacity` + su propio estilo (azul lleno, icono opcional,
 * spinner al enviar, estado deshabilitado en gris). La pulsación usa
 * `PressableFeedback` (heroui) con `Scale`, la primitiva estándar de contenido
 * decidida para la app.
 *
 * `color` permite que Contigo (warm) y los eventos (color por evento) mantengan
 * su paleta propia sin dejar de compartir la forma/comportamiento del botón.
 */
interface AppPrimaryButtonProps {
  label: string;
  onPress: () => void;
  /** Icono MaterialIcons a la izquierda del texto. */
  icon?: keyof typeof MaterialIcons.glyphMap;
  /** Color de fondo cuando está activo. Por defecto azul de acción de iOS. */
  color?: string;
  /** Color del texto/icono cuando está activo. Por defecto blanco. */
  textColor?: string;
  disabled?: boolean;
  /** Muestra un spinner y deshabilita la pulsación. */
  loading?: boolean;
  /** Háptica al pulsar (por defecto sí). */
  haptic?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

const DEFAULT_COLOR = '#007AFF'; // azul de acción de iOS

export default function AppPrimaryButton({
  label,
  onPress,
  icon,
  color = DEFAULT_COLOR,
  textColor = '#fff',
  disabled = false,
  loading = false,
  haptic = true,
  style,
  accessibilityLabel,
}: AppPrimaryButtonProps) {
  const isDark = useColorScheme() === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];
  const isDisabled = disabled || loading;

  const bg = isDisabled ? (isDark ? '#3A3A3C' : '#E5E5EA') : color;
  const fg = isDisabled ? theme.icon : textColor;

  return (
    <PressableFeedback
      onPress={() => {
        if (isDisabled) return;
        if (haptic) h.tap();
        onPress();
      }}
      isDisabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[styles.button, { backgroundColor: bg }, style]}
    >
      <PressableFeedback.Scale />
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : icon ? (
        <MaterialIcons name={icon} size={18} color={fg} />
      ) : null}
      {/* Mantener el texto visible también en loading para no “saltar” de ancho. */}
      <View>
        <Text style={[styles.label, { color: fg }]}>{label}</Text>
      </View>
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: radii.md,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
});
