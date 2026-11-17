/**
 * «Este domingo», en «Tu selección» cuando está VACÍA (lo primero que se hace
 * al preparar una misa es vaciarla): el domingo que toca con su fiesta, su
 * color y su ciclo; un acceso a las lecturas, y los cantos que propone la app
 * momento a momento (`useSundaySongs`: tiempo litúrgico + palabras en común
 * con las lecturas de ese domingo). Un botón los pasa a la selección y otro
 * abre la pantalla completa para cambiar alguno.
 * Doc viva: `docs/funcionalidades/CANTOS_DOMINGO.md`.
 */
import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import AppPrimaryButton from '@/components/ui/AppPrimaryButton';
import SectionHeader from '@/components/ui/SectionHeader';
import { MaterialIcons } from '@/components/ui/icons';
import { themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { useToast } from '@/contexts/AppToastContext';
import { useSelectedSongs } from '@/contexts/SelectedSongsContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import useLargeText from '@/hooks/useLargeText';
import { usePlaylistLink } from '@/hooks/usePlaylistLink';
import { useSundaySongs } from '@/hooks/useSundaySongs';
import { openCantoral } from '@/utils/cantoralNavigation';
import { h } from '@/utils/haptics';
import {
  isoDateLocal,
  longDateEs,
  shortDateEs,
  targetSunday,
} from '@/utils/liturgicalDay';
import { cleanSongTitle } from '@/utils/songUtils';
import { massToSelection } from '@/utils/sundaySongs';

/** Cuánto dura el «Deshacer» al pasar los cantos a Tu selección. */
const UNDO_MS = 10_000;
/** Tamaño del punto del color litúrgico. */
const DOT = 10;
/** Área táctil mínima (design.md §1). */
const TOUCH = 44;
/** Ancho de la columna del momento («Comunión»). */
const MOMENT_COL = 92;

export default function SundayPlanCard({
  onOpenReadings,
}: {
  /** Abre las lecturas de `fecha`. */
  onOpenReadings: (fecha: string) => void;
}) {
  const isDark = useColorScheme() === 'dark';
  const roles = themeColors(isDark);
  const large = useLargeText();
  const { toast } = useToast();
  // Sin memo: la pestaña puede quedarse montada días y el domingo cambia.
  const fecha = targetSunday(isoDateLocal());
  const sunday = useSundaySongs(fecha);
  const { day, mass } = sunday;
  const { replaceAll } = useSelectedSongs();
  const { link, setLink } = usePlaylistLink();

  const chosen = useMemo(
    () =>
      mass
        .filter((m) => m.chosenIndex >= 0)
        .map((m) => ({ moment: m, song: m.candidates[m.chosenIndex] })),
    [mass],
  );

  const subtitle = [
    day.feastName ?? day.name,
    day.feastName && day.feastName !== day.name ? day.name : null,
    `Ciclo ${day.cycle}`,
  ]
    .filter(Boolean)
    .join(' · ');

  const openFull = useCallback(() => {
    h.tap();
    openCantoral('SundaySongs', { fecha });
  }, [fecha]);

  const passToSelection = useCallback(() => {
    const songs = massToSelection(mass);
    if (songs.length === 0) return;
    const prevLink = link;
    replaceAll(songs);
    setLink(null);
    h.add();
    toast.show({
      label: `Cantos del ${shortDateEs(fecha)} en Tu selección`,
      variant: 'success',
      duration: UNDO_MS,
      actionLabel: 'Deshacer',
      onActionPress: ({ hide }) => {
        replaceAll([]);
        setLink(prevLink);
        hide();
      },
    });
  }, [mass, link, replaceAll, setLink, toast, fecha]);

  return (
    <View style={styles.root}>
      <SectionHeader label="Este domingo" />
      <View style={[styles.card, { backgroundColor: roles.background }]}>
        <View style={styles.head}>
          <Text
            style={[typography.title, { color: roles.text }]}
            accessibilityRole="header"
          >
            {longDateEs(fecha)}
          </Text>
          <View style={styles.subtitleRow}>
            <View
              style={[
                styles.dot,
                { backgroundColor: day.colorHex, borderColor: roles.textMuted },
              ]}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <Text
              style={[
                typography.subhead,
                styles.flex,
                { color: roles.textSecondary },
              ]}
            >
              {subtitle}
            </Text>
          </View>
        </View>

        <PressableFeedback
          onPress={() => {
            h.tap();
            onOpenReadings(fecha);
          }}
          style={[
            styles.row,
            styles.separated,
            { borderColor: roles.separator },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Leer las lecturas de este domingo"
        >
          <PressableFeedback.Highlight />
          <MaterialIcons name="menu-book" size={20} color={roles.link} />
          <View style={styles.flex}>
            <Text style={[typography.body, { color: roles.link }]}>
              Leer las lecturas
            </Text>
            {sunday.readings?.evangelio?.cita ? (
              <Text
                style={[typography.caption, { color: roles.textSecondary }]}
                numberOfLines={large ? 3 : 1}
              >
                Evangelio: {sunday.readings.evangelio.cita}
              </Text>
            ) : null}
          </View>
          <MaterialIcons name="chevron-right" size={20} color={roles.link} />
        </PressableFeedback>

        {!sunday.hasSongs ? (
          <Text
            style={[
              typography.subhead,
              styles.note,
              styles.separated,
              { color: roles.textSecondary, borderColor: roles.separator },
            ]}
          >
            Los cantos se proponen con el cantoral: abre el cantoral una vez con
            conexión y aparecerán aquí.
          </Text>
        ) : !sunday.ready ? null : (
          <View style={[styles.separated, { borderColor: roles.separator }]}>
            <Text
              style={[
                typography.sectionLabel,
                styles.listLabel,
                { color: roles.textSecondary },
              ]}
            >
              Cantos que encajan
            </Text>
            {chosen.map(({ moment, song }) => (
              <PressableFeedback
                key={moment.moment}
                onPress={openFull}
                style={[styles.songRow, large && styles.songRowLarge]}
                accessibilityRole="button"
                accessibilityLabel={`${moment.label}: ${cleanSongTitle(song.title)}. Cambiar`}
              >
                <PressableFeedback.Highlight />
                <Text
                  style={[
                    typography.caption,
                    !large && styles.momentCol,
                    { color: roles.textMuted },
                  ]}
                  numberOfLines={1}
                >
                  {moment.label}
                </Text>
                <View style={styles.flex}>
                  <Text
                    style={[typography.body, { color: roles.text }]}
                    numberOfLines={large ? 3 : 1}
                  >
                    {cleanSongTitle(song.title)}
                  </Text>
                  {song.reasons.length > 0 ? (
                    <Text
                      style={[
                        typography.caption,
                        { color: roles.textSecondary },
                      ]}
                      numberOfLines={large ? 3 : 1}
                    >
                      {song.reasons.join(' · ')}
                    </Text>
                  ) : null}
                </View>
              </PressableFeedback>
            ))}
            <View style={styles.actions}>
              <AppPrimaryButton
                label="Usar estos cantos"
                icon="playlist-add"
                onPress={passToSelection}
                disabled={chosen.length === 0}
              />
              <PressableFeedback
                onPress={openFull}
                style={styles.textButton}
                accessibilityRole="button"
                accessibilityLabel="Cambiar algún canto u otro domingo"
              >
                <Text style={[typography.button, { color: roles.link }]}>
                  Cambiar alguno u otro domingo
                </Text>
              </PressableFeedback>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  card: { borderRadius: radii.lg, overflow: 'hidden' },
  head: { padding: spacing.md, gap: spacing.xs },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: radii.pillFull,
    borderWidth: 1,
  },
  flex: { flex: 1 },
  separated: { borderTopWidth: StyleSheet.hairlineWidth },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: TOUCH + spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  note: { padding: spacing.md },
  listLabel: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: TOUCH,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  songRowLarge: { flexDirection: 'column', alignItems: 'stretch' },
  momentCol: { width: MOMENT_COL },
  actions: { padding: spacing.md, gap: spacing.xs },
  textButton: {
    minHeight: TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
