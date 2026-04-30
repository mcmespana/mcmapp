import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import {
  HABITS,
  HabitKey,
  WEEKDAYS,
  buildCalendar,
  getWeekDates,
  habitColor,
  warm,
} from './theme';
import type { DayRecord } from '@/hooks/useContigoHabits';

// ─────────────────────────────────────────────────────────────────────────────
// ProgressRing — pure-View dotted ring (no SVG dependency, works everywhere)
// ─────────────────────────────────────────────────────────────────────────────
export function ProgressRing({
  done,
  total = 3,
  size = 96,
  stroke = 8,
}: {
  done: number;
  total?: number;
  size?: number;
  stroke?: number;
}) {
  // 48 dots packed densely around the circle look like a smooth ring at this size,
  // and avoid the native-svg dependency that crashes on iOS dev clients without pods.
  const N = 48;
  const pct = total === 0 ? 0 : done / total;
  const filled = Math.round(pct * N);
  const dotSize = Math.max(3, Math.round(stroke * 0.65));
  const radius = (size - dotSize) / 2 - 1;
  const cx = size / 2;
  const cy = size / 2;
  const color =
    done === total && total > 0
      ? '#6DBF7E'
      : done >= 2
        ? '#F97316'
        : done === 1
          ? '#FB923C'
          : 'rgba(255,255,255,0.22)';
  const trackColor = 'rgba(255,255,255,0.10)';

  return (
    <View style={{ width: size, height: size }}>
      {Array.from({ length: N }).map((_, i) => {
        const a = (i / N) * Math.PI * 2 - Math.PI / 2;
        const x = cx + radius * Math.cos(a) - dotSize / 2;
        const y = cy + radius * Math.sin(a) - dotSize / 2;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: i < filled ? color : trackColor,
            }}
          />
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HeroCard — gradient hero with progress ring + motivation + chips
// ─────────────────────────────────────────────────────────────────────────────
export function HeroCard({
  doneCount,
  prayStreak,
  totalMins,
  isDark,
}: {
  doneCount: number;
  prayStreak: number;
  totalMins: number;
  isDark: boolean;
}) {
  const motivs = [
    'Empieza el día con Dios',
    'Sigue, lo estás haciendo genial',
    '¡Casi lo tienes!',
    '¡Día completo! 🎉',
  ];
  const motiv = motivs[Math.min(doneCount, motivs.length - 1)];

  return (
    <View style={styles.heroOuter}>
      <View style={styles.heroClip}>
        <LinearGradient
          colors={
            isDark
              ? (['#2D2316', '#3D2E18', '#4A3820'] as const)
              : (['#2A1E0A', '#3D2E1A', '#5C4430'] as const)
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroGrad}
        >
          <View style={styles.heroRow}>
            <View style={styles.heroRing}>
              <ProgressRing done={doneCount} total={3} size={96} stroke={8} />
              <View style={styles.heroRingCenter} pointerEvents="none">
                <Text style={styles.heroRingNum}>
                  {doneCount}
                  <Text style={styles.heroRingNumSm}>/3</Text>
                </Text>
                <Text style={styles.heroRingLabel}>HOY</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>{motiv}</Text>
              <Text style={styles.heroSubtitle}>
                {doneCount < 3
                  ? `${3 - doneCount} práctica${3 - doneCount > 1 ? 's' : ''} por completar`
                  : '¡Todo completado por hoy!'}
              </Text>
              <View style={styles.heroChips}>
                <View style={styles.heroChip}>
                  <Text style={styles.heroChipEmoji}>🔥</Text>
                  <Text style={styles.heroChipText}>{prayStreak} días</Text>
                </View>
                <View style={styles.heroChip}>
                  <Text style={styles.heroChipEmoji}>⏱</Text>
                  <Text style={styles.heroChipText}>{totalMins} min</Text>
                </View>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HabitTile — three coloured tiles for evangelio · oración · revisión
// ─────────────────────────────────────────────────────────────────────────────
export function HabitTile({
  habitKey,
  done,
  onPress,
  isDark,
}: {
  habitKey: HabitKey;
  done: boolean;
  onPress: () => void;
  isDark: boolean;
}) {
  const h = HABITS[habitKey];
  const accent = habitColor(habitKey, isDark);
  const W = warm(isDark);

  const inner = (
    <View style={styles.tileContent}>
      <MaterialIcons
        name={h.icon as any}
        size={26}
        color={done ? '#fff' : accent}
      />
      <Text
        style={[
          styles.tileLabel,
          { color: done ? 'rgba(255,255,255,0.94)' : W.textSec },
        ]}
        numberOfLines={1}
      >
        {h.label}
      </Text>
    </View>
  );

  const checkBadge = done ? (
    <View style={styles.tileCheck}>
      <MaterialIcons name="check" size={11} color="#fff" />
    </View>
  ) : null;

  if (done) {
    return (
      <View style={[styles.tileWrap, { shadowColor: accent }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onPress}
          style={styles.tileClip}
        >
          <LinearGradient
            colors={h.grad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.tileGrad}
          >
            {inner}
          </LinearGradient>
        </TouchableOpacity>
        {checkBadge}
      </View>
    );
  }
  return (
    <View style={styles.tileWrap}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        style={[
          styles.tileClip,
          styles.tileWrapEmpty,
          {
            backgroundColor: isDark ? '#26221C' : '#FFFFFF',
            borderColor: accent + '40',
          },
        ]}
      >
        {inner}
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EvangelioTeaserCard — top accent bar, title, fade-out preview + CTA + chip
// ─────────────────────────────────────────────────────────────────────────────
export function EvangelioTeaserCard({
  titulo,
  cita,
  texto,
  readingDone,
  onOpen,
  isDark,
}: {
  titulo?: string;
  cita?: string;
  texto?: string;
  readingDone: boolean;
  onOpen: () => void;
  isDark: boolean;
}) {
  const W = warm(isDark);
  const preview = (texto || '').replace(/\n+/g, ' ').trim();
  return (
    <View style={[styles.teaser, { shadowColor: W.shadow }]}>
      <View
        style={[
          styles.teaserClip,
          {
            borderColor: isDark
              ? 'rgba(218,165,32,0.15)'
              : 'rgba(196,146,42,0.18)',
            backgroundColor: isDark ? '#26221C' : '#FFFDF7',
          },
        ]}
      >
        <LinearGradient
          colors={['#E8A838', '#C4922A', '#9A6A1A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.teaserBar}
        />
        <View style={styles.teaserBody}>
          <View style={styles.teaserHeaderRow}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={[styles.teaserKicker, { color: W.accent }]}>
                EVANGELIO DEL DÍA
              </Text>
              <Text
                style={[styles.teaserTitle, { color: W.text }]}
                numberOfLines={2}
              >
                {titulo || 'Palabra de hoy'}
              </Text>
            </View>
            {cita ? (
              <View
                style={[
                  styles.teaserCita,
                  {
                    backgroundColor: isDark
                      ? 'rgba(218,165,32,0.12)'
                      : 'rgba(196,146,42,0.10)',
                  },
                ]}
              >
                <Text style={[styles.teaserCitaText, { color: W.accent }]}>
                  {cita}
                </Text>
              </View>
            ) : null}
          </View>

          {preview ? (
            <View style={styles.teaserPreviewWrap}>
              <Text
                style={[styles.teaserPreview, { color: W.text }]}
                numberOfLines={3}
              >
                {preview}
              </Text>
              {/* Fade uses same-tone transparent→opaque so it interpolates as
                  a gentle softening, not a gray band. */}
              <LinearGradient
                colors={
                  isDark
                    ? (['rgba(38,34,28,0)', 'rgba(38,34,28,0.95)'] as const)
                    : ([
                        'rgba(255,253,247,0)',
                        'rgba(255,253,247,0.95)',
                      ] as const)
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.teaserFade}
                pointerEvents="none"
              />
            </View>
          ) : null}

          <View style={styles.teaserActions}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onOpen}
              style={[
                styles.teaserCta,
                {
                  backgroundColor: isDark
                    ? 'rgba(218,165,32,0.10)'
                    : 'rgba(196,146,42,0.09)',
                },
              ]}
            >
              <Text style={[styles.teaserCtaText, { color: W.accent }]}>
                Leer evangelio →
              </Text>
            </TouchableOpacity>
            {readingDone ? (
              <View
                style={[styles.teaserDone, { backgroundColor: W.greenLight }]}
              >
                <MaterialIcons name="check" size={12} color={W.green} />
                <Text style={[styles.teaserDoneText, { color: W.green }]}>
                  Leído hoy
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WeekStrip — current ISO week Mon–Sun w/ habit dots
// ─────────────────────────────────────────────────────────────────────────────
export function WeekStrip({
  records,
  todayStr,
  isDark,
}: {
  records: Record<string, DayRecord>;
  todayStr: string;
  isDark: boolean;
}) {
  const W = warm(isDark);
  const week = getWeekDates(todayStr);
  return (
    <View>
      <View style={styles.weekRow}>
        {week.map((ds, i) => {
          const rec = records[ds];
          const isToday = ds === todayStr;
          const isFuture = ds > todayStr;
          const rd = !!rec?.readingDone;
          const pd = !!rec?.prayerDone;
          const rv = !!rec?.revisionDone;
          const all = rd && pd && rv;
          const day = parseInt(ds.split('-')[2], 10);

          let dotsBg: string = isFuture
            ? 'rgba(0,0,0,0)'
            : isDark
              ? 'rgba(255,255,255,0.05)'
              : 'rgba(0,0,0,0.04)';
          if (all) dotsBg = isDark ? '#6DBF7E35' : '#3A7D4430';
          else if (rd && pd)
            dotsBg = isDark ? 'rgba(218,165,32,0.22)' : 'rgba(196,146,42,0.18)';
          else if (rd && rv)
            dotsBg = isDark ? 'rgba(96,165,250,0.18)' : 'rgba(37,99,235,0.12)';
          else if (pd && rv)
            dotsBg = isDark
              ? 'rgba(167,139,250,0.18)'
              : 'rgba(124,58,237,0.12)';
          else if (rd)
            dotsBg = isDark ? 'rgba(96,165,250,0.14)' : 'rgba(37,99,235,0.09)';
          else if (pd)
            dotsBg = isDark ? 'rgba(218,165,32,0.14)' : 'rgba(196,146,42,0.10)';
          else if (rv)
            dotsBg = isDark
              ? 'rgba(167,139,250,0.14)'
              : 'rgba(124,58,237,0.09)';

          return (
            <View key={ds} style={styles.weekCol}>
              <Text
                style={[
                  styles.weekHdr,
                  { color: isToday ? W.accent : W.textMuted },
                ]}
              >
                {WEEKDAYS[i]}
              </Text>
              <View
                style={[
                  styles.weekTile,
                  {
                    backgroundColor: dotsBg,
                    borderColor: isToday ? W.accent : 'transparent',
                    opacity: isFuture ? 0.25 : 1,
                  },
                ]}
              >
                {!isFuture && all ? (
                  <Text style={{ fontSize: 13 }}>✦</Text>
                ) : null}
              </View>
              <Text
                style={[
                  styles.weekDay,
                  {
                    color: isToday ? W.accent : W.textMuted,
                    fontWeight: isToday ? '800' : '400',
                  },
                ]}
              >
                {day}
              </Text>
              <View style={styles.weekDots}>
                <View
                  style={[
                    styles.weekDot,
                    {
                      backgroundColor:
                        !isFuture && rd
                          ? habitColor('evangelio', isDark)
                          : isDark
                            ? 'rgba(255,255,255,0.08)'
                            : 'rgba(0,0,0,0.07)',
                    },
                  ]}
                />
                <View
                  style={[
                    styles.weekDot,
                    {
                      backgroundColor:
                        !isFuture && pd
                          ? habitColor('oracion', isDark)
                          : isDark
                            ? 'rgba(255,255,255,0.08)'
                            : 'rgba(0,0,0,0.07)',
                    },
                  ]}
                />
                <View
                  style={[
                    styles.weekDot,
                    {
                      backgroundColor:
                        !isFuture && rv
                          ? habitColor('revision', isDark)
                          : isDark
                            ? 'rgba(255,255,255,0.08)'
                            : 'rgba(0,0,0,0.07)',
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
      <View style={styles.weekLegend}>
        {(
          [
            { key: 'evangelio' as HabitKey, label: 'Evangelio' },
            { key: 'oracion' as HabitKey, label: 'Oración' },
            { key: 'revision' as HabitKey, label: 'Revisión' },
          ] as const
        ).map(({ key, label }) => (
          <View key={key} style={styles.weekLegendItem}>
            <View
              style={[
                styles.weekLegendDot,
                { backgroundColor: habitColor(key, isDark) + '80' },
              ]}
            />
            <Text style={[styles.weekLegendText, { color: W.textMuted }]}>
              {label}
            </Text>
          </View>
        ))}
        <View style={styles.weekLegendItem}>
          <Text style={[styles.weekLegendStar, { color: W.green }]}>✦</Text>
          <Text style={[styles.weekLegendText, { color: W.textMuted }]}>
            Los 3
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatCard
// ─────────────────────────────────────────────────────────────────────────────
export function StatCard({
  icon,
  value,
  label,
  color,
  isDark,
}: {
  icon: string;
  value: string | number;
  label: string;
  color?: string;
  isDark: boolean;
}) {
  const W = warm(isDark);
  return (
    <View
      style={[
        styles.statCard,
        {
          backgroundColor: W.bgCard,
          borderColor: W.border,
          shadowColor: W.shadow,
        },
      ]}
    >
      <Text style={styles.statIcon}>{icon}</Text>
      <Text
        style={[styles.statValue, { color: color || W.text }]}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: W.textMuted }]}>{label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MonthHeatmap — full-month calendar coloured by habit completion
// ─────────────────────────────────────────────────────────────────────────────
const EMOTION_HEAT: Record<string, string> = {
  joy: '#FDE68A',
  sadness: '#BFDBFE',
  anger: '#FECACA',
  fear: '#E9D5FF',
  disgust: '#BBF7D0',
};

export function MonthHeatmap({
  records,
  todayStr,
  isDark,
  onDayPress,
}: {
  records: Record<string, DayRecord>;
  todayStr: string;
  isDark: boolean;
  onDayPress?: (date: string, rec: DayRecord | null) => void;
}) {
  const W = warm(isDark);
  const { cells, year, month } = buildCalendar(todayStr);
  return (
    <View>
      <View style={styles.heatmapHdr}>
        {WEEKDAYS.map((d) => (
          <Text key={d} style={[styles.heatmapHdrText, { color: W.textMuted }]}>
            {d}
          </Text>
        ))}
      </View>
      <View style={styles.heatmapGrid}>
        {cells.map((day, idx) => {
          if (day === null) {
            return <View key={`e${idx}`} style={styles.heatmapCellWrap} />;
          }
          const ds = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const rec = records[ds];
          const isToday = ds === todayStr;
          const isFuture = ds > todayStr;
          const rd = !!rec?.readingDone;
          const pd = !!rec?.prayerDone;
          const rv = !!rec?.revisionDone;
          const doneCount = (rd ? 1 : 0) + (pd ? 1 : 0) + (rv ? 1 : 0);
          const emoColor = rec?.prayerEmotion
            ? EMOTION_HEAT[rec.prayerEmotion]
            : null;
          let bg: string = isDark
            ? 'rgba(255,255,255,0.03)'
            : 'rgba(0,0,0,0.025)';
          if (doneCount === 3)
            bg = isDark ? 'rgba(109,191,126,0.32)' : 'rgba(58,125,68,0.22)';
          else if (doneCount === 2)
            bg =
              emoColor && pd
                ? isDark
                  ? emoColor + '40'
                  : emoColor + '80'
                : isDark
                  ? 'rgba(218,165,32,0.30)'
                  : 'rgba(196,146,42,0.22)';
          else if (rd)
            bg = isDark ? 'rgba(96,165,250,0.20)' : 'rgba(37,99,235,0.14)';
          else if (pd)
            bg = isDark ? 'rgba(218,165,32,0.18)' : 'rgba(196,146,42,0.14)';
          else if (rv)
            bg = isDark ? 'rgba(167,139,250,0.20)' : 'rgba(124,58,237,0.14)';
          if (isFuture) bg = 'transparent';
          const tappable = !!onDayPress && !isFuture && doneCount > 0;
          const inner = (
            <View
              style={[
                styles.heatmapCell,
                {
                  backgroundColor: bg,
                  borderColor: isToday ? W.accent : 'transparent',
                  opacity: isFuture ? 0.3 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.heatmapDay,
                  {
                    color: isToday
                      ? W.accent
                      : rd || pd || rv
                        ? W.text
                        : W.textMuted,
                    fontWeight: isToday || rd || pd || rv ? '700' : '500',
                  },
                ]}
              >
                {day}
              </Text>
            </View>
          );
          return (
            <View key={ds} style={styles.heatmapCellWrap}>
              {tappable ? (
                <TouchableOpacity
                  activeOpacity={0.6}
                  onPress={() => onDayPress!(ds, rec || null)}
                  style={{ flex: 1 }}
                  accessibilityLabel={`Ver registro del ${day}`}
                >
                  {inner}
                </TouchableOpacity>
              ) : (
                inner
              )}
            </View>
          );
        })}
      </View>
      <View style={styles.heatmapLegend}>
        <View style={styles.weekLegendItem}>
          <View
            style={[
              styles.weekLegendDot,
              {
                backgroundColor: isDark
                  ? 'rgba(96,165,250,0.25)'
                  : 'rgba(37,99,235,0.15)',
              },
            ]}
          />
          <Text style={[styles.weekLegendText, { color: W.textMuted }]}>
            Evangelio
          </Text>
        </View>
        <View style={styles.weekLegendItem}>
          <View
            style={[
              styles.weekLegendDot,
              {
                backgroundColor: isDark
                  ? 'rgba(218,165,32,0.32)'
                  : 'rgba(196,146,42,0.22)',
              },
            ]}
          />
          <Text style={[styles.weekLegendText, { color: W.textMuted }]}>
            Oración
          </Text>
        </View>
        <View style={styles.weekLegendItem}>
          <View
            style={[
              styles.weekLegendDot,
              {
                backgroundColor: isDark
                  ? 'rgba(167,139,250,0.25)'
                  : 'rgba(124,58,237,0.15)',
              },
            ]}
          />
          <Text style={[styles.weekLegendText, { color: W.textMuted }]}>
            Revisión
          </Text>
        </View>
        <View style={styles.weekLegendItem}>
          <View
            style={[
              styles.weekLegendDot,
              {
                backgroundColor: isDark
                  ? 'rgba(109,191,126,0.32)'
                  : 'rgba(58,125,68,0.28)',
              },
            ]}
          />
          <Text style={[styles.weekLegendText, { color: W.textMuted }]}>
            Los 3
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Hero — outer carries the shadow, inner clips the gradient corners.
  heroOuter: {
    borderRadius: 28,
    backgroundColor: 'transparent',
    ...Platform.select({
      ios: {
        shadowColor: '#3D2E1A',
        shadowOpacity: 0.35,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 6 },
      web: { boxShadow: '0 10px 40px rgba(61,46,26,0.35)' as any },
    }),
  },
  heroClip: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  heroGrad: { padding: 22, minHeight: 138 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  heroRing: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroRingCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroRingNum: {
    fontSize: 26,
    fontWeight: '900',
    color: 'white',
    letterSpacing: -1,
    lineHeight: 28,
  },
  heroRingNumSm: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
  },
  heroRingLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  heroTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: 'white',
    letterSpacing: -0.3,
    marginBottom: 5,
  },
  heroSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 16,
    marginBottom: 12,
  },
  heroChips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  heroChipEmoji: { fontSize: 11 },
  heroChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
  },

  // Tile — shadow on outer wrapper, overflow clip on inner.
  tileWrap: {
    flex: 1,
    minHeight: 92,
    borderRadius: 22,
    backgroundColor: 'transparent',
    ...Platform.select({
      ios: {
        shadowOpacity: 0.25,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 4 },
      web: { boxShadow: '0 6px 20px rgba(0,0,0,0.18)' as any },
    }),
  },
  tileClip: {
    flex: 1,
    minHeight: 92,
    borderRadius: 22,
    overflow: 'hidden',
  },
  tileWrapEmpty: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tileContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  tileCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
  },

  // Teaser — outer holds shadow, inner clips border + bar.
  teaser: {
    borderRadius: 22,
    backgroundColor: 'transparent',
    ...Platform.select({
      ios: {
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 2 },
    }),
  },
  teaserClip: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
  },
  teaserBar: { height: 3 },
  teaserBody: { padding: 16 },
  teaserHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  teaserKicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  teaserTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 20,
  },
  teaserCita: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  teaserCitaText: { fontSize: 12, fontWeight: '800' },
  teaserPreviewWrap: { position: 'relative', marginBottom: 14 },
  teaserPreview: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'Palatino' : 'serif',
  },
  teaserFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 36,
  },
  teaserActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teaserCta: {
    flex: 1,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teaserCtaText: { fontSize: 12, fontWeight: '700' },
  teaserDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
    marginLeft: 8,
  },
  teaserDoneText: { fontSize: 11, fontWeight: '700' },

  // Week
  weekRow: { flexDirection: 'row', gap: 4 },
  weekCol: { flex: 1, alignItems: 'center', gap: 4 },
  weekHdr: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  weekTile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDay: { fontSize: 10 },
  weekDots: { flexDirection: 'row', gap: 2 },
  weekDot: { width: 4, height: 4, borderRadius: 2 },
  weekLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 12,
  },
  weekLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  weekLegendDot: { width: 8, height: 8, borderRadius: 2 },
  weekLegendStar: { fontSize: 10 },
  weekLegendText: { fontSize: 10, fontWeight: '500' },

  // Stat
  statCard: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowOpacity: 0.1,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 1 },
    }),
  },
  statIcon: { fontSize: 20, marginBottom: 3 },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
    textAlign: 'center',
    textTransform: 'uppercase',
    lineHeight: 13,
  },

  // Heatmap
  heatmapHdr: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingHorizontal: 3,
  },
  heatmapHdrText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  heatmapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  heatmapCellWrap: {
    width: `${100 / 7}%`,
    padding: 3,
  },
  heatmapCell: {
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  heatmapDay: { fontSize: 12, letterSpacing: -0.2 },
  heatmapLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 10,
  },
});
