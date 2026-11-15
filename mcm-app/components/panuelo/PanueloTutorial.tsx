import React, { useEffect, useRef } from 'react';
import {
  type GestureResponderEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PressableFeedback } from 'heroui-native';

import { moveScreenReaderFocus } from '@/components/panuelo/PanueloItemDetail';
import { PanueloItemArt } from '@/components/panuelo/PanueloItemArt';
import AppPrimaryButton from '@/components/ui/AppPrimaryButton';
import {
  PANUELO_TUTORIAL,
  type PanueloTutorialSection,
} from '@/constants/panueloTutorial';
import { DEFAULT_PANUELO_CATALOG } from '@/constants/panueloCatalog';
import { themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { h } from '@/utils/haptics';

const TOUCH = 44;
const ART = 44;
const DOT = 8;
/** Lo que hay que arrastrar el dedo para pasar de sección. */
const SWIPE = 48;

type Props = {
  isDark: boolean;
  /** Sección que se ve (índice en `sections`). */
  index: number;
  onIndex: (index: number) => void;
  /** «Saltar» y «Entendido»: el tutorial se da por visto. */
  onFinish: () => void;
  sections?: readonly PanueloTutorialSection[];
};

/**
 * El tutorial, por secciones, en el sitio de la colección (bajo el visor). El
 * pañuelo de ejemplo es el propio visor de la pantalla con otro estado: un
 * único contexto 3D, y se puede girar. Aquí van el texto, el indicador de
 * página y, si la sección lo pide, las piezas dibujadas en plano.
 *
 * Se pasa de sección con «Siguiente» / «Atrás» o deslizando.
 */
export function PanueloTutorial({
  isDark,
  index,
  onIndex,
  onFinish,
  sections = PANUELO_TUTORIAL,
}: Props) {
  const t = themeColors(isDark);
  const section = sections[index];
  const last = index === sections.length - 1;
  const titleRef = useRef<React.ComponentRef<typeof Text>>(null);
  const startX = useRef<number | null>(null);

  // Al cambiar de sección el lector de pantalla lee la nueva.
  useEffect(() => {
    moveScreenReaderFocus(titleRef.current);
  }, [index]);

  if (!section) return null;

  const go = (next: number) => {
    if (next < 0 || next >= sections.length) return;
    h.select();
    onIndex(next);
  };
  const onTouchEnd = (e: GestureResponderEvent) => {
    const from = startX.current;
    startX.current = null;
    if (from === null) return;
    const dx = e.nativeEvent.pageX - from;
    if (Math.abs(dx) < SWIPE) return;
    go(index + (dx < 0 ? 1 : -1));
  };

  const art = (section.example?.art ?? [])
    .map((id) => DEFAULT_PANUELO_CATALOG[id])
    .filter(Boolean);

  return (
    <View
      style={styles.root}
      onTouchStart={(e) => {
        startX.current = e.nativeEvent.pageX;
      }}
      onTouchEnd={onTouchEnd}
    >
      <View
        style={styles.dots}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Tutorial, paso ${index + 1} de ${sections.length}`}
      >
        {sections.map((s, i) => (
          <View
            key={s.id}
            style={[
              styles.dot,
              { backgroundColor: i === index ? t.link : t.separator },
            ]}
          />
        ))}
      </View>
      <Text
        ref={titleRef}
        style={[styles.title, { color: t.text }]}
        accessibilityRole="header"
      >
        {section.title}
      </Text>
      <Text style={[styles.body, { color: t.text }]}>{section.body}</Text>
      {art.length > 0 ? (
        <View
          style={styles.art}
          accessible
          accessibilityLabel={`Ejemplos: ${art.map((a) => a.name).join(', ')}`}
        >
          {art.map((item) => (
            <PanueloItemArt key={item.id} look={item.look} size={ART} />
          ))}
        </View>
      ) : null}
      <View style={styles.actions}>
        {index > 0 ? (
          <PressableFeedback
            onPress={() => go(index - 1)}
            accessibilityRole="button"
            accessibilityLabel="Atrás"
            style={styles.link}
          >
            <Text style={[styles.linkLabel, { color: t.link }]}>Atrás</Text>
          </PressableFeedback>
        ) : null}
        {last ? null : (
          <PressableFeedback
            onPress={() => {
              h.tap();
              onFinish();
            }}
            accessibilityRole="button"
            accessibilityLabel="Saltar el tutorial"
            style={styles.link}
          >
            <Text style={[styles.linkLabel, { color: t.link }]}>Saltar</Text>
          </PressableFeedback>
        )}
        <View style={styles.primary}>
          <AppPrimaryButton
            label={last ? 'Entendido' : 'Siguiente'}
            onPress={() => (last ? onFinish() : go(index + 1))}
            haptic={!last}
            color={t.link}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: spacing.md,
    alignItems: 'center',
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: radii.pillFull,
  },
  title: {
    ...typography.h3,
  },
  body: {
    ...typography.body,
  },
  art: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  link: {
    minHeight: TOUCH,
    minWidth: TOUCH,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  linkLabel: {
    ...typography.button,
  },
  primary: {
    flex: 1,
  },
});
