import React, { useEffect, useRef } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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
    anim.value = withSpring(visible ? 1 : 0, {
      stiffness: 60,
      damping: 10,
      mass: 1,
    });
  }, [visible, anim]);

  const barStyle = useAnimatedStyle(() => ({
    opacity: anim.value,
    transform: [{ translateY: interpolate(anim.value, [0, 1], [120, 0]) }],
  }));

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.wrap,
        barStyle,
        {
          bottom: tabBarClearance + 8,
          backgroundColor: isDark ? '#26221C' : '#FFFFFF',
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
              color={isDark ? '#A09A8A' : '#7A6550'}
            />
          </TouchableOpacity>
        </View>
      ) : (
        <Text
          style={[styles.hint, { color: isDark ? '#A09A8A' : '#7A6550' }]}
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
        style={[
          styles.doneBtn,
          { backgroundColor: isDark ? '#DAA520' : '#C4922A' },
        ]}
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
    borderRadius: 22,
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
    borderRadius: 14,
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
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  doneBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  doneText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
