/**
 * Onboarding del cantoral: cuatro o cinco preguntas cortas sobre cómo ver
 * las canciones, con una canción de verdad debajo que cambia al tocar cada
 * opción.
 *
 * - Se puede cerrar en cualquier momento («Saltar», la ✕ o deslizando hacia
 *   abajo en iOS). Lo que ya se haya tocado se queda: son ajustes normales
 *   de `SettingsContext` y se ven al momento.
 * - Todo se vuelve a cambiar cuando se quiera: en cada canción con Aa →
 *   «Letra y vista», o volviendo aquí con el «?» del cantoral.
 *
 * La lógica pura (pasos, canción de muestra, cuándo se abre solo) está en
 * `utils/cantoralOnboarding.ts`.
 */
import React, { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PressableFeedback } from 'heroui-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import SongDisplay from '@/components/SongDisplay';
import AppPrimaryButton from '@/components/ui/AppPrimaryButton';
import SegmentedControl from '@/components/ui/SegmentedControl';
import TagChip from '@/components/song-tags/TagChip';
import { useHiddenTags } from '@/hooks/useHiddenTags';
import { ChorusPreview } from '@/components/SongFontBottomSheet';
import {
  sheetPalette,
  valueBoxStyle,
  type SheetPalette,
} from '@/components/song-sheet/sheetKit';
import { SONG_FONTS, useSettings } from '@/contexts/SettingsContext';
import { useSongProcessor } from '@/hooks/useSongProcessor';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { CHORUS_STYLES } from '@/utils/songSheetLayout';
import {
  onboardingSteps,
  pickPreviewSong,
  type OnboardingStepId,
} from '@/utils/cantoralOnboarding';
import type { ResolvedTag } from '@/utils/songTags';
import { getNativeFontFamily } from '@/utils/fontUtils';
import { themeColors, UIColors } from '@/constants/colors';
import { radii } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { h } from '@/utils/haptics';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Los datos del cantoral, para sacar la canción de muestra. */
  songsData: Parameters<typeof pickPreviewSong>[0];
  /** Etiquetas que existen (si no hay, no se pregunta por ellas). */
  tags: ResolvedTag[];
}

/** Qué parte de la canción enseñar en cada paso (la que cambia). */
const STEP_SCROLL: Record<OnboardingStepId, string | null> = {
  role: null,
  repeats: '.sec.rep, .sec.chorus ~ .sec.chorus',
  chorus: '.sec.chorus',
  text: null,
  tags: null,
};

const STEP_TEXT: Record<OnboardingStepId, { title: string; hint: string }> = {
  role: {
    title: '¿Tocas o cantas?',
    hint: 'Mira la canción de arriba: cambia al momento.',
  },
  repeats: {
    title: 'Estribillos que se repiten',
    hint: 'Completa para seguirla entera; compacta para que quepa más.',
  },
  chorus: {
    title: '¿Cómo destacamos el estribillo?',
    hint: 'Para encontrarlo de un vistazo, también desde el atril.',
  },
  text: {
    title: 'Letra',
    hint: 'El tamaño, con Aa dentro de cada canción.',
  },
  tags: {
    title: 'Tus etiquetas',
    hint: 'Las que uses mucho, a mano. Las que no van contigo (canciones de otro carisma, por ejemplo), escondidas.',
  },
};

