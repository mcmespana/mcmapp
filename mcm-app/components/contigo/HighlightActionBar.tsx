import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import {
  HIGHLIGHT_COLORS,
  HIGHLIGHT_COLOR_KEYS,
  type HighlightColorKey,
  type SelectionHighlight,
} from '@/utils/highlightRanges';
import { h } from '@/utils/haptics';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { WARM_DARK, warm } from '@/components/contigo/theme';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';

interface HighlightActionBarProps {
  visible: boolean;
  /** Hay una selección activa (habilita colores y goma). */
  hasSelection: boolean;
  /**
   * Subrayado que la selección YA tiene, si lo tiene. Cuando llega, la barra
   * deja de comportarse como si fuera texto nuevo: marca el color puesto y el
   * copy pasa a hablar de cambiarlo o quitarlo.
   */
  selection?: SelectionHighlight | null;
  onPickColor: (color: HighlightColorKey) => void;
  onErase: () => void;
  onDone: () => void;
  isDark: boolean;
}

/**
 * Barra flotante del modo subrayar: colores pastel + goma + Listo.
 * Sin selección muestra la pista de uso; con selección se activan los chips.
 */
export function HighlightActionBar({
  visible,
  hasSelection,
  selection = null,
  onPickColor,
  onErase,
  onDone,
  isDark,
}: HighlightActionBarProps) {
  // La barra de subrayado se coloca justo encima de la de pestañas.
  const tabBarClearance = useTabBarClearance();
  const anim = useSharedValue(0);

  useEffect(() => {
    anim.set(
      withSpring(visible ? 1 : 0, {
        stiffness: 60,
        damping: 10,
        mass: 1,
      }),
    );
  }, [visible, anim]);

  const barStyle = useAnimatedStyle(() => ({
    opacity: anim.get(),
    transform: [{ translateY: interpolate(anim.get(), [0, 1], [120, 0]) }],
  }));

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.wrap,
        barStyle,
        {
          bottom: tabBarClearance + 8,
          backgroundColor: isDark ? WARM_DARK.bgCard : '#FFFFFF',
          borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
          shadowColor: '#000',
        },
      ]}
    >
      {hasSelection ? (
        <View style={styles.row}>
          {HIGHLIGHT_COLOR_KEYS.map((key) => {
            const isCurrent = selection?.color === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => {
                  h.add();
                  onPickColor(key);
                }}
                style={[
                  styles.swatch,
                  {
                    backgroundColor: HIGHLIGHT_COLORS[key].swatch,
                    borderColor: isDark
                      ? 'rgba(255,255,255,0.25)'
                      : 'rgba(0,0,0,0.10)',
                  },
                  // El color que ya tiene la selección se marca con un aro,
                  // para que se vea de un vistazo cuál está puesto.
                  isCurrent && styles.swatchCurrent,
                  isCurrent && {
                    borderColor: isDark ? '#FFFFFF' : '#3A3A3C',
                  },
                ]}
                accessibilityLabel={
                  isCurrent
                    ? `Color ${key}, el que ya tiene la selección`
                    : `Subrayar en color ${key}`
                }
                accessibilityState={{ selected: isCurrent }}
              />
            );
          })}
          <View
            style={[
              styles.divider,
              {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.12)'
                  : 'rgba(0,0,0,0.08)',
              },
            ]}
          />
          <TouchableOpacity
            onPress={() => {
              h.remove();
              onErase();
            }}
            style={styles.eraseBtn}
            accessibilityLabel={
              selection
                ? 'Quitar el subrayado de la selección'
                : 'Quitar subrayado de la selección'
            }
          >
            <MaterialIcons
              name="format-color-reset"
              size={22}
              color={warm(isDark).textSec}
            />
          </TouchableOpacity>
        </View>
      ) : (
        <Text
          style={[styles.hint, { color: warm(isDark).textSec }]}
          numberOfLines={2}
        >
          Mantén pulsado y desliza para elegir inicio y fin
        </Text>
      )}

      <TouchableOpacity
        onPress={() => {
          h.tap();
          onDone();
        }}
        style={[styles.doneBtn, { backgroundColor: warm(isDark).accent }]}
        accessibilityLabel="Terminar de subrayar"
      >
        <Text style={styles.doneText}>Listo</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  swatchCurrent: {
    borderWidth: 2.5,
  },
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.xl,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 60,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  divider: {
    width: 1,
    height: 22,
    marginHorizontal: 2,
  },
  eraseBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    flex: 1,
    ...typography.footnote,
    fontWeight: '600',
    lineHeight: 16,
  },
  doneBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.pillFull,
  },
  doneText: {
    color: '#FFFFFF',
    ...typography.caption,
    fontWeight: '800',
  },
});
