/**
 * Hoja de etiquetas — a un toque desde el header del cantoral y desde la
 * propia pantalla de una etiqueta.
 *
 * Rehecha en octubre de 2026: era una nube de chips blancos que variaban de
 * tamaño en 1 pt (no se notaba) y con un recuento gris casi invisible. Ahora
 * es una rejilla de dos columnas: cada etiqueta con su emoji (o el icono de
 * etiqueta si no tiene), su nombre bien grande y «8 canciones» debajo. Orden
 * por uso, igual que antes.
 *
 * «Editar» deja ocultar etiquetas que no van contigo (p. ej. las de otra
 * casa): desaparecen de aquí, de las candidatas para combinar y de la ficha de
 * la canción, pero las canciones siguen en el cantoral. Las ocultas se ven al
 * final, apagadas, solo en modo edición, para poder recuperarlas.
 */
import React, { useMemo, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import BottomSheet from '@/components/BottomSheet';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useHiddenTags } from '@/hooks/useHiddenTags';
import type { ResolvedTag } from '@/utils/songTags';
import { UIColors, themeColors } from '@/constants/colors';
import { hexAlpha } from '@/utils/colorUtils';
import { h } from '@/utils/haptics';
import typography from '@/constants/typography';
import spacing from '@/constants/spacing';
import { radii } from '@/constants/uiStyles';

interface TagCloudSheetProps {
  visible: boolean;
  onClose: () => void;
  tags: ResolvedTag[];
  /** Etiquetas ya activas en la pantalla desde la que se abre la hoja. */
  activeSlugs?: string[];
  onSelectTag: (tag: ResolvedTag) => void;
  /** Se llama con la hoja ya desmontada (para navegar sin pelearse con iOS). */
  onCloseComplete?: () => void;
}

export default function TagCloudSheet({
  visible,
  onClose,
  tags,
  activeSlugs = [],
  onSelectTag,
  onCloseComplete,
}: TagCloudSheetProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const styles = useMemo(() => createStyles(isDark), [isDark]);
  const { hiddenSlugs, toggleHidden } = useHiddenTags();
  const [editing, setEditing] = useState(false);

  // Cada apertura empieza fuera de edición.
  const [wasVisible, setWasVisible] = useState(visible);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    if (visible) setEditing(false);
  }

  const shown = tags.filter((t) => !hiddenSlugs.has(t.slug));
  const hiddenTags = tags.filter((t) => hiddenSlugs.has(t.slug));

  const subtitle = editing
    ? 'Toca una para ocultarla o volver a mostrarla. Sus canciones siguen en el cantoral.'
    : shown.length === 0
      ? 'Has ocultado todas las etiquetas. Toca «Editar» para recuperarlas.'
      : 'Todas las canciones de una etiqueta, agrupadas por categoría.';

  const renderTile = (tag: ResolvedTag, isHidden: boolean) => {
    const isActive = activeSlugs.includes(tag.slug);
    const countLabel = `${tag.count} ${tag.count === 1 ? 'canción' : 'canciones'}`;
    return (
      <PressableFeedback
        key={tag.slug}
        style={[
          styles.tile,
          isActive && !editing && styles.tileActive,
          isHidden && styles.tileHidden,
        ]}
        onPress={() => {
          if (editing) {
            h.toggle();
            toggleHidden(tag.slug);
            return;
          }
          h.select();
          onSelectTag(tag);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${tag.label}, ${countLabel}`}
        accessibilityHint={
          editing
            ? isHidden
              ? 'Volver a mostrar esta etiqueta'
              : 'Ocultar esta etiqueta'
            : undefined
        }
      >
        <PressableFeedback.Highlight />
        <View style={[styles.badge, editing && styles.badgeEditing]}>
          {editing ? (
            <MaterialIcons
              name={isHidden ? 'visibility-off' : 'visibility'}
              size={18}
              color={themeColors(isDark).textSecondary}
            />
          ) : tag.emoji ? (
            <Text style={styles.emoji}>{tag.emoji}</Text>
          ) : (
            <MaterialIcons name="sell" size={18} color={styles.icon.color} />
          )}
        </View>
        <View style={styles.tileText}>
          <Text style={styles.tileLabel} numberOfLines={2}>
            {tag.label}
          </Text>
          <Text style={styles.tileCount}>{countLabel}</Text>
        </View>
      </PressableFeedback>
    );
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onCloseComplete={onCloseComplete}
      title="Etiquetas"
      headerRight={
        <PressableFeedback
          onPress={() => {
            h.tap();
            setEditing((v) => !v);
          }}
          style={styles.editButton}
          accessibilityRole="button"
          accessibilityLabel={
            editing ? 'Terminar de editar' : 'Editar etiquetas'
          }
        >
          <Text style={styles.editText}>{editing ? 'Listo' : 'Editar'}</Text>
        </PressableFeedback>
      }
      paddingHorizontal={0}
    >
      <Text style={styles.subtitle}>{subtitle}</Text>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {shown.map((t) => renderTile(t, false))}
        </View>
        {editing && hiddenTags.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Ocultas</Text>
            <View style={styles.grid}>
              {hiddenTags.map((t) => renderTile(t, true))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}

const createStyles = (isDark: boolean) => {
  const t = themeColors(isDark);
  return StyleSheet.create({
    subtitle: {
      ...typography.caption,
      color: t.textSecondary,
      paddingHorizontal: spacing.md + spacing.xs,
      paddingBottom: spacing.md,
    },
    scroll: {
      // La hoja se ajusta al contenido; con muchas etiquetas la rejilla
      // scrollea dentro en vez de empujar la hoja fuera de pantalla.
      maxHeight: Dimensions.get('window').height * 0.62,
    },
    content: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.lg,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: spacing.sm + spacing.xs,
    },
    tile: {
      width: '48.5%',
      flexDirection: 'row',
      alignItems: 'center',
      // Sin `gap`: la capa de pulsación de PressableFeedback es un hijo más y
      // se comía un hueco a la izquierda. El espacio lo pone el texto.
      padding: spacing.sm + spacing.xs,
      borderRadius: radii.lg,
      backgroundColor: t.backgroundSunken,
      borderWidth: 1,
      borderColor: 'transparent',
      overflow: 'hidden',
    },
    tileActive: {
      borderColor: UIColors.accentYellow,
      backgroundColor: hexAlpha(UIColors.accentYellow, isDark ? '1F' : '24'),
    },
    tileHidden: {
      opacity: 0.45,
    },
    badge: {
      width: 36,
      height: 36,
      borderRadius: radii.pillFull,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: hexAlpha(UIColors.accentYellow, isDark ? '2E' : '33'),
    },
    emoji: {
      ...typography.body,
    },
    icon: {
      color: isDark ? UIColors.accentYellow : t.textSecondary,
    },
    badgeEditing: {
      backgroundColor: t.background,
    },
    tileText: {
      flex: 1,
      marginLeft: spacing.sm + spacing.xs / 2,
    },
    tileLabel: {
      ...typography.subhead,
      fontWeight: '600',
      color: t.text,
    },
    tileCount: {
      ...typography.footnote,
      color: t.textSecondary,
      marginTop: 2,
      fontVariant: ['tabular-nums'],
    },
    sectionLabel: {
      ...typography.footnote,
      fontWeight: '600',
      color: t.textSecondary,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
      marginLeft: spacing.xs,
    },
    editButton: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      minHeight: 44,
      justifyContent: 'center',
    },
    editText: {
      ...typography.button,
      fontWeight: '600',
      color: t.link,
    },
  });
};