export default function CantoralOnboarding({
  visible,
  onClose,
  songsData,
  tags,
}: Props) {
  const isDark = useColorScheme() === 'dark';
  const p = sheetPalette(isDark);
  const t = themeColors(isDark);
  const layout = useResponsiveLayout();
  const { settings } = useSettings();

  const steps = useMemo(
    () => onboardingSteps({ hasTags: tags.length > 0 }),
    [tags.length],
  );
  const [index, setIndex] = useState(0);
  // Cada vez que se abre, desde el principio (ajuste durante el render, el
  // patrón de React para «cambiar estado cuando cambia una prop»).
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setIndex(0);
  }
  const step = steps[Math.min(index, steps.length - 1)];
  const isLast = index >= steps.length - 1;

  const preview = useMemo(() => pickPreviewSong(songsData), [songsData]);
  const { songHtml, isLoadingSong, styleState } = useSongProcessor({
    originalChordPro: visible ? (preview?.content ?? null) : null,
    currentTranspose: 0,
    chordsVisible: settings.chordsVisible,
    arrangementsVisible: false,
    compact: settings.compactView,
    verseNumbers: settings.verseNumbers,
    chorusStyle: settings.chorusStyle,
    chorusLabel: settings.chorusLabel,
    airy: settings.airy,
    currentFontSizeEm: settings.fontSize,
    currentFontFamily: settings.fontFamily,
    notation: settings.notation,
    title: preview?.title,
    author: preview?.author,
    key: preview?.key,
    capo: preview?.capo,
    isDark,
  });

  const next = () => {
    if (isLast) onClose();
    else setIndex((i) => i + 1);
  };
  const back = () => setIndex((i) => Math.max(0, i - 1));

  const panel = (
    <ScrollView
      style={styles.panelScroll}
      contentContainerStyle={styles.panelContent}
      showsVerticalScrollIndicator={false}
    >
      <Text
        style={[styles.title, { color: t.text }]}
        accessibilityRole="header"
      >
        {STEP_TEXT[step].title}
      </Text>
      <Text style={[styles.hint, { color: t.textSecondary }]}>
        {STEP_TEXT[step].hint}
      </Text>
      <StepBody step={step} palette={p} tags={tags} isDark={isDark} />
      {index === 0 || isLast ? (
        <Text style={[styles.footnote, { color: t.textMuted }]}>
          Todo se cambia cuando quieras: Aa → «Letra y vista» en cada canción, o
          el ? de arriba del cantoral.
        </Text>
      ) : null}
    </ScrollView>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.root, { backgroundColor: t.background }]}
        edges={Platform.OS === 'ios' ? ['bottom'] : ['top', 'bottom']}
      >
        {/* Cabecera: progreso y salida, siempre a mano. */}
        <View style={styles.header}>
          <View
            style={styles.dots}
            accessibilityLabel={`Paso ${index + 1} de ${steps.length}`}
          >
            {steps.map((s, i) => (
              <View
                key={s}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      i <= index ? UIColors.accentYellow : t.separator,
                  },
                ]}
              />
            ))}
          </View>
          <PressableFeedback
            onPress={onClose}
            style={styles.skip}
            hitSlop={spacing.sm}
            accessibilityRole="button"
            accessibilityLabel="Cerrar y empezar a usar el cantoral"
          >
            <PressableFeedback.Highlight />
            <Text style={[styles.skipText, { color: t.link }]}>
              {isLast ? 'Cerrar' : 'Saltar'}
            </Text>
          </PressableFeedback>
        </View>

        <View style={[styles.body, layout.isWide && styles.bodyWide]}>
          <View
            style={[
              styles.preview,
              layout.isWide && styles.previewWide,
              { borderColor: t.separator },
            ]}
            accessibilityLabel="Vista previa de una canción"
          >
            <SongDisplay
              songHtml={songHtml}
              isLoading={isLoadingSong}
              styleState={styleState}
              fullBleed
              scrollTo={STEP_SCROLL[step]}
            />
          </View>
          <View style={[styles.panel, layout.isWide && styles.panelWide]}>
            {panel}
            <View style={styles.nav}>
              {index > 0 ? (
                <PressableFeedback
                  onPress={back}
                  style={styles.backBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Paso anterior"
                >
                  <PressableFeedback.Highlight />
                  <MaterialIcons name="arrow-back" size={22} color={t.link} />
                </PressableFeedback>
              ) : null}
              <AppPrimaryButton
                label={isLast ? 'Listo' : 'Siguiente'}
                icon={isLast ? 'check' : 'arrow-forward'}
                iconPosition={isLast ? 'left' : 'right'}
                onPress={next}
                style={styles.nextBtn}
              />
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

/** Lo que se elige en cada paso. Todo escribe en los ajustes al momento. */
function StepBody({
  step,
  palette: p,
  tags,
  isDark,
}: {
  step: OnboardingStepId;
  palette: SheetPalette;
  tags: ResolvedTag[];
  isDark: boolean;
}) {
  const { settings, setSettings } = useSettings();

  if (step === 'role') {
    return (
      <View style={styles.group}>
        <OptionRow
          palette={p}
          icon="queue-music"
          title="Toco"
          desc="Con los acordes encima de la letra"
          active={settings.chordsVisible}
          onPress={() => setSettings({ chordsVisible: true })}
        />
        <OptionRow
          palette={p}
          icon="mic-none"
          title="Canto"
          desc="Solo la letra, más limpia"
          active={!settings.chordsVisible}
          onPress={() => setSettings({ chordsVisible: false })}
        />
        {settings.chordsVisible ? (
          <View style={styles.inline}>
            <Text style={[styles.inlineLabel, { color: p.label }]}>
              Acordes en
            </Text>
            <SegmentedControl
              options={[
                { value: 'ES', label: 'DO RE MI' },
                { value: 'EN', label: 'C D E' },
              ]}
              value={settings.notation}
              onChange={(notation) => setSettings({ notation })}
              style={styles.segmented}
              accessibilityLabel="Notación de los acordes"
            />
          </View>
        ) : null}
      </View>
    );
  }

  if (step === 'repeats') {
    return (
      <View style={styles.group}>
        <OptionRow
          palette={p}
          icon="subject"
          title="Completa"
          desc="Todo escrito, en el orden en que se canta"
          active={!settings.compactView}
          onPress={() => setSettings({ compactView: false })}
        />
        <OptionRow
          palette={p}
          icon="unfold-less"
          title="Compacta"
          desc="Cada estribillo repetido, plegado en una línea"
          active={settings.compactView}
          onPress={() => setSettings({ compactView: true })}
        />
      </View>
    );
  }

  if (step === 'chorus') {
    return (
      <View style={styles.group}>
        <View style={styles.chipWrap} accessibilityRole="radiogroup">
          {CHORUS_STYLES.map((c) => {
            const active = c.id === settings.chorusStyle;
            return (
              <ChoiceChip
                key={c.id}
                palette={p}
                active={active}
                label={c.name}
                accessibilityLabel={`Estribillo: ${c.name}`}
                onPress={() => setSettings({ chorusStyle: c.id })}
                third
              >
                <ChorusPreview
                  id={c.id}
                  color={active ? p.active.fg : p.text}
                />
              </ChoiceChip>
            );
          })}
        </View>
        <ToggleRow
          palette={p}
          icon="label-outline"
          title="Poner «Estribillo» encima"
          on={settings.chorusLabel}
          onPress={() => setSettings({ chorusLabel: !settings.chorusLabel })}
        />
      </View>
    );
  }

  if (step === 'text') {
    return (
      <View style={styles.group}>
        <View style={styles.chipRow} accessibilityRole="radiogroup">
          {SONG_FONTS.map((f) => {
            const active = f.cssValue === settings.fontFamily;
            const family = getNativeFontFamily(f.cssValue);
            return (
              <ChoiceChip
                key={f.name}
                palette={p}
                active={active}
                label={f.name}
                accessibilityLabel={`Letra ${f.name}`}
                onPress={() => setSettings({ fontFamily: f.cssValue })}
              >
                <Text
                  style={[
                    styles.fontSample,
                    { color: active ? p.active.fg : p.text },
                    family ? { fontFamily: family } : null,
                  ]}
                >
                  Aa
                </Text>
              </ChoiceChip>
            );
          })}
        </View>
        <ToggleRow
          palette={p}
          icon="format-list-numbered"
          title="Números de estrofa"
          on={settings.verseNumbers}
          onPress={() => setSettings({ verseNumbers: !settings.verseNumbers })}
        />
        <ToggleRow
          palette={p}
          icon="format-line-spacing"
          title="Más aire entre líneas"
          on={settings.airy}
          onPress={() => setSettings({ airy: !settings.airy })}
        />
      </View>
    );
  }

  // Etiquetas: a mano (atajo arriba y discretas en las listas) o
  // escondidas (y, si se quiere, sus canciones fuera de las categorías).
  return <TagsStep palette={p} tags={tags} isDark={isDark} />;
}

function TagsStep({
  palette: p,
  tags,
  isDark,
}: {
  palette: SheetPalette;
  tags: ResolvedTag[];
  isDark: boolean;
}) {
  const { settings, setSettings } = useSettings();
  const { hiddenSlugs, toggleHidden } = useHiddenTags();
  const featured = new Set(settings.featuredTags);
  const toggleFeatured = (slug: string) =>
    setSettings({
      featuredTags: featured.has(slug)
        ? settings.featuredTags.filter((s) => s !== slug)
        : [...settings.featuredTags, slug],
    });
  return (
    <View style={styles.group}>
      <Text style={[styles.inlineLabel, { color: p.label }]}>A mano</Text>
      <View style={styles.tagWrap}>
        {tags
          .filter((t) => !hiddenSlugs.has(t.slug))
          .map((tag) => {
            const on = featured.has(tag.slug);
            return (
              <TagChip
                key={tag.slug}
                tag={tag}
                variant={on ? 'active' : 'outline'}
                isDark={isDark}
                showAdd={!on}
                hideCount
                onPress={() => toggleFeatured(tag.slug)}
                accessibilityHint={
                  on
                    ? 'Quitar de las etiquetas a mano'
                    : 'Tenerla arriba del cantoral y en las listas'
                }
              />
            );
          })}
      </View>
      <Text style={[styles.inlineLabel, { color: p.label }]}>Esconder</Text>
      <View style={styles.tagWrap}>
        {tags
          .filter((t) => !featured.has(t.slug))
          .map((tag) => {
            const off = hiddenSlugs.has(tag.slug);
            return (
              <TagChip
                key={tag.slug}
                tag={tag}
                variant={off ? 'active' : 'outline'}
                isDark={isDark}
                hideCount
                onPress={() => {
                  h.toggle();
                  toggleHidden(tag.slug);
                }}
                accessibilityHint={
                  off ? 'Volver a mostrarla' : 'Esconder esta etiqueta'
                }
              />
            );
          })}
      </View>
      {hiddenSlugs.size > 0 && (
        <ToggleRow
          palette={p}
          icon="visibility-off"
          title="Esconder también sus canciones (siguen en el buscador)"
          on={settings.hideHiddenTagSongs}
          onPress={() =>
            setSettings({ hideHiddenTagSongs: !settings.hideHiddenTagSongs })
          }
        />
      )}
    </View>
  );
}

/** Una opción grande con icono, título y explicación (elige una de dos). */
function OptionRow({
  palette: p,
  icon,
  title,
  desc,
  active,
  onPress,
}: {
  palette: SheetPalette;
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  desc: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <PressableFeedback
      onPress={() => {
        if (active) return;
        h.select();
        onPress();
      }}
      style={[styles.option, valueBoxStyle(p, active)]}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${title}. ${desc}`}
    >
      <PressableFeedback.Highlight />
      <MaterialIcons
        name={icon}
        size={26}
        color={active ? p.active.fg : p.text}
      />
      <View style={styles.optionText}>
        <Text
          style={[styles.optionTitle, { color: active ? p.active.fg : p.text }]}
        >
          {title}
        </Text>
        <Text style={[styles.optionDesc, { color: p.textSecondary }]}>
          {desc}
        </Text>
      </View>
      <MaterialIcons
        name={active ? 'radio-button-checked' : 'radio-button-unchecked'}
        size={22}
        color={active ? p.active.fg : p.disabled}
      />
    </PressableFeedback>
  );
}

/** Un interruptor en una fila (etiqueta, números, aire). */
function ToggleRow({
  palette: p,
  icon,
  title,
  on,
  onPress,
}: {
  palette: SheetPalette;
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <PressableFeedback
      onPress={() => {
        h.toggle();
        onPress();
      }}
      style={[styles.toggle, valueBoxStyle(p, on)]}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={title}
    >
      <PressableFeedback.Highlight />
      <MaterialIcons name={icon} size={22} color={on ? p.active.fg : p.text} />
      <Text
        style={[styles.toggleTitle, { color: on ? p.active.fg : p.text }]}
        numberOfLines={2}
      >
        {title}
      </Text>
      <MaterialIcons
        name={on ? 'check-box' : 'check-box-outline-blank'}
        size={22}
        color={on ? p.active.fg : p.disabled}
      />
    </PressableFeedback>
  );
}

/** Un chip con dibujo y nombre (variante del estribillo, letra). */
function ChoiceChip({
  palette: p,
  active,
  label,
  accessibilityLabel,
  onPress,
  third = false,
  children,
}: {
  palette: SheetPalette;
  active: boolean;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  third?: boolean;
  children: React.ReactNode;
}) {
  return (
    <PressableFeedback
      onPress={() => {
        if (active) return;
        h.select();
        onPress();
      }}
      style={[styles.chip, third && styles.chipThird, valueBoxStyle(p, active)]}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={accessibilityLabel}
    >
      <PressableFeedback.Highlight />
      {children}
      <Text
        style={[
          styles.chipLabel,
          {
            color: active ? p.active.fg : p.textSecondary,
            fontWeight: active ? '700' : '500',
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  dots: { flex: 1, flexDirection: 'row', gap: spacing.xs },
  dot: { flex: 1, maxWidth: 40, height: 4, borderRadius: radii.xs },
  skip: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: spacing.sm,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  skipText: { ...typography.button },
  body: { flex: 1 },
  bodyWide: { flexDirection: 'row' },
  preview: {
    flex: 1,
    minHeight: 200,
    marginHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  previewWide: { marginBottom: spacing.md },
  panel: { maxHeight: '58%' },
  panelWide: { maxHeight: undefined, width: 400 },
  panelScroll: { flexGrow: 0 },
  panelContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  title: { ...typography.h2 },
  hint: { ...typography.subhead, marginTop: -spacing.xs },
  footnote: { ...typography.footnote, marginTop: spacing.xs },
  group: { gap: spacing.sm, marginTop: spacing.xs },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  optionText: { flex: 1 },
  optionTitle: { ...typography.title },
  optionDesc: { ...typography.footnote },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: spacing.xs,
  },
  inlineLabel: { ...typography.caption, fontWeight: '600' },
  segmented: { flex: 1 },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  toggleTitle: { flex: 1, ...typography.subhead, fontWeight: '600' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chipRow: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flex: 1,
    minHeight: 64,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  // Tres por fila: cinco variantes no caben en una a ancho de móvil.
  chipThird: { flex: 0, flexBasis: '30%', flexGrow: 1 },
  chipLabel: { ...typography.micro, textAlign: 'center' },
  fontSample: { ...typography.h2, lineHeight: 26 },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    paddingBottom: spacing.sm,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtn: { flex: 1 },
});
