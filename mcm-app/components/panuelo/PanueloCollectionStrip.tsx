import React from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { PressableFeedback } from 'heroui-native';

import { PanueloItemArt } from '@/components/panuelo/PanueloItemArt';
import { MaterialIcons } from '@/components/ui/icons';
import { themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { isLargeText } from '@/hooks/useLargeText';
import { KIND_LABEL, type PanueloCollectionEntry } from '@/utils/panuelo';

type Props = {
  entries: PanueloCollectionEntry[];
  activeId: string | null;
  isDark: boolean;
  onSelect: (entry: PanueloCollectionEntry) => void;
  /** En pantalla ancha hay sitio: una rejilla en vez de una tira. */
  grid?: boolean;
};

const ART = 56;
const TILE = 84;
/** Hasta cuánto crece la casilla con la letra grande (×1,5 la de siempre). */
const MAX_TILE_GROWTH = 1.5;

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
  grid,
}: Props) {
  const t = themeColors(isDark);
  const { fontScale } = useWindowDimensions();
  // Con la letra grande los nombres no caben en 84 pt ni en dos líneas: la
  // casilla crece con la letra y el nombre sale entero. Con la letra normal,
  // igual que siempre.
  const large = isLargeText(fontScale);
  const tileWidth = large ? TILE * Math.min(fontScale, MAX_TILE_GROWTH) : TILE;
  const renderTile = (entry: PanueloCollectionEntry) => {
    const { item, owned, placed } = entry;
    const active = item.id === activeId;
    const kind = KIND_LABEL[item.kind].toLowerCase();
    return (
      <PressableFeedback
        key={item.id}
        onPress={() => onSelect(entry)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={
          owned
            ? `${item.name}, ${kind}${item.secret ? ', pieza secreta' : ''}, ${
                placed ? 'puesta en el pañuelo' : 'sin poner'
              }`
            : `Pieza sin conseguir, ${kind}`
        }
        accessibilityHint={
          owned ? 'Abre su ficha' : 'Abre su ficha y dice cómo conseguirla'
        }
        style={[
          styles.tile,
          { width: tileWidth },
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
          numberOfLines={large ? undefined : 2}
        >
          {owned ? item.name : '¿?'}
        </Text>
      </PressableFeedback>
    );
  };

  if (grid) {
    return (
      <ScrollView
        accessibilityLabel="Colección de piezas"
        style={styles.gridScroll}
        contentContainerStyle={[styles.content, styles.grid]}
      >
        {entries.map(renderTile)}
      </ScrollView>
    );
  }
  return (
    <FlatList
      accessibilityLabel="Colección de piezas"
      horizontal
      data={entries}
      keyExtractor={(e) => e.item.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      renderItem={({ item }) => renderTile(item)}
    />
  );
}

const BOXED = 20;

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  gridScroll: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tile: {
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
