import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { MaterialIcons } from '@expo/vector-icons';

import { useColorScheme } from '@/hooks/useColorScheme';
import colors from '@/constants/colors';
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
                color={active ? '#FFFFFF' : '#8E8E93'}
              />
            ) : null}
            <Text
              style={[
                styles.label,
                compact && styles.labelCompact,
                active ? styles.labelActive : null,
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
    color: '#8E8E93',
  },
  labelCompact: {
    ...typography.caption,
  },
  labelActive: {
    color: '#FFFFFF',
  },
});
