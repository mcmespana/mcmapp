/**
 * «Tu año en Contigo»: lo que has rezado, leído y subrayado en un año, mes a
 * mes, con una tarjeta para compartir. Todo sale de lo que ya guarda Contigo
 * en el móvil (`utils/contigoRecap.ts`); no se calcula nada en ningún
 * servidor.
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { PressableFeedback } from 'heroui-native';
import ShareCardSheet from '@/components/contigo/ShareCardSheet';
import {
  contigoHeaderChrome,
  useContigoHeaderInset,
} from '@/components/contigo/headerChrome';
import { warm } from '@/components/contigo/theme';
import { useTabScroll } from '@/components/tabs/useTabScroll';
import AppPrimaryButton from '@/components/ui/AppPrimaryButton';
import EmptyState from '@/components/ui/EmptyState';
import { MaterialIcons } from '@/components/ui/icons';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { useContigoHabits } from '@/hooks/useContigoHabits';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useReaderBookmarks } from '@/hooks/useReaderBookmarks';
import { MONTH_NAMES, SOURCE_LABELS } from '@/utils/contigoExport';
import { buildRecap, formatCount, recapYears } from '@/utils/contigoRecap';
import { h } from '@/utils/haptics';
import { highlightBg } from '@/utils/highlightRanges';
import { recapCardSpec } from '@/utils/shareCard';

const CELL = 9;
const CELL_GAP = 3;

export default function ContigoRecapScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const W = warm(isDark);
  const headerInset = useContigoHeaderInset();
  const { scrollRef, onScroll, contentPaddingBottom } = useTabScroll('contigo');
  const { width } = useWindowDimensions();
  const { records, todayStr } = useContigoHabits();
  const { bookmarks } = useReaderBookmarks();

  const thisYear =
    Number((todayStr || '').slice(0, 4)) || new Date().getFullYear();
  const years = useMemo(
    () => recapYears(records, bookmarks, thisYear),
    [records, bookmarks, thisYear],
  );
  const [year, setYear] = useState(thisYear);
  const [open, setOpen] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);

  const recap = useMemo(
    () => buildRecap(records, bookmarks, year),
    [records, bookmarks, year],
  );
  const empty = recap.activeDays === 0 && recap.highlights === 0;
  const yi = years.indexOf(year);

  const stats = [
    { value: formatCount(recap.activeDays), label: 'días contigo' },
    { value: formatCount(recap.longestStreak), label: 'días seguidos' },
    { value: formatCount(recap.prayerMinutes), label: 'minutos de oración' },
    { value: formatCount(recap.highlights), label: 'frases subrayadas' },
  ];
  const levelColor = [W.border, W.accentMid, W.accent, W.accentText];
  const firstPhrase = recap.months.flatMap((m) => m.highlights)[0];

  return (
    <View style={styles.flex}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Tu año',
          headerTransparent: true,
          headerBackButtonDisplayMode: 'minimal',
          headerShadowVisible: false,
          headerTintColor: W.text,
          headerTitleStyle: { color: W.text, fontWeight: '700', fontSize: 17 },
          ...contigoHeaderChrome(isDark),
        }}
      />
      <LinearGradient colors={W.bgGradient} style={StyleSheet.absoluteFill} />
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerInset, paddingBottom: contentPaddingBottom },
          width >= 720 && styles.wide,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Año */}
        <View style={styles.yearRow}>
          <YearArrow
            icon="chevron-left"
            label="Año anterior"
            disabled={yi < 0 || yi >= years.length - 1}
            onPress={() => {
              setOpen(null);
              setYear(years[yi + 1]);
            }}
            color={W.textSec}
          />
          <Text
            style={[styles.year, { color: W.text }]}
            accessibilityRole="header"
          >
            {year}
          </Text>
          <YearArrow
            icon="chevron-right"
            label="Año siguiente"
            disabled={yi <= 0}
            onPress={() => {
              setOpen(null);
              setYear(years[yi - 1]);
            }}
            color={W.textSec}
          />
        </View>

        {empty ? (
          <EmptyState
            icon="auto-stories"
            title="Aún no hay nada este año"
            subtitle="Lo que leas, reces y subrayes irá apareciendo aquí."
            accentColor={W.accentText}
            titleColor={W.text}
            subtitleColor={W.textSec}
          />
        ) : (
          <>
            {/* Cifras */}
            <View style={[styles.card, { backgroundColor: W.bgCard }]}>
              {stats.map((s, i) => (
                <View
                  key={s.label}
                  style={[
                    styles.stat,
                    i > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: W.border,
                    },
                  ]}
                  accessible
                  accessibilityLabel={`${s.value} ${s.label}`}
                >
                  <Text style={[styles.statLabel, { color: W.textSec }]}>
                    {s.label}
                  </Text>
                  <Text style={[styles.statValue, { color: W.text }]}>
                    {s.value}
                  </Text>
                </View>
              ))}
            </View>

            {/* Meses */}
            <Text style={[styles.section, { color: W.textSec }]}>
              Mes a mes
            </Text>
            <View style={[styles.card, { backgroundColor: W.bgCard }]}>
              {recap.months.map((mo, i) => {
                const future =
                  year === thisYear &&
                  mo.month > Number((todayStr || '').slice(5, 7)) - 1;
                if (future) return null;
                const expanded = open === mo.month;
                const can = mo.highlights.length > 0;
                return (
                  <View
                    key={mo.month}
                    style={
                      i > 0 && {
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: W.border,
                      }
                    }
                  >
                    <PressableFeedback
                      onPress={() => {
                        if (!can) return;
                        h.select();
                        setOpen(expanded ? null : mo.month);
                      }}
                      style={styles.month}
                      accessibilityRole={can ? 'button' : 'text'}
                      accessibilityState={can ? { expanded } : undefined}
                      accessibilityLabel={`${MONTH_NAMES[mo.month]}: ${mo.activeDays} días, ${mo.highlights.length} frases subrayadas`}
                    >
                      <View style={styles.monthHead}>
                        <Text style={[styles.monthName, { color: W.text }]}>
                          {MONTH_NAMES[mo.month]}
                        </Text>
                        <Text style={[styles.monthMeta, { color: W.textSec }]}>
                          {mo.activeDays > 0 ? `${mo.activeDays} días` : '—'}
                          {can ? ` · ${mo.highlights.length} frases` : ''}
                        </Text>
                        {can && (
                          <MaterialIcons
                            name={expanded ? 'expand-less' : 'expand-more'}
                            size={20}
                            color={W.textMuted}
                          />
                        )}
                      </View>
                      <View style={styles.cells}>
                        {mo.days.map((lv, d) => (
                          <View
                            key={d}
                            style={[
                              styles.cell,
                              { backgroundColor: levelColor[lv] },
                            ]}
                          />
                        ))}
                      </View>
                    </PressableFeedback>
                    {expanded &&
                      mo.highlights.map((hl, k) => (
                        <PressableFeedback
                          key={`${hl.date}-${k}`}
                          onPress={() =>
                            router.push({
                              pathname: '/(tabs)/contigo/evangelio',
                              params: { date: hl.date },
                            })
                          }
                          style={styles.phrase}
                          accessibilityRole="button"
                          accessibilityHint="Abre las lecturas de ese día"
                        >
                          <Text style={[styles.phraseText, { color: W.text }]}>
                            <Text
                              style={
                                hl.color && {
                                  backgroundColor: highlightBg(
                                    hl.color,
                                    isDark,
                                  ),
                                }
                              }
                            >
                              {hl.text}
                            </Text>
                          </Text>
                          <Text
                            style={[styles.phraseMeta, { color: W.textSec }]}
                          >
                            {Number(hl.date.slice(8, 10))} de{' '}
                            {MONTH_NAMES[mo.month]} · {SOURCE_LABELS[hl.source]}
                          </Text>
                        </PressableFeedback>
                      ))}
                  </View>
                );
              })}
            </View>

            <AppPrimaryButton
              label="Compartir mi año"
              icon="ios-share"
              color={W.accent}
              onPress={() => setSharing(true)}
              style={styles.share}
            />
          </>
        )}
      </Animated.ScrollView>

      <ShareCardSheet
        visible={sharing}
        onClose={() => setSharing(false)}
        title="Compartir mi año"
        fileName={`contigo-${year}.png`}
        color={firstPhrase?.color}
        build={(style, format) =>
          recapCardSpec({
            year,
            stats,
            phrase: firstPhrase?.text,
            months: recap.months.map((m) => m.activeDays / m.days.length),
            color: firstPhrase?.color,
            style,
            format,
          })
        }
      />
    </View>
  );
}

