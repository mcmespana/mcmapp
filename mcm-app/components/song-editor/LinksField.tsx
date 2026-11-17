/** Lista editable de enlaces (nombre + dirección) del editor de canciones. */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import AppTextField from '@/components/ui/AppTextField';
import { MaterialIcons } from '@/components/ui/icons';
import { SwipeColors, themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { useColorScheme } from '@/hooks/useColorScheme';
import { h } from '@/utils/haptics';
import type { MediaLink } from '@/utils/songEditor';

export default function LinksField({
  title,
  links,
  onChange,
}: {
  title: string;
  links: MediaLink[];
  onChange: (links: MediaLink[]) => void;
}) {
  const theme = themeColors(useColorScheme() === 'dark');
  const edit = (i: number, patch: Partial<MediaLink>) =>
    onChange(links.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>
        {title}
      </Text>
      {links.map((l, i) => (
        <View key={i} style={styles.linkRow}>
          <View style={styles.linkFields}>
            <AppTextField
              value={l.label}
              onChangeText={(v) => edit(i, { label: v })}
              placeholder="Nombre"
              accentColor={theme.link}
            />
            <AppTextField
              value={l.url}
              onChangeText={(v) => edit(i, { url: v })}
              placeholder="https://…"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              accentColor={theme.link}
            />
          </View>
          <PressableFeedback
            onPress={() => onChange(links.filter((_, j) => j !== i))}
            style={styles.barBtn}
            accessibilityRole="button"
            accessibilityLabel={`Quitar ${l.label || 'enlace'}`}
          >
            <MaterialIcons
              name="remove-circle-outline"
              size={22}
              color={SwipeColors.remove}
            />
          </PressableFeedback>
        </View>
      ))}
      <PressableFeedback
        onPress={() => {
          h.tap();
          onChange([...links, { label: '', url: '' }]);
        }}
        style={[styles.add, { backgroundColor: theme.backgroundSunken }]}
        accessibilityRole="button"
        accessibilityLabel={`Añadir enlace a ${title}`}
      >
        <MaterialIcons name="add" size={16} color={theme.link} />
        <Text style={[styles.addText, { color: theme.link }]}>Enlace</Text>
      </PressableFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: { ...typography.caption, fontWeight: '600' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  linkFields: { flex: 1, gap: spacing.xs },
  barBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.md - spacing.xs,
    borderRadius: radii.xl,
    alignSelf: 'flex-start',
  },
  addText: { ...typography.caption, fontWeight: '600' },
});
