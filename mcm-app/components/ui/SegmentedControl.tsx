import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { MaterialIcons } from '@expo/vector-icons';

import { useColorScheme } from '@/hooks/useColorScheme';
import colors, { themeColors } from '@/constants/colors';
import { onColor } from '@/utils/colorUtils';
import { h } from '@/utils/haptics';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';

/**
 * Conmutador de 2-3 opciones (Fase 2 de PLAN_UI_NATIVA).
 *
 * Recoge el patrón que se reimplementaba a mano en varias pantallas —píldora de
 * fondo gris, botón activo relleno de color, etiqueta blanca— y lo deja en un
 * solo sitio. La forma sale del conmutador Calendario/Agenda, que es el que
 * mejor estaba resuelto.
 *
 * No usa el `Tabs` de heroui a propósito: aquí no se navega, se cambia una vista
 * dentro de la misma pantalla, y `Tabs` arrastra su propia gestión de foco y
 * accesibilidad de navegación que aquí sobra y confunde a los lectores de
 * pantalla.
 *
 * `accentColor` permite que Contigo (warm) y los eventos (color por evento)
 * mantengan su paleta sin dejar de compartir la forma.
 *
 * **El color del texto NO se elige aquí, lo decide el contraste** (2026-09-10).
 * La primera versión pintaba la etiqueta activa de `#FFFFFF` fijo pasara lo que
 * pasara con `accentColor`, y eso es ilegible en cuanto el acento es claro: con
 * el celeste de marca —que es el DEFECTO, el del conmutador Mes/Agenda del
 * calendario— daba **2,64:1**, y con el dorado de Contigo 2,80:1. Ahora lo
 * resuelve `onColor()`, que compara los dos candidatos por contraste real: con
 * el celeste elige negro (7,95:1). Es el mismo arreglo del §H4/§A6-bis de
 * PLAN_DISENO, que ya había pasado en cinco pantallas.
 *
 * La etiqueta inactiva tampoco es un gris a mano: era `#8E8E93`, que sobre la
 * pista clara da 2,60:1 (por debajo incluso del 3:1 de elementos no
 * textuales). Ahora sale de `textSecondary`, que llega a 4,77:1 en claro y
 * 6,30:1 en oscuro.
 */
export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Icono opcional a la izquierda de la etiqueta. */
  icon?: keyof typeof MaterialIcons.glyphMap;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Color de relleno del segmento activo. Por defecto el celeste de marca. */
  accentColor?: string;
  /** Háptica al cambiar (por defecto sí). */
  haptic?: boolean;
  /** Versión baja, para sitios con poco alto (p. ej. dentro de un header). */
  compact?: boolean;
  style?: ViewStyle;
  /** Etiqueta del grupo para lectores de pantalla. */
  accessibilityLabel?: string;
}

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accentColor = colors.info,
  haptic = true,
  compact = false,
  style,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  const isDark = useColorScheme() === 'dark';
  const roles = themeColors(isDark);
  // Sobre el relleno del segmento activo manda el contraste, no el modo.
  const activeInk = onColor(accentColor);
  const inactiveInk = roles.textSecondary;

  return (
    <View
      style={[
        styles.track,
        { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' },
        style,
      ]}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <PressableFeedback
            key={option.value}
            onPress={() => {
              if (active) return;
              if (haptic) h.select();
              onChange(option.value);
            }}
            style={[
              styles.segment,
              compact && styles.segmentCompact,
              active && { backgroundColor: accentColor },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
          >
            {option.icon ? (
              <MaterialIcons
                name={option.icon}
                size={16}
                color={active ? activeInk : inactiveInk}
              />
            ) : null}
            <Text
              style={[
                styles.label,
                compact && styles.labelCompact,
                { color: active ? activeInk : inactiveInk },
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </PressableFeedback>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 10,
    padding: 2,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: radii.sm,
  },
  segmentCompact: {
    paddingVertical: 4,
    gap: 5,
  },
  label: {
    ...typography.subhead,
    fontWeight: '600',
  },
  labelCompact: {
    ...typography.caption,
  },
});