function YearArrow({
  icon,
  label,
  disabled,
  onPress,
  color,
}: {
  icon: 'chevron-left' | 'chevron-right';
  label: string;
  disabled: boolean;
  onPress: () => void;
  color: string;
}) {
  return (
    <PressableFeedback
      onPress={() => {
        h.select();
        onPress();
      }}
      isDisabled={disabled}
      style={[styles.yearArrow, disabled && styles.off]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <MaterialIcons name={icon} size={28} color={color} />
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.md, gap: spacing.md },
  wide: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  year: {
    ...typography.display,
    fontFamily: typography.serif.fontFamily,
    fontVariant: ['tabular-nums'],
  },
  yearArrow: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  off: { opacity: 0.25 },
  card: { borderRadius: radii.xl, overflow: 'hidden' },
  stat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - spacing.xs,
  },
  statLabel: { ...typography.body },
  statValue: {
    ...typography.h1,
    fontFamily: typography.serif.fontFamily,
    fontVariant: ['tabular-nums'],
  },
  section: { ...typography.sectionLabel, marginTop: spacing.sm },
  month: { padding: spacing.md, gap: spacing.sm },
  monthHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  monthName: { ...typography.title, textTransform: 'capitalize', flex: 1 },
  monthMeta: { ...typography.caption },
  cells: { flexDirection: 'row', flexWrap: 'wrap', gap: CELL_GAP },
  cell: { width: CELL, height: CELL, borderRadius: CELL_GAP },
  phrase: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  phraseText: {
    ...typography.body,
    fontFamily: typography.serif.fontFamily,
    lineHeight: 24,
  },
  phraseMeta: { ...typography.footnote },
  share: { marginTop: spacing.sm },
});
