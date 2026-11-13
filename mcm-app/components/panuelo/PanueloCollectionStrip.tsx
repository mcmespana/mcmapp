import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';

import { PanueloItemArt } from '@/components/panuelo/PanueloItemArt';
import { MaterialIcons } from '@/components/ui/icons';
import { themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import type { PanueloCollectionEntry } from '@/utils/panuelo';

type Props = {
  entries: PanueloCollectionEntry[];
  activeId: string | null;
  isDark: boolean;
  onSelect: (entry: PanueloCollectionEntry) => void;
};

const ART = 56;
const TILE = 84;

/**
 * La colección, en una tira horizontal bajo el pañuelo: primero lo que se
 * tiene y después, en silueta, lo que falta. Una pieza que se tiene pero no
 * se lleva puesta sale con un punto: «está en la caja».
 */
export function PanueloCollectionStrip({
  entries,
  activeId,
  isDark,
  onSelect,
}: Props) {
  const t = themeColors(isDark);
  return (
    <FlatList
      horizontal
      data={entries}
      keyExtractor={(e) => e.item.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      renderItem={({ item: entry }) => {
        const { item, owned, placed } = entry;
        const active = item.id === activeId;
        return (
          <PressableFeedback
            onPress={() => onSelect(entry)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={
              owned
                ? `${item.name}${placed ? ', puesta en el pañuelo' : ', sin poner'}`
                : 'Pieza que todavía no tienes'
            }
            style={[
              styles.tile,
              active && { backgroundColor: t.backgroundSunken },
            ]}
          >
            <PressableFeedback.Highlight />
            <View>
              <PanueloItemArt
                look={item.look}
                size={ART}
                silhouette={owned ? undefined : t.separator}
              />
              {owned && !placed ? (
                <View
                  style={[
                    styles.boxed,
                    { backgroundColor: t.card, borderColor: t.separator },
                  ]}
                >
                  <MaterialIcons
                    name="inventory-2"
                    size={12}
                    color={t.textSecondary}
                  />
                </View>
              ) : null}
            </View>
            <Text
              style={[styles.name, { color: owned ? t.text : t.textMuted }]}
              numberOfLines={2}
            >
              {owned ? item.name : '¿?'}
            </Text>
          </PressableFeedback>
        );
      }}
    />
  );
}

const BOXED = 20;

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  tile: {
    width: TILE,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  name: {
    ...typography.caption,
    textAlign: 'center',
  },
  boxed: {
    position: 'absolute',
    right: -spacing.xs,
    bottom: -spacing.xs,
    width: BOXED,
    height: BOXED,
    borderRadius: radii.pillFull,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
