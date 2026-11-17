/**
 * Las lecturas del próximo domingo, para leerlas antes de elegir los cantos,
 * y debajo los cantos del cantoral cuya letra tiene palabras en común
 * (`utils/sundayMatch.ts`: sin IA, solo palabras). Cada canto enseña las
 * palabras que coinciden y se añade a la playlist con un toque.
 */
import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import BottomSheet from '@/components/BottomSheet';
import { MaterialIcons } from '@/components/ui/icons';
import { SwipeColors, themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useDailyReadings } from '@/hooks/useDailyReadings';
import { h } from '@/utils/haptics';
import { cleanSongTitle } from '@/utils/songUtils';
import { matchSongs, nextSundayIso } from '@/utils/sundayMatch';

interface SongLite {
  title: string;
  filename: string;
  author?: string;
  content?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  songsData: Record<
    string,
    { categoryTitle: string; songs: SongLite[] }
  > | null;
  isSelected: (filename: string) => boolean;
  onAdd: (filename: string) => void;
  onRemove: (filename: string) => void;
  /** Domingo a leer (`YYYY-MM-DD`); por defecto, el próximo. */
  date?: string;
  /** Sin la lista de cantos: solo las lecturas (desde «Este domingo»). */
  readingsOnly?: boolean;
}

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export default function SundayReadingsSheet(props: Props) {
  return (
    <BottomSheet
      visible={props.visible}
      onClose={props.onClose}
      title="Lecturas del domingo"
      paddingHorizontal={0}
    >
      {props.visible ? <Content {...props} /> : null}
    </BottomSheet>
  );
}

