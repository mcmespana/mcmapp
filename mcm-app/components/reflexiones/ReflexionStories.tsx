/**
 * Las reflexiones como historias: a pantalla completa, cada una sobre su
 * color, pasando solas. Es la forma de LEER el muro (una a una, en grande, sin
 * prisa) y la de proyectarlo en una pantalla durante el encuentro.
 *
 *   · tocar a la derecha → siguiente; a la izquierda → anterior;
 *   · mantener pulsado → pausa;
 *   · al final, «¿Y tú?»: la invitación a escribir la tuya.
 *
 * Cada una se puede copiar o sacar como imagen de historia
 * (`utils/reflexionCard.ts`). Con el lector de pantalla activo no avanza sola.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@/components/ui/icons';
import PressableScale from '@/components/ui/PressableScale';
import ShareCardView, {
  type ShareCardHandle,
} from '@/components/contigo/ShareCardView';
import { AuthorAvatar } from '@/components/reflexiones/Avatars';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { durations } from '@/constants/animations';
import { CHROME_MAX_FONT_SCALE } from '@/hooks/useLargeText';
import { useEscapeToClose } from '@/hooks/useEscapeToClose';
import { hexAlpha, onColor } from '@/utils/colorUtils';
import { h } from '@/utils/haptics';
import { shareText } from '@/utils/shareText';
import { reflexionCardSpec } from '@/utils/reflexionCard';
import {
  splitAuthor,
  storyDurationMs,
  toneColor,
  type Reflexion,
  type ReflexionTone,
} from '@/utils/reflexiones';

/** Con más historias que esto, una sola barra y un contador. */
const MAX_SEGMENTS = 24;
/** Cuánto dura el aviso de «Copiada». */
const FLASH_MS = 1600;

export interface StoryItem {
  r: Reflexion;
  author: string;
  tone: ReflexionTone;
  /** «hoy · hace 5 min», «ayer»… */
  when: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  items: StoryItem[];
  startIndex: number;
  eventTitle: string;
  tint: string;
  onCompose: () => void;
}

