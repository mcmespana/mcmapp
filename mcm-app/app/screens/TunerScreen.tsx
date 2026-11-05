/**
 * Afinador del cantoral. Se abre como hoja desde el menú de una canción (y
 * desde el «⋯» del cantoral): afinas, la cierras y sigues con los acordes.
 *
 * Solo guitarra y afinación estándar, a propósito: tiene que afinar y ya. La
 * lógica está fuera de la pantalla —`hooks/useTuner.ts` (micrófono y ritmo),
 * `utils/tuner/` (notas, detección y suavizado, con tests)— y esto solo pinta.
 * Detalles en `docs/funcionalidades/AFINADOR.md`.
 */
import React, { useEffect, useLayoutEffect } from 'react';
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useNavigation } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableFeedback } from 'heroui-native';
import TunerGauge, { gaugeHeight } from '@/components/tuner/TunerGauge';
import TunerStrings from '@/components/tuner/TunerStrings';
import AppPrimaryButton from '@/components/ui/AppPrimaryButton';
import CelebrationBurst from '@/components/ui/CelebrationBurst';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { MaterialIcons } from '@/components/ui/icons';
import {
  KeyPillColors,
  SystemGray,
  themeColors,
  tunerColors,
} from '@/constants/colors';
import { durations, motionEasings, springs } from '@/constants/animations';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { useSettings } from '@/contexts/SettingsContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useKeepAwakeWhileFocused } from '@/hooks/useKeepAwakeWhileFocused';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useTuner, type TunerStatus } from '@/hooks/useTuner';
import { cantoralHeaderTint } from '@/utils/cantoralHeader';
import { h } from '@/utils/haptics';
import { onColor } from '@/utils/colorUtils';
import { STANDARD_TUNING, noteName, noteOctave } from '@/utils/tuner/notes';

const MAX_GAUGE_WIDTH = 340;
/** Alto de una línea de la nota gigante (para que el reposo mida lo mismo). */
const NOTE_LINE = Math.round((typography.display.fontSize ?? 0) * 1.2);
const HALO = 120;
const IDLE_GLYPH = 64;
const isWeb = Platform.OS === 'web';

/** Lo que dice la línea de debajo de la nota. */
function hintFor(
  status: TunerStatus,
  listening: boolean,
  cents: number,
  inTune: boolean,
): string {
  if (status === 'starting' || status === 'checking')
    return 'Abriendo el micrófono…';
  if (!listening) return 'Toca una cuerda';
  if (inTune) return 'Afinada';
  if (Math.abs(cents) <= 5) return 'Aguanta…';
  return cents < 0 ? 'Tensa la cuerda' : 'Afloja la cuerda';
}

function formatCents(c: number): string {
  const v = Math.round(c);
  if (v === 0) return '0';
  // Signo menos tipográfico, no el guion.
  return v > 0 ? `+${v}` : `−${Math.abs(v)}`;
}

