/**
 * «3 escondidas · Ver»: al lado del recuento de una categoría cuando las
 * canciones de las etiquetas ocultas no se muestran (`useSongListTags`).
 */
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { themeColors } from '@/constants/colors';
import typography from '@/constants/typography';
import { h } from '@/utils/haptics';

export default function HiddenSongsNote({
  count,
  onReveal,
}: {
  count: number;
  onReveal: () => void;
}) {
  const isDark = useColorScheme() === 'dark';
  if (count <= 0) return null;
  return (
    <PressableFeedback
      onPress={() => {
        h.tap();
        onReveal();
      }}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`Ver ${count} ${
        count === 1 ? 'canción escondida' : 'canciones escondidas'
      } por tus etiquetas`}
    >
      <Text style={[styles.note, { color: themeColors(isDark).link }]}>
        {count} escondida{count === 1 ? '' : 's'} · Ver
      </Text>
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  note: { ...typography.footnote, fontWeight: '600' },
});