export default function ReflexionStories({
  visible,
  onClose,
  items,
  startIndex,
  eventTitle,
  tint,
  onCompose,
}: Props) {
  const insets = useSafeAreaInsets();
  useEscapeToClose(visible, onClose);
  const [index, setIndex] = useState(startIndex);
  const [paused, setPaused] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [screenReader, setScreenReader] = useState(false);
  const shareRef = useRef<ShareCardHandle>(null);

  // Al abrir, desde la que se tocó.
  const [lastOpen, setLastOpen] = useState({ visible, startIndex });
  if (lastOpen.visible !== visible || lastOpen.startIndex !== startIndex) {
    setLastOpen({ visible, startIndex });
    if (visible) {
      setIndex(startIndex);
      setPaused(false);
    }
  }

  useEffect(() => {
    // En web no se pregunta: react-native-web contesta SIEMPRE `true`, y las
    // historias no avanzaban nunca.
    if (!visible || Platform.OS === 'web') return;
    AccessibilityInfo.isScreenReaderEnabled()
      .then(setScreenReader)
      .catch(() => {});
  }, [visible]);

  const atEnd = index >= items.length;
  const item = atEnd ? null : items[index];
  const fill = item ? toneColor(item.tone) : tint;
  const ink = onColor(fill);

  const next = useCallback(() => {
    setIndex((i) => Math.min(i + 1, items.length));
  }, [items.length]);
  const prev = useCallback(() => {
    setIndex((i) => Math.max(i - 1, 0));
  }, []);

  // ── El reloj de cada historia ──
  const progress = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const total = item ? storyDurationMs(item.r.contenido) : 0;
  const autoplay = visible && !atEnd && !screenReader;

  const stopClock = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    cancelAnimation(progress);
  }, [progress]);

  const runClock = useCallback(
    (ms: number) => {
      stopClock();
      progress.set(withTiming(1, { duration: ms, easing: Easing.linear }));
      timer.current = setTimeout(next, ms);
    },
    [next, progress, stopClock],
  );

  // Historia nueva (o se vuelve a abrir): la barra empieza de cero. Va
  // ANTES que el efecto del reloj, que lee dónde se quedó la barra.
  useEffect(() => {
    progress.set(0);
  }, [index, visible, progress]);

  // El reloj: corre si toca y no está en pausa. Al reanudar sigue donde se
  // quedó la barra, no desde el principio.
  useEffect(() => {
    if (!autoplay || paused) {
      stopClock();
      return;
    }
    runClock(total * (1 - progress.get()));
    return stopClock;
  }, [autoplay, paused, total, index, runClock, stopClock, progress]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), FLASH_MS);
    return () => clearTimeout(t);
  }, [flash]);

  const bg = useAnimatedStyle(() => ({
    backgroundColor: withTiming(fill, { duration: durations.base }),
  }));
  const bar = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.get() }],
  }));

  const copy = async () => {
    if (!item) return;
    const { name } = splitAuthor(item.author);
    await Clipboard.setStringAsync(
      `${item.r.contenido.trim()}${name ? `\n— ${name}` : ''}`,
    );
    h.formSuccess();
    setFlash('Copiada');
  };

  const shareImage = async () => {
    if (!item) return;
    setPaused(true);
    const ok = await shareRef.current?.share(`reflexion-${item.r.id}.png`);
    if (!ok) {
      // Sin imagen (web antiguo, permisos…): al menos el texto.
      shareText(`${item.r.contenido.trim()}\n— ${item.author || 'Anónimo'}`, {
        notify: (label) => setFlash(label),
      });
    }
    setPaused(false);
  };

  const segments = items.length <= MAX_SEGMENTS;
  const { name, detail } = item
    ? splitAuthor(item.author)
    : { name: '', detail: '' };
  const len = item ? item.r.contenido.trim().length : 0;
  const textStyle =
    len <= 90
      ? styles.textXl
      : len <= 220
        ? styles.textLg
        : len <= 420
          ? styles.textMd
          : styles.textSm;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle={Platform.OS === 'ios' ? 'fullScreen' : undefined}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.root, bg]}>
        {/* Zonas de toque, DEBAJO del contenido que tiene botones. */}
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.zones}>
            <PressableScale
              staticScale
              style={styles.zonePrev}
              onPress={prev}
              onLongPress={() => setPaused(true)}
              onPressOut={() => paused && setPaused(false)}
              delayLongPress={220}
              accessibilityRole="button"
              accessibilityLabel="Anterior"
            />
            <PressableScale
              staticScale
              style={styles.zoneNext}
              onPress={next}
              onLongPress={() => setPaused(true)}
              onPressOut={() => paused && setPaused(false)}
              delayLongPress={220}
              accessibilityRole="button"
              accessibilityLabel={atEnd ? 'Fin' : 'Siguiente'}
            />
          </View>
        </View>

        <View
          style={[styles.top, { paddingTop: insets.top + spacing.sm }]}
          pointerEvents="box-none"
        >
          {segments ? (
            <View style={styles.segments} pointerEvents="none">
              {items.map((it, i) => (
                <View
                  key={it.r.id}
                  style={[
                    styles.track,
                    { backgroundColor: hexAlpha(ink, '40') },
                  ]}
                >
                  {i < index ? (
                    <View style={[styles.full, { backgroundColor: ink }]} />
                  ) : i === index ? (
                    <Animated.View
                      style={[styles.full, { backgroundColor: ink }, bar]}
                    />
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <View
              style={[styles.track, { backgroundColor: hexAlpha(ink, '40') }]}
              pointerEvents="none"
            >
              {!atEnd ? (
                <Animated.View
                  style={[styles.full, { backgroundColor: ink }, bar]}
                />
              ) : null}
            </View>
          )}
          <View style={styles.topRow} pointerEvents="box-none">
            <Text
              style={[styles.kicker, { color: hexAlpha(ink, 'C7') }]}
              numberOfLines={1}
              maxFontSizeMultiplier={CHROME_MAX_FONT_SCALE}
            >
              {eventTitle}
              {!atEnd ? `  ·  ${index + 1} de ${items.length}` : ''}
              {paused ? '  ·  en pausa' : ''}
            </Text>
            <PressableScale
              onPress={onClose}
              style={[styles.round, { backgroundColor: hexAlpha(ink, '1F') }]}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              hitSlop={6}
            >
              <MaterialIcons name="close" size={22} color={ink} />
            </PressableScale>
          </View>
        </View>

        {item ? (
          <View style={styles.body} pointerEvents="none">
            <MaterialIcons
              name="format-quote"
              size={72}
              color={hexAlpha(ink, '4D')}
              style={styles.quote}
            />
            {item.r.titulo ? (
              <Text style={[styles.title, { color: ink }]}>
                {item.r.titulo}
              </Text>
            ) : null}
            <Text
              style={[textStyle, { color: ink }]}
              maxFontSizeMultiplier={1.4}
              accessibilityLiveRegion="polite"
            >
              {item.r.contenido.trim()}
            </Text>
          </View>
        ) : (
          <View style={styles.body} pointerEvents="box-none">
            <Text style={[styles.endTitle, { color: ink }]}>¿Y tú?</Text>
            <Text style={[styles.endLead, { color: hexAlpha(ink, 'D9') }]}>
              Comparte lo que te llevas de estos días. Lo leerá todo el
              encuentro.
            </Text>
            <PressableScale
              onPress={onCompose}
              style={[styles.endCta, { backgroundColor: ink }]}
              accessibilityRole="button"
              accessibilityLabel="Escribir la mía"
            >
              <MaterialIcons name="edit" size={20} color={fill} />
              <Text style={[styles.endCtaText, { color: fill }]}>
                Escribir la mía
              </Text>
            </PressableScale>
            <PressableScale
              onPress={() => setIndex(0)}
              style={styles.again}
              accessibilityRole="button"
              accessibilityLabel="Verlas otra vez"
            >
              <MaterialIcons name="replay" size={18} color={ink} />
              <Text style={[styles.againText, { color: ink }]}>
                Verlas otra vez
              </Text>
            </PressableScale>
          </View>
        )}

        {item ? (
          <View
            style={[
              styles.foot,
              { paddingBottom: Math.max(insets.bottom, spacing.md) },
            ]}
            pointerEvents="box-none"
          >
            <View style={styles.who} pointerEvents="none">
              <AuthorAvatar
                name={item.author}
                color={hexAlpha(ink, '26')}
                ink={ink}
                size={40}
              />
              <View style={styles.flex}>
                <Text style={[styles.name, { color: ink }]} numberOfLines={1}>
                  {name || 'Anónimo'}
                </Text>
                <Text
                  style={[styles.meta, { color: hexAlpha(ink, 'C7') }]}
                  numberOfLines={1}
                >
                  {[detail, item.when].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </View>
            <View style={styles.actions} pointerEvents="box-none">
              {flash ? (
                <Text style={[styles.flash, { color: ink }]}>{flash}</Text>
              ) : null}
              <PressableScale
                onPress={copy}
                style={[styles.round, { backgroundColor: hexAlpha(ink, '1F') }]}
                accessibilityRole="button"
                accessibilityLabel="Copiar el texto"
              >
                <MaterialIcons name="content-copy" size={20} color={ink} />
              </PressableScale>
              <PressableScale
                onPress={shareImage}
                style={[styles.share, { backgroundColor: ink }]}
                accessibilityRole="button"
                accessibilityLabel="Compartir como imagen"
              >
                <MaterialIcons
                  name={Platform.OS === 'ios' ? 'ios-share' : 'share'}
                  size={18}
                  color={fill}
                />
                <Text
                  style={[styles.shareText, { color: fill }]}
                  maxFontSizeMultiplier={CHROME_MAX_FONT_SCALE}
                >
                  Compartir
                </Text>
              </PressableScale>
            </View>
          </View>
        ) : null}

        {/* La imagen que se comparte: montada pero invisible. */}
        {item ? (
          <View style={styles.offscreen} pointerEvents="none">
            <ShareCardView
              ref={shareRef}
              width={108}
              spec={reflexionCardSpec({
                text: item.r.contenido,
                author: item.author,
                eventTitle,
                background: fill,
              })}
            />
          </View>
        ) : null}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  zones: { flex: 1, flexDirection: 'row' },
  zonePrev: { flex: 35 },
  zoneNext: { flex: 65 },
  top: { paddingHorizontal: spacing.md, gap: spacing.sm },
  segments: { flexDirection: 'row', gap: spacing.xs },
  track: {
    flex: 1,
    height: 3,
    borderRadius: radii.pillFull,
    overflow: 'hidden',
  },
  full: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    transformOrigin: 'left',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  kicker: { ...typography.footnote, fontWeight: '700', flex: 1 },
  round: {
    width: 44,
    height: 44,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  quote: { marginLeft: -spacing.sm, marginBottom: -spacing.md },
  title: { ...typography.h2 },
  textXl: { ...typography.h0, lineHeight: 41 },
  textLg: { ...typography.h1, lineHeight: 35, letterSpacing: -0.4 },
  textMd: { ...typography.h2, lineHeight: 30, letterSpacing: -0.2 },
  textSm: { ...typography.title, fontWeight: '500', lineHeight: 26 },
  endTitle: { ...typography.h0, lineHeight: 41 },
  endLead: { ...typography.h3, fontWeight: '500', lineHeight: 25 },
  endCta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.full,
    marginTop: spacing.md,
  },
  endCtaText: { ...typography.h3 },
  again: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs + 2,
    minHeight: 44,
  },
  againText: { ...typography.button },
  foot: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  who: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { ...typography.button, fontWeight: '700' },
  meta: { ...typography.caption, marginTop: 1 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  flash: { ...typography.subhead, fontWeight: '600', marginRight: 'auto' },
  share: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
  },
  shareText: { ...typography.button, fontWeight: '700' },
  offscreen: { position: 'absolute', left: 0, top: 0, opacity: 0 },
});
