import React from 'react';
import {
  TouchableOpacity,
  Platform,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import GlassSurface from '@/components/ui/GlassSurface';
import { useColorScheme } from '@/hooks/useColorScheme';

/**
 * Botón-icono unificado (Fase 2 de PLAN_UI_NATIVA).
 *
 * Encapsula el patrón "cápsula glass" que se repetía a mano por toda la app:
 * en iOS un `GlassSurface` (cristal del sistema); en Android/Web un fondo +
 * borde suaves. Acepta `children` (icono, badge animado, etc.), así que sirve
 * para casos con overlays como la campana de notificaciones de Inicio.
 *
 * NO es un control nativo de barra de navegación (esos van como bar items del
 * header). Esto es para botones de acción EN EL CUERPO o en barras custom.
 */
interface AppIconButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  accessibilityLabel?: string;
  /** Tinte del cristal (iOS) — p.ej. para un botón de acento. */
  tintColor?: string;
  /** Borde en Android/Web (por defecto, gris suave según tema). */
  borderColor?: string;
  /** Tamaño del botón (cuadrado). Por defecto 36. */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export default function AppIconButton({
  onPress,
  children,
  accessibilityLabel,
  tintColor,
  borderColor,
  size = 36,
  style,
}: AppIconButtonProps) {
  const isDark = useColorScheme() === 'dark';
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.btn,
        { width: size, height: size, borderRadius: size / 2 },
        Platform.OS !== 'ios' && {
          backgroundColor: isDark
            ? 'rgba(255,255,255,0.07)'
            : 'rgba(0,0,0,0.05)',
          borderColor:
            borderColor ??
            (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'),
          borderWidth: 1,
        },
        style,
      ]}
    >
      {Platform.OS === 'ios' && (
        <GlassSurface variant="regular" tintColor={tintColor} />
      )}
      {children}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
