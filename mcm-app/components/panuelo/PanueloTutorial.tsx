import React, { useEffect, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { moveScreenReaderFocus } from '@/components/panuelo/PanueloItemDetail';
import { PanueloItemArt } from '@/components/panuelo/PanueloItemArt';
import AppPrimaryButton from '@/components/ui/AppPrimaryButton';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { MaterialIcons } from '@/components/ui/icons';
import { EXAMPLE_PANUELO_CATALOG } from '@/constants/panueloCatalog';
import {
  PANUELO_TUTORIAL,
  type PanueloTutorialSection,
} from '@/constants/panueloTutorial';
import { themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii, shadows } from '@/constants/uiStyles';
import type { PanueloCatalog } from '@/types/panuelo';
import { h } from '@/utils/haptics';

const TOUCH = 44;
const ART = 44;
/** Como `UIPageControl`: puntos de 7 pt, 9 pt entre ellos; el activo, alargado. */
const DOT = 8;
const DOT_ACTIVE = 20;
const DOT_GAP = spacing.sm;
/** Alto cómodo del botón principal (≥ 50 pt). */
const BUTTON_MIN = 54;
const ROW_ICON = 28;

/** Lo que ocupa el contenido del tutorial; el visor se queda con el resto. */
const CONTENT_SHARE = 0.55;

type Props = {
  isDark: boolean;
  /** Paso que se ve (índice en `sections`). */
  index: number;
  onIndex: (index: number) => void;
  /** «Empezar» en el último paso: el tutorial se da por visto. */
  onFinish: () => void;
  sections?: readonly PanueloTutorialSection[];
  /** De dónde salen las piezas de `example.art` (por defecto, las de ejemplo). */
  catalog?: PanueloCatalog;
  /** El botón en los pasos que no son el último. Por defecto, «Continuar». */
  nextLabel?: string;
  /** El botón en el último paso. Por defecto, «Empezar». */
  finishLabel?: string;
  /** Un enlace bajo el botón, solo en el último paso («Ahora no»). */
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** Lo que lee el lector en los puntos. Por defecto, «Paso 3 de 7». */
  pageLabel?: (index: number, count: number) => string;
  style?: StyleProp<ViewStyle>;
};

/**
 * El indicador estándar de páginas (`UIPageControl`): una fila de puntos
 * centrada, el de ahora alargado y el resto tenues. Es un control ajustable:
 * el lector de pantalla dice «Paso 3 de 7» y lo cambia con subir y bajar.
 */
export function PanueloPageDots({
  isDark,
  index,
  count,
  onIndex,
  label,
}: {
  isDark: boolean;
  index: number;
  count: number;
  onIndex: (index: number) => void;
  /** Por defecto, «Paso 3 de 7». */
  label?: string;
}) {
  const t = themeColors(isDark);
  return (
    <View
      style={styles.dots}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label ?? `Paso ${index + 1} de ${count}`}
      accessibilityValue={{ min: 1, max: count, now: index + 1 }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const next = e.nativeEvent.actionName === 'increment' ? 1 : -1;
        if (index + next >= 0 && index + next < count) onIndex(index + next);
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === index && styles.dotActive,
            { backgroundColor: i === index ? t.link : t.textMuted },
            i === index ? null : styles.dotDim,
          ]}
        />
      ))}
    </View>
  );
}

/**
 * El tutorial, a la manera de las hojas de introducción de Apple: páginas que
 * se deslizan siguiendo al dedo, una sola acción principal fija abajo
 * («Continuar» y, en el último, «Empezar») y el indicador de páginas justo
 * encima. Se vuelve atrás deslizando hacia la derecha.
 *
 * El pañuelo de ejemplo es el propio visor de la pantalla (un único contexto
 * 3D): cambia de estado cuando la página se asienta, no se desliza. El
 * contenido de cada página hace scroll si no cabe (pantallas bajas, letra
 * grande); el botón y los puntos quedan fijos.
 */
