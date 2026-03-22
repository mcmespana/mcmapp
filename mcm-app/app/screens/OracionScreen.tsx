import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  useContigoHabits,
  EMOTION_CONFIG,
  DURATION_CONFIG,
  Emotion,
} from '@/hooks/useContigoHabits';
import PrayerLogger from '@/components/contigo/PrayerLogger';

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateNav(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const days = [
    'Domingo', 'Lunes', 'Martes', 'Miércoles',
    'Jueves', 'Viernes', 'Sábado',
  ];
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  return `${days[d.getDay()]} ${d.getDate()} de ${months[d.getMonth()]}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function OracionScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const todayStr = getTodayStr();

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [isEditing, setIsEditing] = useState(false);

  const {
    getRecord,
    setPrayerDone,
    clearPrayer,
    getStreak,
    getMonthStats,
  } = useContigoHabits();

  const record = getRecord(selectedDate);
  const prayerStreak = getStreak('prayer');

  const now = new Date();
  const monthStats = getMonthStats(now.getFullYear(), now.getMonth() + 1);

  const canGoForward = selectedDate < addDays(todayStr, 30);
  const canGoBack = selectedDate > addDays(todayStr, -30);
  const isToday = selectedDate === todayStr;

  return (
    <SafeAreaView
      style={[
        styles.safe,
        { backgroundColor: isDark ? '#1C1C1E' : '#F8F6F3' },
      ]}
      edges={['bottom']}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Date Navigator ── */}
        <View style={styles.dateNav}>
          <TouchableOpacity
            onPress={() =>
              canGoBack && setSelectedDate(addDays(selectedDate, -1))
            }
            disabled={!canGoBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons
              name="chevron-left"
              size={28}
              color={canGoBack ? '#4CAF50' : '#CCC'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setSelectedDate(todayStr)}
            style={styles.dateCenter}
          >
            <Text
              style={[
                styles.dateText,
                { color: isDark ? '#FFF' : '#1A1A2E' },
              ]}
            >
              {formatDateNav(selectedDate)}
            </Text>
            {!isToday && (
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#4CAF50', marginTop: 2 }}>
                Ir a hoy
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() =>
              canGoForward && setSelectedDate(addDays(selectedDate, 1))
            }
            disabled={!canGoForward}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons
              name="chevron-right"
              size={28}
              color={canGoForward ? '#4CAF50' : '#CCC'}
            />
          </TouchableOpacity>
        </View>

        {/* ── Content ── */}
        {record?.prayerDone && !isEditing ? (
          /* Summary view */
          <View style={styles.summaryContainer}>
            <View
              style={[
                styles.summaryCard,
                { backgroundColor: isDark ? '#2C2C2E' : '#FFF' },
              ]}
            >
              <View style={styles.summaryIcon}>
                <MaterialIcons
                  name="check-circle"
                  size={56}
                  color="#4CAF50"
                />
              </View>
              <Text
                style={[
                  styles.summaryTitle,
                  { color: isDark ? '#FFF' : '#1A1A2E' },
                ]}
              >
                Oración registrada
              </Text>

              <View style={styles.summaryDetails}>
                {record.prayerDuration && (
                  <View style={styles.summaryRow}>
                    <MaterialIcons
                      name="schedule"
                      size={20}
                      color={isDark ? '#888' : '#999'}
                    />
                    <Text
                      style={[
                        styles.summaryValue,
                        { color: isDark ? '#CCC' : '#555' },
                      ]}
                    >
                      {DURATION_CONFIG[record.prayerDuration].label}
                    </Text>
                  </View>
                )}
                {record.prayerEmotion && (
                  <View style={styles.summaryRow}>
                    <MaterialIcons
                      name={EMOTION_CONFIG[record.prayerEmotion].icon as any}
                      size={20}
                      color={EMOTION_CONFIG[record.prayerEmotion].color}
                    />
                    <Text
                      style={[
                        styles.summaryValue,
                        {
                          color:
                            EMOTION_CONFIG[record.prayerEmotion].color,
                        },
                      ]}
                    >
                      {EMOTION_CONFIG[record.prayerEmotion].label}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.summaryActions}>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => setIsEditing(true)}
                >
                  <MaterialIcons name="edit" size={18} color="#666" />
                  <Text style={styles.editBtnText}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.editBtn, { backgroundColor: '#FFF0F0' }]}
                  onPress={() => clearPrayer(selectedDate)}
                >
                  <MaterialIcons name="delete-outline" size={18} color="#E15C62" />
                  <Text style={[styles.editBtnText, { color: '#E15C62' }]}>
                    Borrar
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Streak */}
            {prayerStreak > 0 && (
              <View
                style={[
                  styles.streakCard,
                  { backgroundColor: isDark ? '#2C2C2E' : '#FFF' },
                ]}
              >
                <Text style={styles.streakEmoji}>🔥</Text>
                <Text
                  style={[
                    styles.streakText,
                    { color: isDark ? '#FFF' : '#1A1A2E' },
                  ]}
                >
                  {prayerStreak} {prayerStreak === 1 ? 'día' : 'días'}{' '}
                  seguidos
                </Text>
              </View>
            )}
          </View>
        ) : (
          /* Logger form */
          <View
            style={[
              styles.loggerCard,
              { backgroundColor: isDark ? '#2C2C2E' : '#FFF' },
            ]}
          >
            <PrayerLogger
              onSave={(duration, emotion) => {
                setPrayerDone(selectedDate, duration, emotion);
                setIsEditing(false);
              }}
              onCancel={isEditing ? () => setIsEditing(false) : undefined}
            />
          </View>
        )}

        {/* ── Monthly Stats ── */}
        <View
          style={[
            styles.statsCard,
            { backgroundColor: isDark ? '#2C2C2E' : '#FFF' },
          ]}
        >
          <Text
            style={[
              styles.statsTitle,
              { color: isDark ? '#FFF' : '#1A1A2E' },
            ]}
          >
            Este mes
          </Text>
          <View style={styles.statsGrid}>
            <StatItem
              icon="self-improvement"
              color="#4CAF50"
              value={`${monthStats.prayerDays}`}
              label="días de oración"
              isDark={isDark}
            />
            <StatItem
              icon="schedule"
              color="#F59E0B"
              value={`~${monthStats.totalPrayerMinutes} min`}
              label="tiempo total"
              isDark={isDark}
            />
            <StatItem
              icon={
                monthStats.mostFrequentEmotion
                  ? EMOTION_CONFIG[monthStats.mostFrequentEmotion].icon
                  : 'sentiment-neutral'
              }
              color={
                monthStats.mostFrequentEmotion
                  ? EMOTION_CONFIG[monthStats.mostFrequentEmotion].color
                  : '#999'
              }
              value={
                monthStats.mostFrequentEmotion
                  ? EMOTION_CONFIG[monthStats.mostFrequentEmotion].label
                  : '—'
              }
              label="emoción frecuente"
              isDark={isDark}
            />
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatItem({
  icon,
  color,
  value,
  label,
  isDark,
}: {
  icon: string;
  color: string;
  value: string;
  label: string;
  isDark: boolean;
}) {
  return (
    <View style={statStyles.item}>
      <View style={[statStyles.iconBg, { backgroundColor: color + '15' }]}>
        <MaterialIcons name={icon as any} size={22} color={color} />
      </View>
      <Text
        style={[statStyles.value, { color: isDark ? '#FFF' : '#1A1A2E' }]}
      >
        {value}
      </Text>
      <Text
        style={[statStyles.label, { color: isDark ? '#888' : '#999' }]}
      >
        {label}
      </Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  item: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  iconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  value: {
    fontSize: 15,
    fontWeight: '700',
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
});

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dateCenter: {
    alignItems: 'center',
  },
  dateText: {
    fontSize: 17,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  summaryContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  summaryCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      default: { elevation: 2 },
    }),
  },
  summaryIcon: {
    marginBottom: 8,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  summaryDetails: {
    gap: 10,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  summaryActions: {
    flexDirection: 'row',
    gap: 12,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
      },
      default: { elevation: 1 },
    }),
  },
  streakEmoji: {
    fontSize: 22,
  },
  streakText: {
    fontSize: 16,
    fontWeight: '700',
  },
  loggerCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      default: { elevation: 2 },
    }),
  },
  statsCard: {
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      default: { elevation: 2 },
    }),
  },
  statsTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
