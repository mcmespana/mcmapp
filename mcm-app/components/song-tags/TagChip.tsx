/**
 * Chip de etiqueta — la pieza visual común de todo el sistema de etiquetas.
 *
 * Tres variantes, las tres del mismo molde para que se reconozcan como la
 * misma cosa en la nube, en la barra de contexto y en la ficha de la canción:
 *
 * - `cloud`   → chip blanco de la hoja de etiquetas (tamaño variable por uso)
 * - `active`  → etiqueta activa dentro de su pantalla (marrón, con ✕)
 * - `outline` → candidata de refinamiento / etiqueta de la ficha
 *
 * El recuento va en gris claro DENTRO del chip: es dato de apoyo, no parte del
 * nombre. Las etiquetas sin emoji no reservan hueco — el chip simplemente es
 * más corto, así no hay que inventar iconos para que la fila cuadre.
 */
import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { h } from '@/utils/haptics';
import type { ResolvedTag } from '@/utils/songTags';
import { HighlightColors, UIColors, themeColors } from '@/constants/colors';

export type TagChipVariant = 'cloud' | 'active' | 'outline';

interface TagChipProps {
  tag: ResolvedTag;
  variant?: TagChipVariant;
  isDark: boolean;
  /** Tamaño de la fuente del label (la nube lo varía según el uso). */
  fontSize?: number;
  /** Oculta el recuento (en la ficha de una canción sobra). */
  hideCount?: boolean;
  onPress?: (tag: ResolvedTag) => void;
  /** Si se pasa, el chip muestra una ✕ que llama a esta función. */
  onRemove?: (tag: ResolvedTag) => void;
  accessibilityHint?: string;
}

export default function TagChip({
  tag,
  variant = 'outline',
  isDark,
  fontSize,
  hideCount = false,
  onPress,
  onRemove,
  accessibilityHint,
}: TagChipProps) {
  const styles = React.useMemo(
    () => createStyles(isDark, variant),
    [isDark, variant],
  );

  const body = (
    <>
      {!!tag.emoji && <Text style={styles.emoji}>{tag.emoji}</Text>}
      <Text
        style={[styles.label, fontSize ? { fontSize } : null]}
        numberOfLines={1}
      >
        {tag.label}
      </Text>
      {!hideCount && tag.count > 0 && (
        <Text style={styles.count}>{tag.count}</Text>
      )}
      {onRemove && (
        <MaterialIcons
          name="close"
          size={15}
          color={isDark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.7)'}
        />
      )}
    </>
  );

  const handlePress = () => {
    if (onRemove) {
      h.remove();
      onRemove(tag);
      return;
    }
    if (onPress) {
      h.select();
      onPress(tag);
    }
  };

  if (!onPress && !onRemove) {
    return <View style={styles.chip}>{body}</View>;
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={styles.chip}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={
        onRemove ? `Quitar la etiqueta ${tag.label}` : tag.label
      }
      accessibilityHint={accessibilityHint}
    >
      {body}
    </TouchableOpacity>
  );
}

const createStyles = (isDark: boolean, variant: TagChipVariant) => {
  const isActive = variant === 'active';

  const background = isActive
    ? isDark
      ? UIColors.accentYellow
      : HighlightColors.light.fg
    : variant === 'cloud'
      ? themeColors(isDark).background
      : isDark
        ? 'rgba(244,193,30,0.10)'
        : '#FFFFFF';

  const border = isActive
    ? 'transparent'
    : variant === 'cloud'
      ? themeColors(isDark).separator
      : isDark
        ? 'rgba(244,193,30,0.32)'
        : '#EBDCA8';

  const labelColor = isActive
    ? isDark
      ? '#3A2C00'
      : '#FFFFFF'
    : variant === 'cloud'
      ? themeColors(isDark).textStrong
      : isDark
        ? '#E8E2D2'
        : '#6E6E73';

  const chipShadow =
    variant === 'cloud' && !isDark
      ? Platform.OS === 'web'
        ? ({ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' } as any)
        : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.04,
            shadowRadius: 2,
            elevation: 1,
          }
      : null;

  return StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: variant === 'cloud' ? 7 : 6,
      backgroundColor: background,
      borderWidth: isActive ? 0 : 1,
      borderColor: border,
      borderRadius: 100,
      paddingHorizontal: variant === 'cloud' ? 16 : 12,
      paddingVertical: variant === 'cloud' ? 11 : 7,
      ...chipShadow,
    },
    emoji: {
      fontSize: variant === 'cloud' ? 15 : 13,
    },
    label: {
      fontSize: variant === 'cloud' ? 14.5 : 13.5,
      fontWeight: isActive ? '600' : '500',
      letterSpacing: -0.1,
      color: labelColor,
      flexShrink: 1,
    },
    count: {
      fontSize: 11.5,
      fontWeight: '600',
      color: isActive
        ? isDark
          ? 'rgba(58,44,0,0.55)'
          : 'rgba(255,255,255,0.6)'
        : isDark
          ? '#7C7C82'
          : '#B4B4BA',
      fontVariant: ['tabular-nums'],
    },
  });
};