export function PanueloTutorial({
  isDark,
  index,
  onIndex,
  onFinish,
  sections = PANUELO_TUTORIAL,
  catalog = EXAMPLE_PANUELO_CATALOG,
  nextLabel = 'Continuar',
  finishLabel = 'Empezar',
  secondaryLabel,
  onSecondary,
  pageLabel,
  style,
}: Props) {
  const t = themeColors(isDark);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { width: windowWidth } = useWindowDimensions();
  const [width, setWidth] = useState(windowWidth);
  const pager = useRef<React.ComponentRef<typeof ScrollView>>(null);
  /** La página en la que se asentó el dedo (o a la que se ha ido). */
  const shown = useRef(0);
  const first = useRef(true);
  const titleRef = useRef<React.ComponentRef<typeof Text>>(null);
  const last = index === sections.length - 1;

  // «Continuar», los puntos o el chevron de arriba cambian `index`: el pager
  // va a esa página (sin animar con «reducir movimiento»). Si el cambio vino
  // del dedo, ya está allí.
  useEffect(() => {
    if (shown.current === index) return;
    shown.current = index;
    pager.current?.scrollTo({ x: index * width, animated: !reducedMotion });
  }, [index, width, reducedMotion]);

  // Un toque suave al cambiar de página, y el lector lee el título nuevo.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    h.select();
    moveScreenReaderFocus(titleRef.current);
  }, [index]);

  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.width);
    if (next > 0 && next !== width) {
      setWidth(next);
      pager.current?.scrollTo({ x: shown.current * next, animated: false });
    }
  };
  const onSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / width);
    const clamped = Math.max(0, Math.min(sections.length - 1, page));
    shown.current = clamped;
    if (clamped !== index) onIndex(clamped);
  };

  return (
    <View style={[styles.root, style]} onLayout={onLayout}>
      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onSettle}
        style={styles.pager}
      >
        {sections.map((section, i) => (
          <TutorialPage
            key={section.id}
            section={section}
            catalog={catalog}
            isDark={isDark}
            width={width}
            current={i === index}
            titleRef={i === index ? titleRef : undefined}
            onPrevious={i > 0 ? () => onIndex(i - 1) : undefined}
          />
        ))}
      </ScrollView>
      <View
        style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}
      >
        <PanueloPageDots
          isDark={isDark}
          index={index}
          count={sections.length}
          onIndex={onIndex}
          label={pageLabel?.(index, sections.length)}
        />
        <AppPrimaryButton
          label={last ? finishLabel : nextLabel}
          color={t.link}
          haptic={false}
          style={styles.button}
          onPress={() => {
            if (last) {
              h.success();
              onFinish();
            } else {
              onIndex(index + 1);
            }
          }}
        />
        {last && secondaryLabel && onSecondary ? (
          <PressableFeedback
            onPress={() => {
              h.tap();
              onSecondary();
            }}
            accessibilityRole="button"
            accessibilityLabel={secondaryLabel}
            style={styles.secondary}
          >
            <PressableFeedback.Highlight />
            <Text style={[styles.secondaryText, { color: t.link }]}>
              {secondaryLabel}
            </Text>
          </PressableFeedback>
        ) : null}
      </View>
    </View>
  );
}

type PanelProps = Omit<Props, 'style'> & {
  /** Pantalla ancha: columna lateral de este ancho, en vez de la mitad de abajo. */
  sideWidth?: number;
};

/**
 * El sitio del tutorial en la pantalla: ~45 % visor, ~55 % contenido (con
 * `useWindowDimensions`); en ancho, la columna lateral. El contenido se apoya
 * en el fondo, sin tarjeta flotando, con la esquina de arriba redondeada para
 * separarlo del visor.
 */
export function PanueloTutorialPanel({ sideWidth, ...props }: PanelProps) {
  const { height } = useWindowDimensions();
  const t = themeColors(props.isDark);
  return (
    <View
      style={[
        sideWidth ? { width: sideWidth } : styles.panelTop,
        sideWidth ? null : { height: height * CONTENT_SHARE },
        { backgroundColor: t.card },
      ]}
    >
      <PanueloTutorial {...props} />
    </View>
  );
}