export default function TunerScreen() {
  const navigation = useNavigation();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = themeColors(isDark);
  const tc = tunerColors(isDark);
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();
  const reducedMotion = useReducedMotion();
  const { settings } = useSettings();
  const notation = settings.notation;

  useKeepAwakeWhileFocused('tuner');
  const tuner = useTuner();
  const { reading, status } = tuner;
  const listening = status === 'listening' && reading.status === 'pitch';

  // ── Cabecera: título nativo y una X para cerrar la hoja (en iOS también se
  // baja con el dedo). En web no es una hoja: ya está la flecha de volver.
  useLayoutEffect(() => {
    if (isWeb) return;
    navigation.setOptions({
      headerRight: () => (
        <PressableFeedback
          onPress={() => {
            h.tap();
            router.back();
          }}
          hitSlop={10}
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel="Cerrar el afinador"
        >
          <IconSymbol
            name="xmark"
            size={20}
            color={cantoralHeaderTint(isDark)}
          />
        </PressableFeedback>
      ),
    });
  }, [navigation, isDark]);

  // Cuerdas afinadas en esta sesión (se olvidan al cerrar). Con las seis,
  // confeti: `CelebrationBurst` se dispara una vez al hacerse visible.
  const tuned = tuner.tuned;
  const allTuned = tuned.size === STANDARD_TUNING.length;

  // ── La nota: entra con un pequeño muelle cada vez que cambia de cuerda ──
  const noteScale = useSharedValue(1);
  const noteOpacity = useSharedValue(1);
  const shownString = listening ? reading.stringIndex : -1;
  useEffect(() => {
    if (reducedMotion) return;
    noteScale.set(0.92);
    noteScale.set(withSpring(1, springs.snap));
    noteOpacity.set(0.4);
    noteOpacity.set(
      withTiming(1, { duration: durations.base, easing: motionEasings.out }),
    );
  }, [shownString, noteScale, noteOpacity, reducedMotion]);
  const noteStyle = useAnimatedStyle(() => ({
    opacity: noteOpacity.get(),
    transform: [{ scale: noteScale.get() }],
  }));

  // Halo verde detrás de la nota cuando se bloquea.
  const lock = useSharedValue(0);
  useEffect(() => {
    lock.set(
      withTiming(listening && reading.inTune ? 1 : 0, {
        duration: durations.base,
        easing: motionEasings.out,
      }),
    );
  }, [listening, reading.inTune, lock]);
  const haloStyle = useAnimatedStyle(() => ({
    opacity: lock.get(),
    transform: [{ scale: 0.85 + 0.15 * lock.get() }],
  }));

  // «Te estoy oyendo»: el punto bajo la nota respira con el volumen.
  const levelStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.6 + tuner.level.get() * 0.9 }],
    opacity: 0.35 + tuner.level.get() * 0.65,
  }));

  const gaugeWidth = Math.min(
    MAX_GAUGE_WIDTH,
    (layout.isWide ? layout.readableMaxWidth : layout.width) - spacing.md * 2,
  );
  const gaugeH = gaugeHeight(gaugeWidth);

  const targetMidi =
    shownString >= 0
      ? STANDARD_TUNING[shownString].midi
      : tuner.lockedString !== null
        ? STANDARD_TUNING[tuner.lockedString].midi
        : null;
  const noteLabel = targetMidi !== null ? noteName(targetMidi, notation) : '';
  const octave = targetMidi !== null ? noteOctave(targetMidi) : null;
  const hint = hintFor(status, listening, reading.cents, reading.inTune);
  const inTuneNow = listening && reading.inTune;
  // Fuera de la zona, la línea dice hacia dónde girar, con su flecha.
  const offTune = listening && !reading.inTune;
  const holding = offTune && Math.abs(reading.cents) <= 5;
  const direction =
    !offTune || holding ? null : reading.cents < 0 ? 'up' : 'down';

  const stringItems = STANDARD_TUNING.map((s) => ({
    label: noteName(s.midi, notation),
    number: s.number,
  }));

  const blocked =
    status === 'needs-permission' ||
    status === 'denied' ||
    status === 'unavailable';

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + spacing.lg },
      ]}
      alwaysBounceVertical={false}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={styles.stage}>
        <TunerGauge
          width={gaugeWidth}
          cents={reading.cents}
          active={listening}
          inTune={inTuneNow}
          colors={{
            track: isDark ? SystemGray.dark.gray4 : SystemGray.light.gray5,
            tick: isDark ? SystemGray.dark.gray2 : SystemGray.light.gray3,
            tickStrong: theme.textMuted,
            zone: tc.inTuneFill,
            inTune: tc.inTune,
            near: tc.near,
            idle: isDark ? SystemGray.dark.gray2 : SystemGray.light.gray3,
            puckCore: theme.background,
          }}
        />

        {/* La nota, dentro del cuenco del arco */}
        <View
          style={[styles.center, { top: gaugeH * 0.38, width: gaugeWidth }]}
          accessible
          accessibilityRole="text"
          accessibilityLiveRegion="polite"
          accessibilityLabel={
            listening
              ? `${noteLabel}${octave ?? ''}. ${hint}. ${formatCents(
                  reading.cents,
                )} cents`
              : hint
          }
        >
          <Animated.View
            style={[styles.halo, { backgroundColor: tc.inTuneFill }, haloStyle]}
          />
          <Animated.View style={[styles.noteRow, noteStyle]}>
            {targetMidi === null ? (
              // En reposo, ni una nota inventada ni un guion: el icono de
              // «sonido», a la altura de la nota para que nada salte.
              <View style={styles.idleGlyph}>
                <MaterialIcons
                  name="graphic-eq"
                  size={IDLE_GLYPH}
                  color={theme.separator}
                />
              </View>
            ) : (
              <Text
                style={[
                  styles.note,
                  {
                    color: inTuneNow
                      ? tc.inTune
                      : listening
                        ? theme.text
                        : theme.textMuted,
                  },
                ]}
                maxFontSizeMultiplier={1.3}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {noteLabel}
              </Text>
            )}
            {octave !== null && (
              <Text
                style={[styles.octave, { color: theme.textMuted }]}
                maxFontSizeMultiplier={1.3}
              >
                {octave}
              </Text>
            )}
          </Animated.View>
          <View style={styles.readout}>
            {inTuneNow ? (
              <MaterialIcons name="check-circle" size={20} color={tc.inTune} />
            ) : direction ? (
              <MaterialIcons
                name={direction === 'up' ? 'arrow-upward' : 'arrow-downward'}
                size={20}
                color={tc.near}
              />
            ) : (
              <Animated.View
                style={[
                  styles.levelDot,
                  {
                    backgroundColor: listening
                      ? theme.textMuted
                      : theme.separator,
                  },
                  levelStyle,
                ]}
              />
            )}
            <Text
              style={[
                styles.hint,
                {
                  color: inTuneNow
                    ? tc.inTune
                    : offTune
                      ? tc.near
                      : theme.textSecondary,
                },
              ]}
            >
              {hint}
            </Text>
          </View>
          <Text style={[styles.cents, { color: theme.textMuted }]}>
            {listening ? `${formatCents(reading.cents)} cents` : ' '}
          </Text>
        </View>

        {allTuned && (
          <View
            style={[styles.burst, { top: gaugeH * 0.45 }]}
            pointerEvents="none"
          >
            <CelebrationBurst visible emoji="🎸" />
          </View>
        )}
      </View>

      {blocked ? (
        <PermissionCard status={status} onStart={tuner.start} isDark={isDark} />
      ) : (
        <View style={styles.stringsBlock}>
          <TunerStrings
            strings={stringItems}
            activeIndex={listening ? reading.stringIndex : -1}
            lockedIndex={tuner.lockedString}
            tuned={tuned}
            onPress={(i) => {
              h.select();
              tuner.lockString(tuner.lockedString === i ? null : i);
            }}
            colors={{
              surface: theme.backgroundSunken,
              surfaceActive: isDark
                ? KeyPillColors.bgDark
                : KeyPillColors.bgLight,
              text: theme.textSecondary,
              textMuted: theme.textMuted,
              textActive: theme.link,
              inTune: tc.inTune,
              badgeInk: onColor(tc.inTune),
            }}
          />
          <Text style={[styles.mode, { color: theme.textMuted }]}>
            {tuner.lockedString !== null
              ? `Solo la ${STANDARD_TUNING[tuner.lockedString].number}.ª · tócala otra vez para soltarla`
              : tuned.size === STANDARD_TUNING.length
                ? 'Las seis afinadas'
                : 'Estándar · La 440 · reconoce la cuerda sola'}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

/** Cuando aún no se puede escuchar: el porqué, y el botón que lo arregla. */
function PermissionCard({
  status,
  onStart,
  isDark,
}: {
  status: TunerStatus;
  onStart: () => void;
  isDark: boolean;
}) {
  const theme = themeColors(isDark);
  const denied = status === 'denied';
  const unavailable = status === 'unavailable';
  const body = unavailable
    ? 'Este dispositivo o navegador no deja usar el micrófono.'
    : denied
      ? isWeb
        ? 'El navegador tiene bloqueado el micrófono para esta web. Actívalo en el candado de la barra de direcciones.'
        : 'El micrófono está desactivado para MCM App. Actívalo en Ajustes y vuelve.'
      : 'Para afinar, la app tiene que oír tu guitarra. El sonido se analiza en el móvil y no se guarda ni se envía.';
  return (
    <View
      style={[styles.permission, { backgroundColor: theme.backgroundSunken }]}
    >
      <MaterialIcons
        name={denied || unavailable ? 'mic-off' : 'mic'}
        size={28}
        color={theme.link}
      />
      <Text style={[styles.permissionText, { color: theme.text }]}>{body}</Text>
      {!unavailable && !(denied && isWeb) && (
        <AppPrimaryButton
          label={denied ? 'Abrir Ajustes' : 'Usar el micrófono'}
          icon={denied ? 'settings' : 'mic'}
          onPress={() => {
            if (denied) void Linking.openSettings();
            else onStart();
          }}
          color={theme.link}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
  },
  headerButton: {
    padding: spacing.xs,
  },
  stage: {
    alignItems: 'center',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
  },
  // Centrado sobre la línea de la nota, no sobre todo el bloque: si no, se
  // comía la mitad de «Afinada».
  halo: {
    position: 'absolute',
    top: (NOTE_LINE - HALO) / 2,
    width: HALO,
    height: HALO,
    borderRadius: radii.pillFull,
  },
  idleGlyph: {
    height: NOTE_LINE,
    justifyContent: 'center',
  },
  // La octava va abajo, como subíndice (Mi₂): arriba chocaba con el punto
  // de la «i» y con el palo de la «l».
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  note: {
    ...typography.display,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  octave: {
    ...typography.h3,
    marginBottom: spacing.md,
    marginLeft: 2,
  },
  readout: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 24,
  },
  levelDot: {
    width: 10,
    height: 10,
    borderRadius: radii.pillFull,
  },
  hint: {
    ...typography.title,
  },
  cents: {
    ...typography.subhead,
    fontVariant: ['tabular-nums'],
    marginTop: spacing.xs,
  },
  burst: {
    position: 'absolute',
    alignSelf: 'center',
  },
  stringsBlock: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  mode: {
    ...typography.caption,
    textAlign: 'center',
  },
  permission: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    marginTop: spacing.xl,
    maxWidth: 420,
    width: '100%',
  },
  permissionText: {
    ...typography.body,
    textAlign: 'center',
  },
});
