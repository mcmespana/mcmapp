/**
 * Fila de refinamiento de una etiqueta — va DENTRO de la lista, como cabecera.
 *
 * Hasta octubre de 2026 era una barra amarilla fija encima de la lista. En iOS
 * el header es transparente y la lista lo compensa con
 * `contentInsetAdjustmentBehavior`, pero una `View` hermana de la lista no:
 * la barra se pintaba debajo de la barra de estado, con el chip de la etiqueta
 * encima del reloj. Como cabecera de la lista hereda el inset y además se va
 * con el scroll, que es lo que se espera de algo que se usa una vez.
 *
 * Qué enseña:
 * - Las etiquetas ACTIVAS solo cuando hay más de una: con una sola, el título
 *   de la pantalla ya lo dice y soltarla es lo mismo que el botón de atrás.
 * - Las candidatas: las que COEXISTEN en el resultado actual, con su recuento.
 *   Nunca se ofrece una que daría cero resultados, así que no hace falta modal
 *   de filtros: se afina con el pulgar y se deshace con la ✕.
 */
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import TagChip from '@/components/song-tags/TagChip';
import type { ResolvedTag } from '@/utils/songTags';
import { themeColors } from '@/constants/colors';
import typography from '@/constants/typography';
import spacing from '@/constants/spacing';

interface TagContextBarProps {
  activeTags: ResolvedTag[];
  candidates: ResolvedTag[];
  isDark: boolean;
  onAddTag: (tag: ResolvedTag) => void;
  onRemoveTag: (tag: ResolvedTag) => void;
  /**
   * Margen lateral de la lista que la contiene. El carrusel lo anula para
   * llegar de borde a borde y lo devuelve como padding, así el primer chip
   * queda alineado con el resto del contenido.
   */
  edgeInset: number;
}

export default function TagContextBar({
  activeTags,
  candidates,
  isDark,
  onAddTag,
  onRemoveTag,
  edgeInset,
}: TagContextBarProps) {
  const styles = useMemo(
    () => createStyles(isDark, edgeInset),
    [isDark, edgeInset],
  );
  const showActive = activeTags.length > 1;
  if (!showActive && candidates.length === 0) return null;

  return (
    <View style={styles.bar}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
      >
        {showActive &&
          activeTags.map((tag) => (
            <TagChip
              key={`active-${tag.slug}`}
              tag={tag}
              variant="active"
              isDark={isDark}
              hideCount
              onRemove={onRemoveTag}
            />
          ))}
        {candidates.length > 0 && (
          <Text style={styles.label}>
            {showActive ? 'y además' : 'Combinar con'}
          </Text>
        )}
        {candidates.map((tag) => (
          <TagChip
            key={`cand-${tag.slug}`}
            tag={tag}
            variant="outline"
            isDark={isDark}
            showAdd
            onPress={onAddTag}
            accessibilityHint="Ver solo las canciones que también tienen esta etiqueta"
          />
        ))}
      </ScrollView>
    </View>
  );
}

const createStyles = (isDark: boolean, edgeInset: number) =>
  StyleSheet.create({
    bar: {
      marginHorizontal: -edgeInset,
      paddingTop: spacing.sm + spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: edgeInset + spacing.xs,
    },
    label: {
      ...typography.caption,
      color: themeColors(isDark).textSecondary,
      marginRight: spacing.xs / 2,
    },
  });