function TutorialPage({
  section,
  catalog,
  isDark,
  width,
  current,
  titleRef,
  onPrevious,
}: {
  section: PanueloTutorialSection;
  catalog: PanueloCatalog;
  isDark: boolean;
  width: number;
  current: boolean;
  titleRef?: React.Ref<React.ComponentRef<typeof Text>>;
  onPrevious?: () => void;
}) {
  const t = themeColors(isDark);
  const art = (section.example?.art ?? [])
    .map((id) => catalog[id])
    .filter(Boolean);
  return (
    // Las páginas que no se ven no existen para el lector de pantalla.
    <View
      style={{ width }}
      accessibilityElementsHidden={!current}
      importantForAccessibility={current ? 'auto' : 'no-hide-descendants'}
    >
      <ScrollView
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
      >
        <Text
          ref={titleRef}
          style={[styles.title, { color: t.text }]}
          accessibilityRole="header"
          // Volver atrás sin gesto: una acción del título.
          accessibilityActions={
            onPrevious ? [{ name: 'previous', label: 'Paso anterior' }] : []
          }
          onAccessibilityAction={() => onPrevious?.()}
        >
          {section.title}
        </Text>
        <Text style={[styles.body, { color: t.text }]}>{section.body}</Text>
        {section.steps ? (
          <View style={styles.list}>
            {section.steps.map((text, i) => (
              <View key={text} style={styles.row}>
                <View style={[styles.number, { backgroundColor: t.link }]}>
                  <Text
                    style={[
                      styles.numberText,
                      { color: isDark ? t.background : t.card },
                    ]}
                  >
                    {i + 1}
                  </Text>
                </View>
                <Text style={[styles.rowText, { color: t.text }]}>{text}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {section.rows ? (
          <View style={styles.list}>
            {section.rows.map((row) => (
              <View key={row.title} style={styles.row}>
                <MaterialIcons name={row.icon} size={ROW_ICON} color={t.link} />
                <View style={styles.rowTexts}>
                  <Text style={[styles.rowTitle, { color: t.text }]}>
                    {row.title}
                  </Text>
                  {row.text ? (
                    <Text style={[styles.rowText, { color: t.textSecondary }]}>
                      {row.text}
                    </Text>
                  ) : null}
                </View>
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
      </ScrollView>
    </View>
  );
}

type HeaderProps = {
  isDark: boolean;
  /** Por defecto, «Tu pañuelo». */
  title?: string;
  onClose: () => void;
  /** Lo que lee el lector en la X. Por defecto, «Cerrar el tutorial». */
  closeLabel?: string;
  /** A partir del segundo paso: el chevron de «Paso anterior». */
  onBack?: () => void;
};

/**
 * La cabecera del tutorial a pantalla completa: la cabecera nativa se oculta
 * mientras dura y esta lleva el título, la X de salir (≥ 44 pt) y, desde el
 * segundo paso, un chevron discreto para volver atrás; por debajo de la barra
 * de estado y del notch.
 */
export function PanueloTutorialHeader({
  isDark,
  title = 'Tu pañuelo',
  onClose,
  closeLabel = 'Cerrar el tutorial',
  onBack,
}: HeaderProps) {
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
      {onBack ? (
        <PressableFeedback
          onPress={() => {
            h.tap();
            onBack();
          }}
          accessibilityRole="button"
          accessibilityLabel="Paso anterior"
          style={[styles.round, { backgroundColor: t.card }]}
        >
          <PressableFeedback.Highlight />
          <IconSymbol name="chevron.left" size={20} color={t.link} />
        </PressableFeedback>
      ) : null}
      <Text
        style={[styles.headerTitle, { color: t.text }]}
        accessibilityRole="header"
      >
        {title}
      </Text>
      <PressableFeedback
        onPress={() => {
          h.tap();
          onClose();
        }}
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
        style={[styles.round, { backgroundColor: t.card }]}
      >
        <PressableFeedback.Highlight />
        <IconSymbol name="xmark" size={20} color={t.link} />
      </PressableFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  panelTop: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    ...typography.h2,
    flex: 1,
  },
  round: {
    width: TOUCH,
    height: TOUCH,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadows.card,
  },
  root: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
  page: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  title: {
    ...typography.h1,
  },
  body: {
    ...typography.body,
  },
  list: {
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  rowTexts: {
    flex: 1,
  },
  rowTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  rowText: {
    ...typography.body,
    flex: 1,
  },
  number: {
    width: ROW_ICON,
    height: ROW_ICON,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    ...typography.button,
    fontWeight: '700',
  },
  art: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: DOT_GAP,
    minHeight: spacing.lg,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: radii.pillFull,
  },
  dotActive: {
    width: DOT_ACTIVE,
  },
  dotDim: {
    opacity: 0.35,
  },
  button: {
    minHeight: BUTTON_MIN,
  },
  secondary: {
    minHeight: TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    overflow: 'hidden',
    marginTop: -spacing.sm,
  },
  secondaryText: {
    ...typography.button,
  },
});
