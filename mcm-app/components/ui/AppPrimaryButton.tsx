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
import { UIColors, Colors, themeColors } from '@/constants/colors';
import { focusRing, radii } from '@/constants/uiStyles';
import { h } from '@/utils/haptics';
import { contrastRatio, onColor } from '@/utils/colorUtils';
import typography from '@/constants/typography';

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
  /** Icono MaterialIcons junto al texto. */
  icon?: keyof typeof MaterialIcons.glyphMap;
  /**
   * De qué lado va el icono. `right` es el de "siguiente/continuar" (la flecha
   * empuja hacia delante); `left` el de "guardar/enviar".
   */
  iconPosition?: 'left' | 'right';
  /** Color de fondo cuando está activo. Por defecto azul de acción de iOS. */
  color?: string;
  /**
   * Color del texto/icono cuando está activo. Si no se pasa, **lo decide el
   * contraste**: blanco mientras llegue al 3:1 que pide un texto de este
   * tamaño y peso sobre el relleno (el azul de acción de iOS da 3,86:1, y el
   * blanco es la convención), y si no llega —un acento claro, el dorado, el
   * amarillo de un evento— la tinta que más contraste dé. Antes era `#fff`
   * fijo, y con `color` variable eso es ilegible: es el mismo fallo del §H4 de
   * PLAN_DISENO.
   */
  textColor?: string;
  disabled?: boolean;
  /** Muestra un spinner y deshabilita la pulsación. */
  loading?: boolean;
  /** Háptica al pulsar (por defecto sí). */
  haptic?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

const DEFAULT_COLOR = UIColors.iosBlue;

export default function AppPrimaryButton({
  label,
  onPress,
  icon,
  iconPosition = 'left',
  color = DEFAULT_COLOR,
  textColor,
  disabled = false,
  loading = false,
  haptic = true,
  style,
  accessibilityLabel,
}: AppPrimaryButtonProps) {
  const isDark = useColorScheme() === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];
  const isDisabled = disabled || loading;
  // El foco de teclado solo existe en web y con teclado externo; en móvil esto
  // nunca se activa. Ver `design.md` §5: el foco no puede distinguirse solo por
  // color, tiene que verse el grosor.
  const [focused, setFocused] = React.useState(false);

  const bg = isDisabled ? themeColors(isDark).separator : color;
  const ink =
    textColor ??
    (contrastRatio('#FFFFFF', color) >= 3 ? '#fff' : onColor(color));
  const fg = isDisabled ? theme.icon : ink;

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
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.button,
        { backgroundColor: bg },
        // El borde existe SIEMPRE en transparente para que enfocar no mueva el
        // botón: solo cambia de color. Se usa el color del texto, que siempre
        // contrasta con el fondo del propio botón.
        focused && { borderColor: fg },
        style,
      ]}
    >
      <PressableFeedback.Scale />
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : icon && iconPosition === 'left' ? (
        <MaterialIcons name={icon} size={18} color={fg} />
      ) : null}
      {/* Mantener el texto visible también en loading para no “saltar” de ancho. */}
      <View>
        <Text style={[styles.label, { color: fg }]}>{label}</Text>
      </View>
      {!loading && icon && iconPosition === 'right' ? (
        <MaterialIcons name={icon} size={18} color={fg} />
      ) : null}
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
    borderWidth: focusRing.borderWidth,
    borderColor: 'transparent',
  },
  label: {
    ...typography.body,
    fontWeight: '700',
  },
});
