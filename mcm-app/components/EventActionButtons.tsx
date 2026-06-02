import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GlassIconButton from '@/components/ui/GlassIconButton';
import { useColorScheme } from '@/hooks/useColorScheme';
import colors from '@/constants/colors';

interface Props {
  /** Abre el bottom sheet de ajustes del tab. */
  onSettings: () => void;
  /** Navega a la sección "Compartiendo" (reflexiones). */
  onCompartiendo: () => void;
  /**
   * Oculta el botón de Compartiendo (p.ej. cuando ya estamos en esa pantalla).
   * El de Ajustes se mantiene siempre.
   */
  showCompartiendo?: boolean;
}

/**
 * Acciones de evento como botones liquid-glass flotantes arriba a la derecha,
 * alineados con la fila del header (donde vive el botón "Atrás" a la izquierda).
 * Se renderizan por encima del Stack.Navigator del evento (ver
 * `app/(tabs)/visitapapa.tsx` y `app/(tabs)/mas.tsx`).
 *
 * - Compartiendo: cristal con tinte verde + icono blanco (acción principal).
 * - Ajustes: cristal neutro + icono gris adaptado al esquema (secundaria).
 */
export default function EventActionButtons({
  onSettings,
  onCompartiendo,
  showCompartiendo = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const settingsIcon = scheme === 'dark' ? '#EDEDED' : '#5B6573';
  // Alinea las acciones con la fila del header del stack.
  const top = insets.top + (Platform.OS === 'android' ? 8 : 2);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={[styles.row, { top }]} pointerEvents="box-none">
        {showCompartiendo && (
          <GlassIconButton
            icon="forum"
            onPress={onCompartiendo}
            tintColor={colors.success}
            iconColor="#FFFFFF"
            accessibilityLabel="Compartiendo"
          />
        )}
        <GlassIconButton
          icon="settings"
          onPress={onSettings}
          iconColor={settingsIcon}
          iconSize={21}
          accessibilityLabel="Ajustes"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    right: 14,
    flexDirection: 'row',
    gap: 10,
    zIndex: 1000,
  },
});
