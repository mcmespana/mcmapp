/**
 * Hoja de etiquetas — la nube completa, a un toque desde el header del
 * cantoral y desde la propia pantalla de una etiqueta.
 *
 * Orden por uso y punto: sin conmutador A–Z. Una etiqueta se reconoce por el
 * nombre, y quien busca un nombre concreto tiene el buscador. El tamaño del
 * chip cuenta el uso (3 tramos, 1 pt de salto entre tramos): las etiquetas
 * gordas son las vivas.
 */
import React, { useMemo } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text } from 'react-native';
import BottomSheet from '@/components/BottomSheet';
import TagChip from '@/components/song-tags/TagChip';
import { useColorScheme } from '@/hooks/useColorScheme';
import { tagCloudBucket, type ResolvedTag } from '@/utils/songTags';
import { themeColors } from '@/constants/colors';

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

/** Salto de tamaño entre tramos de la nube, en puntos. */
const SIZE_STEP = 1;
const BASE_SIZE = 14.5;

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

  const sized = useMemo(() => {
    if (tags.length === 0) return [];
    const counts = tags.map((t) => t.count);
    const max = Math.max(...counts);
    const min = Math.min(...counts);
    return tags.map((tag) => ({
      tag,
      fontSize: BASE_SIZE + tagCloudBucket(tag.count, min, max) * SIZE_STEP,
    }));
  }, [tags]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onCloseComplete={onCloseComplete}
      title="Etiquetas"
      paddingHorizontal={0}
    >
      <Text style={styles.subtitle}>
        {tags.length} {tags.length === 1 ? 'etiqueta' : 'etiquetas'}, de más a
        menos usadas
      </Text>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.cloud}
        showsVerticalScrollIndicator={false}
      >
        {sized.map(({ tag, fontSize }) => (
          <TagChip
            key={tag.slug}
            tag={tag}
            variant={activeSlugs.includes(tag.slug) ? 'active' : 'cloud'}
            isDark={isDark}
            fontSize={fontSize}
            onPress={onSelectTag}
            accessibilityHint={`${tag.count} ${
              tag.count === 1 ? 'canción' : 'canciones'
            }`}
          />
        ))}
      </ScrollView>
    </BottomSheet>
  );
}

const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    subtitle: {
      fontSize: 13,
      color: themeColors(isDark).textMuted,
      paddingHorizontal: 18,
      paddingBottom: 16,
    },
    scroll: {
      // La hoja se ajusta al contenido; con muchas etiquetas la nube scrollea
      // dentro en vez de empujar la hoja fuera de pantalla.
      maxHeight: Dimensions.get('window').height * 0.62,
    },
    cloud: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      rowGap: 14,
      paddingHorizontal: 18,
      paddingBottom: 28,
    },
  });
