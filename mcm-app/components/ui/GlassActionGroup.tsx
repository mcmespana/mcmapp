import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { shadows } from '@/constants/uiStyles';
import GlassSurface from '@/components/ui/GlassSurface';

/**
 * Grupo de botones-icono en una ÚNICA cápsula liquid-glass segmentada (con
 * divisores), idéntico al de `EventActionButtons` (ajustes/cuenta dentro de un
 * evento). Es el look "bonito" de referencia: cristal real + borde hairline
 * claro + sombra suave + divisores entre iconos.
 *
 * Reutilizable para barras de acciones de cabeceras custom (Inicio, etc.).
 * Acepta `children` por item, así que sirve para iconos con badge animado.
 */
export interface GlassActionItem {
  key: string;
  onPress: () => void;
  accessibilityLabel?: string;
  /** Icono (o icono + badge) a renderizar dentro del segmento. */
  children: React.ReactNode;
}

interface GlassActionGroupProps {
  items: GlassActionItem[];
  /** Alto de la cápsula (cuadrado-ish por segmento). Por defecto 38. */
  height?: number;
  /** Ancho de cada segmento. Por defecto 44. */
  itemWidth?: number;
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_H = 38;

export default function GlassActionGroup({
  items,
  height = DEFAULT_H,
  itemWidth = 44,
  style,
}: GlassActionGroupProps) {
  const isDark = useColorScheme() === 'dark';
  const dividerColor = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)';
  const radius = height / 2;

  if (items.length === 0) return null;

  return (
    <View style={[{ borderRadius: radius }, shadows.sm as ViewStyle, style]}>
      <View
        style={[styles.group, { height, borderRadius: radius }]}
        pointerEvents="box-none"
      >
        <GlassSurface
          variant="regular"
          style={[styles.glass, { borderRadius: radius }]}
        />
        {items.map((it, i) => (
          <React.Fragment key={it.key}>
            {i > 0 && (
              <View
                style={[styles.divider, { backgroundColor: dividerColor }]}
              />
            )}
            <Pressable
              onPress={it.onPress}
              accessibilityRole="button"
              accessibilityLabel={it.accessibilityLabel}
              hitSlop={6}
              style={[styles.half, { width: itemWidth, height }]}
            >
              {it.children}
            </Pressable>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  glass: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  half: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { width: StyleSheet.hairlineWidth, height: 20 },
});
