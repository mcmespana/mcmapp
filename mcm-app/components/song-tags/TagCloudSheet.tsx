/**
 * Hoja de etiquetas — a un toque desde el header del cantoral y desde la
 * propia pantalla de una etiqueta.
 *
 * Octubre de 2026: chips que fluyen en línea, como la nube original (así
 * caben varios por fila), pero sin bordes ni sombras: relleno suave, el
 * emoji si lo hay y el número en su propia pastilla. Antes los chips
 * variaban 1 pt de tamaño según el uso (no se notaba) y el recuento era un
 * gris casi invisible. Hubo un intento intermedio de rejilla de dos columnas
 * con «8 canciones» debajo: desperdiciaba el ancho y se descartó.
 *
 * «Editar» tiene dos modos:
 * - **Ocultar** las que no van contigo (p. ej. las de otra casa):
 *   desaparecen de aquí, de las candidatas para combinar y de la ficha de la
 *   canción. Las ocultas se ven al final, apagadas y con «+», para
 *   recuperarlas. Con «Esconder también sus canciones» (`hideHiddenTagSongs`)
 *   tampoco salen sus canciones en las categorías (siguen en el buscador).
 * - **A mano** (★, `featuredTags`): salen como atajo arriba del cantoral y,
 *   discretas, en las filas de las listas.
 */
