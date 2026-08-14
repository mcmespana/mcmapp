/**
 * Barra de contexto de una etiqueta — la única capa nueva sobre la lista.
 *
 * A la izquierda las etiquetas ACTIVAS (con ✕ para soltarlas) y detrás las
 * candidatas de refinamiento: las que COEXISTEN en el resultado actual, con su
 * recuento. Nunca se ofrece una etiqueta que daría cero resultados, así que no
 * hace falta modal de filtros, ni booleanos, ni checkboxes: se afina con el
 * pulgar y se deshace tocando la ✕.
 */
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import TagChip from '@/components/song-tags/TagChip';
import type { ResolvedTag } from '@/utils/songTags';

interface TagContextBarProps {
  activeTags: ResolvedTag[];
  candidates: ResolvedTag[];
  isDark: boolean;
  onAddTag: (tag: ResolvedTag) => void;
  onRemoveTag: (tag: ResolvedTag) => void;
}

export default function TagContextBar({
  activeTags,
  candidates,
  isDark,
  onAddTag,
  onRemoveTag,
}: TagContextBarProps) {
  const styles = useMemo(() => createStyles(isDark), [isDark]);

  return (
    <View style={styles.bar}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
      >
        {activeTags.map((tag) => (
          <TagChip
            key={`active-${tag.slug}`}
            tag={tag}
            variant="active"
            isDark={isDark}
            hideCount
            onRemove={onRemoveTag}
          />
        ))}
        {candidates.map((tag) => (
          <TagChip
            key={`cand-${tag.slug}`}
            tag={tag}
            variant="outline"
            isDark={isDark}
            onPress={onAddTag}
            accessibilityHint="Cruzar con esta etiqueta"
          />
        ))}
      </ScrollView>
    </View>
  );
}

const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    bar: {
      backgroundColor: isDark ? '#241F0E' : '#FFFBEC',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: isDark ? '#3B3320' : '#F2E3B0',
      paddingVertical: 10,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
    },
  });
