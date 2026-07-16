import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import BottomSheet from '@/components/BottomSheet';
import { useColorScheme } from '@/hooks/useColorScheme';
import { warm, buildCalendar, WEEKDAYS, MONTHS_CAP } from './theme';
import { hasHighlights, type StoredBookmark } from '@/utils/contigoBookmarks';
import { HIGHLIGHT_COLORS } from '@/utils/highlightRanges';
import { hexAlpha } from '@/utils/colorUtils';
import { h } from '@/utils/haptics';

interface ReadingCalendarSheetProps {
  visible: boolean;
  onClose: () => void;
  selectedDate: string;
  todayStr: string;
  onSelectDate: (date: string) => void;
  /** Fechas con lectura en Firebase. null = aún no se sabe (no bloquear). */
  availableDates: Set<string> | null;
  bookmarks: StoredBookmark[];
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Calendario de evangelios: navega por meses, marca los días con lectura
 * disponible, los guardados y los subrayados, y salta a la fecha elegida.
 */
export function ReadingCalendarSheet({
  visible,
  onClose,
  selectedDate,
  todayStr,
  onSelectDate,
  availableDates,
  bookmarks,
}: ReadingCalendarSheetProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const W = warm(isDark);

  // Mes visible (YYYY-MM); arranca en el mes de la fecha seleccionada.
  const [monthKey, setMonthKey] = useState(() => selectedDate.slice(0, 7));
  const slide = useRef(new Animated.Value(0)).current;

  // Re-centrar el mes al abrir.
  const wasVisible = useRef(false);
  if (visible && !wasVisible.current) {
    const target = selectedDate.slice(0, 7);
    if (target !== monthKey) setMonthKey(target);
  }
  wasVisible.current = visible;

  const bookmarkedSet = useMemo(
    () => new Set(bookmarks.map((b) => b.date)),
    [bookmarks],
  );
  const highlightedSet = useMemo(
    () => new Set(bookmarks.filter((b) => hasHighlights(b)).map((b) => b.date)),
    [bookmarks],
  );

  const [yearStr, monthStr] = monthKey.split('-');
  const { cells, year, month } = useMemo(
    () => buildCalendar(`${yearStr}-${monthStr}-01`),
    [yearStr, monthStr],
  );

  const changeMonth = (delta: number) => {
    h.select();
    const d = new Date(year, month - 1 + delta, 1);
    setMonthKey(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
    // Pequeño deslizamiento direccional al cambiar de mes.
    slide.setValue(delta * 26);
    Animated.spring(slide, {
      toValue: 0,
      useNativeDriver: Platform.OS !== 'web',
      tension: 90,
      friction: 12,
    }).start();
  };

  const roseDot = HIGHLIGHT_COLORS.rose.swatch;

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Calendario">
      <View style={styles.container}>
        {/* ── Cabecera de mes ── */}
        <View style={styles.monthHeader}>
          <TouchableOpacity
            onPress={() => changeMonth(-1)}
            style={[styles.navBtn, { backgroundColor: W.accentLight }]}
            accessibilityLabel="Mes anterior"
          >
            <MaterialIcons name="chevron-left" size={24} color={W.accent} />
          </TouchableOpacity>
          <Text style={[styles.monthTitle, { color: W.text }]}>
            {MONTHS_CAP[month - 1]} {year}
          </Text>
          <TouchableOpacity
            onPress={() => changeMonth(1)}
            style={[styles.navBtn, { backgroundColor: W.accentLight }]}
            accessibilityLabel="Mes siguiente"
          >
            <MaterialIcons name="chevron-right" size={24} color={W.accent} />
          </TouchableOpacity>
        </View>

        {/* ── Días de la semana ── */}
        <View style={styles.weekRow}>
          {WEEKDAYS.map((d, i) => (
            <Text key={i} style={[styles.weekday, { color: W.textMuted }]}>
              {d}
            </Text>
          ))}
        </View>

        {/* ── Rejilla ── */}
        <Animated.View
          style={[styles.grid, { transform: [{ translateX: slide }] }]}
        >
          {cells.map((day, i) => {
            if (day === null) {
              return <View key={`e${i}`} style={styles.cell} />;
            }
            const ds = `${year}-${pad(month)}-${pad(day)}`;
            const isSelected = ds === selectedDate;
            const isToday = ds === todayStr;
            const isBookmarked = bookmarkedSet.has(ds);
            const isHighlighted = highlightedSet.has(ds);
            const isAvailable =
              availableDates === null || availableDates.has(ds) || isBookmarked;

            return (
              <View key={ds} style={styles.cell}>
                <TouchableOpacity
                  disabled={!isAvailable}
                  onPress={() => {
                    h.navigate();
                    onSelectDate(ds);
                    onClose();
                  }}
                  style={[
                    styles.dayBtn,
                    isBookmarked && {
                      backgroundColor: hexAlpha(W.accent, isDark ? '26' : '1E'),
                    },
                    isToday && { borderWidth: 1.5, borderColor: W.accent },
                    isSelected && { backgroundColor: W.accent },
                    !isAvailable && styles.dayDisabled,
                  ]}
                  accessibilityLabel={`Día ${day}`}
                  accessibilityState={{
                    selected: isSelected,
                    disabled: !isAvailable,
                  }}
                >
                  <Text
                    style={[
                      styles.dayText,
                      { color: isSelected ? '#FFFFFF' : W.text },
                      isToday && !isSelected && { color: W.accent },
                    ]}
                  >
                    {day}
                  </Text>
                  <View style={styles.dotRow}>
                    {isAvailable && availableDates !== null ? (
                      <View
                        style={[
                          styles.dot,
                          {
                            backgroundColor: isSelected
                              ? 'rgba(255,255,255,0.9)'
                              : W.accent,
                          },
                        ]}
                      />
                    ) : null}
                    {isHighlighted ? (
                      <View
                        style={[styles.dot, { backgroundColor: roseDot }]}
                      />
                    ) : null}
                  </View>
                </TouchableOpacity>
              </View>
            );
          })}
        </Animated.View>

        {/* ── Leyenda ── */}
        <View style={[styles.legend, { borderTopColor: W.border }]}>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: W.accent }]} />
            <Text style={[styles.legendText, { color: W.textSec }]}>
              Con lectura
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View
              style={[
                styles.legendSquare,
                { backgroundColor: hexAlpha(W.accent, isDark ? '26' : '1E') },
              ]}
            />
            <Text style={[styles.legendText, { color: W.textSec }]}>
              Guardado
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: roseDot }]} />
            <Text style={[styles.legendText, { color: W.textSec }]}>
              Subrayado
            </Text>
          </View>
        </View>

        {/* ── Hoy ── */}
        <TouchableOpacity
          onPress={() => {
            h.navigate();
            onSelectDate(todayStr);
            onClose();
          }}
          style={[styles.todayBtn, { backgroundColor: W.accentLight }]}
        >
          <MaterialIcons name="today" size={16} color={W.accent} />
          <Text style={[styles.todayText, { color: W.accent }]}>Ir a hoy</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingBottom: 28,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginBottom: 14,
  },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    textTransform: 'capitalize',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 2,
  },
  dayBtn: {
    width: 40,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 3,
  },
  dayDisabled: {
    opacity: 0.28,
  },
  dayText: {
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  dotRow: {
    flexDirection: 'row',
    gap: 3,
    height: 5,
    marginTop: 3,
    alignItems: 'center',
  },
  dot: {
    width: 4.5,
    height: 4.5,
    borderRadius: 3,
  },
  legendSquare: {
    width: 11,
    height: 11,
    borderRadius: 4,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 18,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
  },
  todayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
  },
  todayText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
