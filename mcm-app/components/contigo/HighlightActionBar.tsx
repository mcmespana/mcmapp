import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  HIGHLIGHT_COLORS,
  HIGHLIGHT_COLOR_KEYS,
  type HighlightColorKey,
} from '@/utils/highlightRanges';
import { h } from '@/utils/haptics';

interface HighlightActionBarProps {
  visible: boolean;
  /** Hay una selección activa (habilita colores y goma). */
  hasSelection: boolean;
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
  onPickColor,
  onErase,
  onDone,
  isDark,
}: HighlightActionBarProps) {
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: Platform.OS !== 'web',
      tension: 60,
      friction: 10,
    }).start();
  }, [visible, anim]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [120, 0],
  });

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.wrap,
        {
          bottom: insets.bottom + 14,
          opacity: anim,
          transform: [{ translateY }],
          backgroundColor: isDark ? '#26221C' : '#FFFFFF',
          borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
          shadowColor: '#000',
        },
      ]}
    >
      {hasSelection ? (
        <View style={styles.row}>
          {HIGHLIGHT_COLOR_KEYS.map((key) => (
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
              ]}
              accessibilityLabel={`Subrayar en color ${key}`}
            />
          ))}
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
            accessibilityLabel="Quitar subrayado de la selección"
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
