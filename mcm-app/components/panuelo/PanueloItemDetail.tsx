import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';

import { PanueloItemArt } from '@/components/panuelo/PanueloItemArt';
import AppChip from '@/components/ui/AppChip';
import { MaterialIcons } from '@/components/ui/icons';
import colors, { themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import type { PanueloRarity } from '@/types/panuelo';
import {
  KIND_LABEL,
  RARITY_LABEL,
  formatOwnedDate,
  isTradeable,
  type PanueloCollectionEntry,
} from '@/utils/panuelo';

/** El color de cada rareza. `AppChip` se encarga de que se lea. */
const RARITY_COLOR: Record<PanueloRarity, string> = {
  comun: colors.info,
  especial: colors.purple,
  unica: colors.yellow,
};

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

export type PanueloDetailAction = {
  key: string;
  label: string;
  /** Si la etiqueta visible se queda corta («Girar»), lo que lee VoiceOver. */
  accessibilityLabel?: string;
  icon: IconName;
  onPress: () => void;
};

type Props = {
  entry: PanueloCollectionEntry;
  isDark: boolean;
  /** Recién conseguida: se dice. */
  isNew?: boolean;
  actions: PanueloDetailAction[];
  onClose: () => void;
};

const ART = 64;

/**
 * La ficha de una pieza: qué es, de dónde viene y cuándo se consiguió. Ocupa
 * el sitio de la colección bajo el pañuelo, no es un pop-up: arriba la pieza
 * sigue flotando en 3D y se puede seguir girando.
 */
export function PanueloItemDetail({
  entry,
  isDark,
  isNew,
  actions,
  onClose,
}: Props) {
  const t = themeColors(isDark);
  const { item, owned } = entry;
  const rarity = item.rarity ?? 'comun';

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <PanueloItemArt
          look={item.look}
          size={ART}
          silhouette={owned ? undefined : t.separator}
        />
        <View style={styles.headText}>
          <Text
            style={[styles.name, { color: t.text }]}
            numberOfLines={2}
            accessibilityRole="header"
          >
            {owned ? item.name : 'Todavía no la tienes'}
          </Text>
          <View style={styles.chips}>
            {isNew ? (
              <AppChip label="Nueva" color={colors.green} size="sm" />
            ) : null}
            <AppChip label={KIND_LABEL[item.kind]} color={t.icon} size="sm" />
            {isTradeable(item) ? (
              <AppChip
                label="Intercambiable"
                icon="swap-horiz"
                color={colors.info}
                size="sm"
              />
            ) : null}
            {rarity !== 'comun' ? (
              <AppChip
                label={RARITY_LABEL[rarity]}
                color={RARITY_COLOR[rarity]}
                size="sm"
              />
            ) : null}
          </View>
        </View>
        <PressableFeedback
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar la ficha"
          style={[styles.close, { backgroundColor: t.backgroundSunken }]}
        >
          <PressableFeedback.Highlight />
          <MaterialIcons name="close" size={20} color={t.icon} />
        </PressableFeedback>
      </View>

      {owned ? (
        <>
          {item.origin ? (
            <Text style={[styles.line, { color: t.text }]}>{item.origin}</Text>
          ) : null}
          {item.description ? (
            <Text style={[styles.line, { color: t.textSecondary }]}>
              {item.description}
            </Text>
          ) : null}
          <Text style={[styles.meta, { color: t.textSecondary }]}>
            Conseguida el {formatOwnedDate(owned.at)}
          </Text>
        </>
      ) : (
        <Text style={[styles.line, { color: t.textSecondary }]}>
          {item.grant?.type === 'code'
            ? 'Se consigue con un código que se enseña en la actividad.'
            : 'Se reparte a quienes participan en la actividad.'}
        </Text>
      )}

      {actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((action) => (
            <PressableFeedback
              key={action.key}
              onPress={action.onPress}
              accessibilityRole="button"
              accessibilityLabel={action.accessibilityLabel ?? action.label}
              style={[styles.action, { backgroundColor: t.backgroundSunken }]}
            >
              <PressableFeedback.Highlight />
              <MaterialIcons name={action.icon} size={18} color={t.link} />
              <Text style={[styles.actionLabel, { color: t.link }]}>
                {action.label}
              </Text>
            </PressableFeedback>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const CLOSE = 44;

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headText: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    ...typography.h3,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  close: {
    width: CLOSE,
    height: CLOSE,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  line: {
    ...typography.body,
  },
  meta: {
    ...typography.caption,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: CLOSE,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  actionLabel: {
    ...typography.button,
  },
});
