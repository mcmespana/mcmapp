import React, { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PressableFeedback } from 'heroui-native';

import { PanueloItemArt } from '@/components/panuelo/PanueloItemArt';
import AppChip from '@/components/ui/AppChip';
import { MaterialIcons } from '@/components/ui/icons';
import colors, { themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import useLargeText from '@/hooks/useLargeText';
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

/**
 * Mover una pieza arrastrándola en el 3D no tiene equivalente táctil para el
 * lector de pantalla: estas acciones personalizadas (VoiceOver, TalkBack,
 * Control por voz y Acceso con interruptor las ofrecen sin pintar nada) la
 * mueven por pasos. `v` va del cuello (0) al pico (1) y `u` de izquierda a
 * derecha del triángulo.
 */
export const MOVE_STEP = 0.1;
const MOVE_ACTIONS = [
  { name: 'moveLeft', label: 'Mover a la izquierda', du: -MOVE_STEP, dv: 0 },
  { name: 'moveRight', label: 'Mover a la derecha', du: MOVE_STEP, dv: 0 },
  { name: 'moveNeck', label: 'Mover hacia el cuello', du: 0, dv: -MOVE_STEP },
  { name: 'moveTip', label: 'Mover hacia el pico', du: 0, dv: MOVE_STEP },
] as const;

/**
 * Lleva el foco del lector de pantalla a un elemento (al abrirse o cerrarse
 * la ficha el elemento enfocado desaparece y el foco se pierde). Sin lector
 * de pantalla no hace nada.
 */
export function moveScreenReaderFocus(node: unknown) {
  if (!node) return;
  try {
    const handle = findNodeHandle(node as React.Component);
    if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
  } catch {
    // Sin soporte en esta plataforma: el foco se queda donde estaba.
  }
}

type Props = {
  entry: PanueloCollectionEntry;
  isDark: boolean;
  /** Recién conseguida: se dice. */
  isNew?: boolean;
  actions: PanueloDetailAction[];
  /** Si se pasa, la pieza se puede mover por pasos desde el lector de pantalla. */
  onMove?: (id: string, du: number, dv: number) => void;
  /**
   * Sustituye a «Conseguida el…»: en un pañuelo anterior lo que importa es
   * que la pieza se llevaba, no cuándo se consiguió.
   */
  note?: string;
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
  onMove,
  note,
  onClose,
}: Props) {
  const t = themeColors(isDark);
  const large = useLargeText();
  const { item, owned } = entry;
  const rarity = item.rarity ?? 'comun';
  const titleRef = useRef<React.ComponentRef<typeof Text>>(null);

  // La pieza recién conseguida se anuncia (aparece sola, sin que nadie la
  // toque, y el lector no se enteraría). Si la ficha la abre la persona, el
  // foco va al título.
  useEffect(() => {
    if (isNew && owned) {
      AccessibilityInfo.announceForAccessibility(
        `Pieza nueva: ${item.name}. ${KIND_LABEL[item.kind]}.`,
      );
    } else {
      moveScreenReaderFocus(titleRef.current);
    }
    // Solo al cambiar de pieza (o al pasar a ser nueva), no en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, isNew]);

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
            ref={titleRef}
            style={[styles.name, { color: t.text }]}
            numberOfLines={large ? undefined : 2}
            accessibilityRole="header"
            accessibilityHint={
              onMove ? 'Tiene acciones para moverla por el pañuelo.' : undefined
            }
            accessibilityActions={
              onMove
                ? MOVE_ACTIONS.map(({ name, label }) => ({ name, label }))
                : undefined
            }
            onAccessibilityAction={
              onMove
                ? (e) => {
                    const move = MOVE_ACTIONS.find(
                      (a) => a.name === e.nativeEvent.actionName,
                    );
                    if (move) onMove(item.id, move.du, move.dv);
                  }
                : undefined
            }
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
            {note ?? `Conseguida el ${formatOwnedDate(owned.at)}`}
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
