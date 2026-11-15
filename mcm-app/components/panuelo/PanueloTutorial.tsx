import React, { useEffect, useRef } from 'react';
import {
  type GestureResponderEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { moveScreenReaderFocus } from '@/components/panuelo/PanueloItemDetail';
import { PanueloItemArt } from '@/components/panuelo/PanueloItemArt';
import AppPrimaryButton from '@/components/ui/AppPrimaryButton';
import { IconSymbol } from '@/components/ui/IconSymbol';
import {
  PANUELO_TUTORIAL,
  type PanueloTutorialSection,
} from '@/constants/panueloTutorial';
import { DEFAULT_PANUELO_CATALOG } from '@/constants/panueloCatalog';
import { themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii, shadows } from '@/constants/uiStyles';
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
      {section.steps ? (
        <View style={styles.steps}>
          {section.steps.map((text, i) => (
            <View key={text} style={styles.step}>
              <Text style={[styles.stepNumber, { color: t.link }]}>
                {i + 1}.
              </Text>
              <Text style={[styles.stepText, { color: t.text }]}>{text}</Text>
            </View>
          ))}
        </View>
      ) : null}
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

type HeaderProps = {
  isDark: boolean;
  onClose: () => void;
};

/**
 * La cabecera del tutorial a pantalla completa: la cabecera nativa se oculta
 * mientras dura y esta lleva el título y la X de salir (≥ 44 pt), por debajo
 * de la barra de estado y del notch.
 */
export function PanueloTutorialHeader({ isDark, onClose }: HeaderProps) {
  const t = themeColors(isDark);
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top + spacing.sm,
          paddingLeft: Math.max(spacing.md, insets.left),
          paddingRight: Math.max(spacing.md, insets.right),
        },
      ]}
      pointerEvents="box-none"
    >
      <Text
        style={[styles.headerTitle, { color: t.text }]}
        accessibilityRole="header"
      >
        Tu pañuelo
      </Text>
      <PressableFeedback
        onPress={() => {
          h.tap();
          onClose();
        }}
        accessibilityRole="button"
        accessibilityLabel="Cerrar el tutorial"
        style={[styles.close, { backgroundColor: t.card }]}
      >
        <PressableFeedback.Highlight />
        <IconSymbol name="xmark" size={20} color={t.link} />
      </PressableFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    ...typography.h2,
    flexShrink: 1,
  },
  close: {
    width: TOUCH,
    height: TOUCH,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadows.card,
  },
  steps: {
    gap: spacing.xs,
  },
  step: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stepNumber: {
    ...typography.body,
    fontWeight: '700',
    minWidth: spacing.md,
  },
  stepText: {
    ...typography.body,
    flex: 1,
  },
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