function Content({
  songsData,
  isSelected,
  onAdd,
  onRemove,
  date: dateProp,
  readingsOnly,
}: Props) {
  const isDark = useColorScheme() === 'dark';
  const theme = themeColors(isDark);
  const date = useMemo(() => dateProp ?? nextSundayIso(), [dateProp]);
  const { readings, isLoading } = useDailyReadings(date);
  const [open, setOpen] = useState<string | null>('evangelio');

  const [, month, day] = date.split('-').map(Number);
  const dateLabel = `${day} de ${MONTHS[month - 1]}`;

  const parts = useMemo(
    () =>
      [
        { id: 'lectura1', label: 'Primera lectura', r: readings?.lectura1 },
        { id: 'salmo', label: 'Salmo', r: readings?.salmo },
        { id: 'lectura2', label: 'Segunda lectura', r: readings?.lectura2 },
        { id: 'evangelio', label: 'Evangelio', r: readings?.evangelio },
      ].filter((p) => !!p.r?.texto),
    [readings],
  );

  const songs = useMemo(() => {
    const seen = new Set<string>();
    const out: (SongLite & { content: string })[] = [];
    for (const cat of Object.values(songsData ?? {})) {
      for (const s of cat?.songs ?? []) {
        if (!s?.filename || seen.has(s.filename)) continue;
        seen.add(s.filename);
        out.push({ ...s, content: s.content ?? '' });
      }
    }
    return out;
  }, [songsData]);

  const matches = useMemo(() => {
    if (!parts.length || readingsOnly) return [];
    const weight = (id: string) =>
      id === 'evangelio' ? 1.5 : id === 'salmo' ? 1.3 : 1;
    const found = matchSongs(
      parts.map((p) => ({ text: p.r!.texto, weight: weight(p.id) })),
      songs,
    );
    const byFile = new Map(songs.map((s) => [s.filename, s]));
    return found.map((m) => ({ ...m, song: byFile.get(m.filename)! }));
  }, [parts, songs, readingsOnly]);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.date, { color: theme.textSecondary }]}>
        {dateLabel}
        {readings?.info?.titulo ? ` · ${readings.info.titulo}` : ''}
      </Text>

      {isLoading && !readings ? (
        <Text style={[styles.empty, { color: theme.textSecondary }]}>
          Cargando las lecturas…
        </Text>
      ) : !parts.length ? (
        <Text style={[styles.empty, { color: theme.textSecondary }]}>
          Las lecturas de ese domingo aún no están disponibles.
        </Text>
      ) : (
        <View
          style={[styles.group, { backgroundColor: theme.backgroundSunken }]}
        >
          {parts.map((p, i) => {
            const expanded = open === p.id;
            return (
              <View
                key={p.id}
                style={
                  i > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: theme.separator,
                  }
                }
              >
                <PressableFeedback
                  onPress={() => {
                    h.select();
                    setOpen(expanded ? null : p.id);
                  }}
                  style={styles.partHeader}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                >
                  <View style={styles.partTitles}>
                    <Text style={[styles.partLabel, { color: theme.text }]}>
                      {p.label}
                    </Text>
                    {!!p.r?.cita && (
                      <Text
                        style={[
                          styles.partCita,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {p.r.cita}
                      </Text>
                    )}
                  </View>
                  <MaterialIcons
                    name={expanded ? 'expand-less' : 'expand-more'}
                    size={22}
                    color={theme.textMuted}
                  />
                </PressableFeedback>
                {expanded && (
                  <Text
                    style={[styles.partText, { color: theme.text }]}
                    selectable
                  >
                    {p.r!.texto.trim()}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      )}

      {parts.length > 0 && !readingsOnly && (
        <>
          <Text style={[styles.section, { color: theme.textSecondary }]}>
            Cantos con palabras en común
          </Text>
          {matches.length === 0 ? (
            <Text style={[styles.empty, { color: theme.textSecondary }]}>
              Ningún canto del cantoral coincide lo bastante.
            </Text>
          ) : (
            <View
              style={[
                styles.group,
                { backgroundColor: theme.backgroundSunken },
              ]}
            >
              {matches.map((m, i) => {
                const selected = isSelected(m.filename);
                return (
                  <View
                    key={m.filename}
                    style={[
                      styles.match,
                      i > 0 && {
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: theme.separator,
                      },
                    ]}
                  >
                    <View style={styles.matchInfo}>
                      <Text
                        style={[styles.matchTitle, { color: theme.text }]}
                        numberOfLines={1}
                      >
                        {cleanSongTitle(m.song.title)}
                      </Text>
                      <Text
                        style={[
                          styles.matchWords,
                          { color: theme.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        {m.words.join(' · ')}
                      </Text>
                    </View>
                    <PressableFeedback
                      onPress={() => {
                        if (selected) {
                          h.remove();
                          onRemove(m.filename);
                        } else {
                          h.add();
                          onAdd(m.filename);
                        }
                      }}
                      style={styles.add}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={
                        selected
                          ? `Quitar ${m.song.title} de la playlist`
                          : `Añadir ${m.song.title} a la playlist`
                      }
                    >
                      <MaterialIcons
                        name={selected ? 'check-circle' : 'add-circle-outline'}
                        size={26}
                        color={selected ? SwipeColors.add : theme.link}
                      />
                    </PressableFeedback>
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  date: { ...typography.subhead },
  empty: { ...typography.body, paddingVertical: spacing.md },
  group: { borderRadius: radii.lg, overflow: 'hidden' },
  partHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  partTitles: { flex: 1 },
  partLabel: { ...typography.title },
  partCita: { ...typography.caption, marginTop: 2 },
  partText: {
    ...typography.body,
    lineHeight: 25,
    fontFamily: Platform.OS === 'ios' ? 'Palatino' : 'serif',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  section: { ...typography.sectionLabel, marginTop: spacing.sm },
  match: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    minHeight: 56,
    gap: spacing.sm,
  },
  matchInfo: { flex: 1, paddingVertical: spacing.sm },
  matchTitle: { ...typography.title },
  matchWords: { ...typography.caption, marginTop: 2 },
  add: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
