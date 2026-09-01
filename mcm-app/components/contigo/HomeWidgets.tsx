import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import {
  HABITS,
  HabitKey,
  WEEKDAYS,
  buildCalendar,
  getRollingDays,
  habitColor,
  warm,
  weekdayLetter,
  WARM_DARK,
  WARM_LIGHT,
} from './theme';
import type { DayRecord } from '@/hooks/useContigoHabits';
import { styles } from '@/components/contigo/homeWidgetsStyles';

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
      ? WARM_DARK.green
      : done >= 2
        ? '#F97316'
        : done === 1
          ? WARM_DARK.fire
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
    '¿Cuándo empeazmos?',
    '¿Buscamos un ratito más?',
    '¡Casi un día completo!',
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
                  ? `${3 - doneCount} momento${3 - doneCount > 1 ? 's' : ''} que puedes hacer`
                  : '¡Todo completado por hoy!'}
              </Text>
              <View style={styles.heroChips}>
                <View style={styles.heroChip}>
                  <Text style={styles.heroChipEmoji}>🔥</Text>
                  <Text style={styles.heroChipText}>{prayStreak} días</Text>
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
//            Eliminado un trocito
//               <View style={styles.heroChip}>
//                  <Text style={styles.heroChipEmoji}>⏱</Text>
//                  <Text style={styles.heroChipText}>{totalMins} min</Text>
//                </View>
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
            backgroundColor: isDark ? WARM_DARK.bgCard : '#FFFFFF',
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
            backgroundColor: isDark ? WARM_DARK.bgCard : '#FFFDF7',
          },
        ]}
      >
        <LinearGradient
          colors={['#E8A838', WARM_LIGHT.accent, '#9A6A1A']}
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
// WeekStrip — ventana móvil de los últimos 7 días (hoy el último), con puntos
// por hábito. Cada día es pulsable y abre lo que haya guardado.
// ─────────────────────────────────────────────────────────────────────────────
export function WeekStrip({
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
  // Últimos 7 días, NO de lunes a domingo: así el lunes por la mañana la tira
  // no aparece vacía y siempre se ve la semana real que llevas.
  const week = getRollingDays(todayStr, 7);
  return (
    <View>
      <View style={styles.weekRow}>
        {week.map((ds) => {
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

          const tappable = !!onDayPress && !isFuture;

          return (
            <TouchableOpacity
              key={ds}
              style={styles.weekCol}
              activeOpacity={tappable ? 0.6 : 1}
              disabled={!tappable}
              onPress={() => onDayPress?.(ds, rec || null)}
              accessibilityRole={tappable ? 'button' : undefined}
              accessibilityLabel={
                tappable ? `Ver el día ${day}` : `Día ${day}, aún por llegar`
              }
            >
              <Text
                style={[
                  styles.weekHdr,
                  { color: isToday ? W.accent : W.textMuted },
                ]}
              >
                {weekdayLetter(ds)}
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
            </TouchableOpacity>
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
  monthDate,
  isDark,
  onDayPress,
}: {
  records: Record<string, DayRecord>;
  todayStr: string;
  /** Día cualquiera del mes que se pinta. Por defecto, el mes de hoy. */
  monthDate?: string;
  isDark: boolean;
  onDayPress?: (date: string, rec: DayRecord | null) => void;
}) {
  const W = warm(isDark);
  const { cells, year, month } = buildCalendar(monthDate || todayStr);
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
          // Cualquier día se puede abrir, también los que aún no han llegado:
          // las lecturas se publican con antelación y se puede rezar el
          // evangelio de mañana. Si ese día todavía no tiene texto, la pantalla
          // del evangelio lo dice y ofrece volver a hoy.
          const tappable = !!onDayPress;
          const inner = (
            <View
              style={[
                styles.heatmapCell,
                {
                  backgroundColor: bg,
                  borderColor: isToday ? W.accent : 'transparent',
                  // Los días que no han llegado se ven apagados, pero no tan
                  // apagados como para parecer desactivados: se pueden abrir.
                  opacity: isFuture ? 0.55 : 1,
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