import React, { useMemo, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import BottomSheet from '@/components/BottomSheet';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useHiddenTags } from '@/hooks/useHiddenTags';
import { useSettings } from '@/contexts/SettingsContext';
import SegmentedControl from '@/components/ui/SegmentedControl';
import type { ResolvedTag } from '@/utils/songTags';
import { SwipeColors, UIColors, themeColors } from '@/constants/colors';
import { hexAlpha, onColor } from '@/utils/colorUtils';
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
  const { settings, setSettings } = useSettings();
  const featured = settings.featuredTags;
  const [editing, setEditing] = useState(false);
  const [editMode, setEditMode] = useState<'hide' | 'feature'>('hide');
  const toggleFeatured = (slug: string) =>
    setSettings({
      featuredTags: featured.includes(slug)
        ? featured.filter((s) => s !== slug)
        : [...featured, slug],
    });

  // Cada apertura empieza fuera de edición.
  const [wasVisible, setWasVisible] = useState(visible);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    if (visible) setEditing(false);
  }

  const shown = tags.filter((t) => !hiddenSlugs.has(t.slug));
  const hiddenTags = tags.filter((t) => hiddenSlugs.has(t.slug));

  const subtitle = editing
    ? editMode === 'hide'
      ? 'Toca «−» para ocultar las que no van contigo, como las de otro carisma.'
      : 'Las de la ★ salen arriba del cantoral y, discretas, en las listas.'
    : shown.length === 0
      ? 'Has ocultado todas las etiquetas. Toca «Editar» para recuperarlas.'
      : null;

  const renderChip = (tag: ResolvedTag, isHidden: boolean) => {
    const isActive = activeSlugs.includes(tag.slug) && !editing;
    const countLabel = `${tag.count} ${tag.count === 1 ? 'canción' : 'canciones'}`;
    return (
      <PressableFeedback
        key={tag.slug}
        style={[
          styles.chip,
          isActive && styles.chipActive,
          isHidden && styles.chipHidden,
        ]}
        onPress={() => {
          if (editing) {
            h.toggle();
            if (editMode === 'feature') toggleFeatured(tag.slug);
            else toggleHidden(tag.slug);
            return;
          }
          h.select();
          onSelectTag(tag);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${tag.label}, ${countLabel}`}
        accessibilityHint={
          editing
            ? editMode === 'feature'
              ? featured.includes(tag.slug)
                ? 'Quitar de las etiquetas a mano'
                : 'Tener esta etiqueta a mano'
              : isHidden
                ? 'Volver a mostrar esta etiqueta'
                : 'Ocultar esta etiqueta'
            : undefined
        }
      >
        <PressableFeedback.Highlight />
        {tag.emoji ? <Text style={styles.emoji}>{tag.emoji}</Text> : null}
        <Text
          style={[styles.label, isActive && styles.labelActive]}
          numberOfLines={1}
        >
          {tag.label}
        </Text>
        {editing && editMode === 'feature' ? (
          <MaterialIcons
            name={featured.includes(tag.slug) ? 'star' : 'star-border'}
            size={20}
            color={
              featured.includes(tag.slug)
                ? UIColors.accentYellow
                : themeColors(isDark).textMuted
            }
            style={styles.star}
          />
        ) : editing ? (
          <View style={[styles.editMark, isHidden && styles.editMarkAdd]}>
            <MaterialIcons
              name={isHidden ? 'add' : 'remove'}
              size={14}
              color={isHidden ? onColor(themeColors(isDark).link) : '#FFFFFF'}
            />
          </View>
        ) : (
          <Text style={[styles.count, isActive && styles.countActive]}>
            {tag.count}
          </Text>
        )}
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
      {editing && (
        <SegmentedControl
          options={[
            { value: 'hide', label: 'Ocultar', icon: 'visibility-off' },
            { value: 'feature', label: 'A mano', icon: 'star' },
          ]}
          value={editMode}
          onChange={setEditMode}
          style={styles.modeSwitch}
          accessibilityLabel="Qué hacer con las etiquetas"
        />
      )}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {shown.map((t) => renderChip(t, false))}
        </View>
        {editing && editMode === 'hide' && hiddenTags.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Ocultas</Text>
            <View style={styles.grid}>
              {hiddenTags.map((t) => renderChip(t, true))}
            </View>
            <PressableFeedback
              style={styles.hideSongsRow}
              onPress={() => {
                h.toggle();
                setSettings({
                  hideHiddenTagSongs: !settings.hideHiddenTagSongs,
                });
              }}
              accessibilityRole="switch"
              accessibilityState={{ checked: settings.hideHiddenTagSongs }}
              accessibilityLabel="Esconder también sus canciones de las categorías"
            >
              <MaterialIcons
                name={
                  settings.hideHiddenTagSongs
                    ? 'check-box'
                    : 'check-box-outline-blank'
                }
                size={22}
                color={themeColors(isDark).link}
              />
              <Text style={styles.hideSongsText}>
                Esconder también sus canciones de las categorías (siguen en el
                buscador)
              </Text>
            </PressableFeedback>
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
      gap: spacing.sm,
    },
    // Chip que fluye en línea: ocupa lo que mide su nombre, así caben varios
    // por fila. Relleno suave, sin borde ni sombra; el número va en su
    // propia pastilla para que se lea como dato y no como parte del nombre.
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 44,
      paddingLeft: spacing.md - spacing.xs / 2,
      paddingRight: spacing.sm,
      borderRadius: radii.pillFull,
      backgroundColor: t.backgroundSunken,
      overflow: 'hidden',
    },
    chipActive: {
      backgroundColor: UIColors.accentYellow,
    },
    chipHidden: {
      opacity: 0.5,
    },
    emoji: {
      ...typography.subhead,
      marginRight: spacing.xs + 2,
    },
    label: {
      ...typography.subhead,
      fontWeight: '600',
      color: t.text,
      flexShrink: 1,
    },
    labelActive: {
      color: onColor(UIColors.accentYellow),
    },
    count: {
      ...typography.footnote,
      fontWeight: '600',
      color: t.textSecondary,
      backgroundColor: t.background,
      minWidth: 24,
      textAlign: 'center',
      paddingHorizontal: spacing.xs + 2,
      paddingVertical: 2,
      borderRadius: radii.pillFull,
      overflow: 'hidden',
      marginLeft: spacing.sm,
      fontVariant: ['tabular-nums'],
    },
    countActive: {
      backgroundColor: hexAlpha('#FFFFFF', isDark ? '59' : '80'),
      color: onColor(UIColors.accentYellow),
    },
    editMark: {
      width: 22,
      height: 22,
      borderRadius: radii.pillFull,
      marginLeft: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: SwipeColors.remove,
    },
    editMarkAdd: {
      backgroundColor: t.link,
    },
    sectionLabel: {
      ...typography.footnote,
      fontWeight: '600',
      color: t.textSecondary,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
      marginLeft: spacing.xs,
    },
    modeSwitch: {
      marginHorizontal: spacing.md,
      marginBottom: spacing.sm,
    },
    star: {
      marginLeft: spacing.sm,
    },
    hideSongsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: 44,
      marginTop: spacing.md,
    },
    hideSongsText: {
      ...typography.subhead,
      color: t.text,
      flex: 1,
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
