import React from 'react';
import { Platform, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { shadows } from '@/constants/uiStyles';
import GlassSurface from '@/components/ui/GlassSurface';

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

const H = 38;

/**
 * Acciones de evento (Compartiendo + Ajustes) como un único grupo segmentado
 * liquid-glass, arriba a la derecha y alineado con la fila del header (donde
 * el botón "Atrás" flotante vive a la izquierda). Ambos iconos comparten el
 * mismo estilo neutro — coherente con los controles agrupados del cantoral.
 *
 * Se renderiza por encima del Stack.Navigator del evento (ver
 * `app/(tabs)/visitapapa.tsx` y `app/(tabs)/mas.tsx`).
 */
export default function EventActionButtons({
  onSettings,
  onCompartiendo,
  showCompartiendo = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const fg = isDark ? '#EDEDED' : '#3A3A3C';
  const divider = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)';
  // Alinea con el centro del botón "Atrás" flotante (headerLeft) de la fila.
  const top =
    insets.top +
    (Platform.OS === 'android' ? 10 : Platform.OS === 'web' ? 12 : 3);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={[styles.anchor, { top }]} pointerEvents="box-none">
        <View style={styles.shadow}>
          <View style={styles.group}>
            <GlassSurface variant="regular" style={styles.glass} />
            {showCompartiendo && (
              <>
                <Pressable
                  onPress={onCompartiendo}
                  style={styles.half}
                  accessibilityRole="button"
                  accessibilityLabel="Compartiendo"
                  hitSlop={6}
                >
                  <MaterialIcons name="forum" size={20} color={fg} />
                </Pressable>
                <View style={[styles.divider, { backgroundColor: divider }]} />
              </>
            )}
            <Pressable
              onPress={onSettings}
              style={styles.half}
              accessibilityRole="button"
              accessibilityLabel="Ajustes"
              hitSlop={6}
            >
              <MaterialIcons name="settings" size={20} color={fg} />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', right: 14, zIndex: 1000 },
  shadow: {
    borderRadius: H / 2,
    ...(shadows.sm as ViewStyle),
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    height: H,
    borderRadius: H / 2,
    overflow: 'hidden',
  },
  glass: {
    borderRadius: H / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  half: {
    width: 44,
    height: H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { width: StyleSheet.hairlineWidth, height: 20 },
});
