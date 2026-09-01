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
  /**
   * Tinte explícito del cristal. Sin él, la cápsula usa el material de sistema
   * (`systemChromeMaterial` en iOS) y un blanco translúcido en Android/web —
   * ambos siguen la apariencia del SISTEMA, no el tema de la app. Pásalo
   * cuando la cápsula deba seguir el tema elegido en la app (p. ej. sobre un
   * WebView, donde el usuario puede haber forzado claro/oscuro a mano).
   */
  tintColor?: string;
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_H = 38;

export default function GlassActionGroup({
  items,
  height = DEFAULT_H,
  itemWidth = 44,
  tintColor,
  style,
}: GlassActionGroupProps) {
  const isDark = useColorScheme() === 'dark';
  const dividerColor = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)';
  const radius = height / 2;
  // El rim blanco es el borde de cristal estándar sobre superficies claras; en
  // una cápsula tintada de oscuro queda como un halo raro, así que se atenúa.
  const rimColor =
    tintColor && isDark
      ? 'rgba(255, 255, 255, 0.10)'
      : 'rgba(255, 255, 255, 0.22)';

  if (items.length === 0) return null;

  return (
    <View style={[{ borderRadius: radius }, shadows.card as ViewStyle, style]}>
      <View
        style={[styles.group, { height, borderRadius: radius }]}
        pointerEvents="box-none"
      >
        <GlassSurface
          variant="regular"
          tintColor={tintColor}
          style={[
            styles.glass,
            { borderRadius: radius, borderColor: rimColor },
          ]}
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
