// app/screens/EvangelioScreen.tsx
// Evangelio del Día — lecturas litúrgicas + tracker de lectura
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  ViewStyle,
  TextStyle,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import { radii, shadows } from '@/constants/uiStyles';
import { useDailyReadings } from '@/hooks/useDailyReadings';
import { useLiturgicalInfo } from '@/hooks/useLiturgicalCalendar';
import { useContigoHabits } from '@/hooks/useContigoHabits';
import LiturgicalBadge from '@/components/contigo/LiturgicalBadge';
import ReadingCard from '@/components/contigo/ReadingCard';

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const DAYS_ES = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado',
];

function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAYS_ES[d.getDay()]} ${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`;
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

/** Navigate ±1 day */
function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

type ViewMode = 'lectura' | 'comentario';

export default function EvangelioScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const today = todayISO();
  const [date, setDate] = useState(params.date ?? today);
  const [viewMode, setViewMode] = useState<ViewMode>('lectura');
  const [checkAnim] = useState(new Animated.Value(1));

  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];
  const isDark = scheme === 'dark';

  const { readings, loading, error, available } = useDailyReadings(date);
  const liturgical = useLiturgicalInfo(date);
  const { getRecord, setReadingDone } = useContigoHabits();

  const record = getRecord(date);
  const isRead = record?.readingDone ?? false;

  const evangelio = readings?.evangelio;
  const info = readings?.info;
  const activeSource = evangelio?.activo ?? info?.activo ?? 'vidaNueva';
  const k = activeSource;

  const cita =
    evangelio?.[`${k}Cita` as keyof typeof evangelio] ??
    info?.[`${k}Evangelio` as keyof typeof info] ??
    null;
  const evangelioTexto =
    evangelio?.[`${k}EvangelioTexto` as keyof typeof evangelio] ?? null;
  const comentario =
    evangelio?.[`${k}Comentario` as keyof typeof evangelio] ?? null;
  const comentarista =
    evangelio?.[`${k}Comentarista` as keyof typeof evangelio] ?? null;
  const sourceURL =
    evangelio?.[`${k}URL` as keyof typeof evangelio] ?? null;

  const primeraLectura =
    info?.[`${k}PrimeraLectura` as keyof typeof info] ?? null;
  const segundaLectura =
    info?.[`${k}SegundaLectura` as keyof typeof info] ?? null;
  const salmo = info?.[`${k}Salmo` as keyof typeof info] ?? null;
  const diaLiturgico =
    info?.[`${k}DiaLiturgico` as keyof typeof info] ?? null;

  const isToday = date === today;
  const isPast = date < today;
  const canGoNext = date < today; // don't allow future dates

  const handleToggleRead = useCallback(async () => {
    const newVal = !isRead;
    await setReadingDone(date, newVal);
    if (newVal) {
      // Small bounce animation
      Animated.sequence([
        Animated.timing(checkAnim, {
          toValue: 1.3,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(checkAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isRead, date, setReadingDone, checkAnim]);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
      edges={['top']}
    >
      {/* ── Top navigation bar ── */}
      <View style={[styles.topBar, { borderBottomColor: isDark ? '#ffffff10' : '#00000010' }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialIcons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>

        {/* Date navigator */}
        <View style={styles.dateNav}>
          <TouchableOpacity
            onPress={() => setDate((d) => offsetDate(d, -1))}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons name="chevron-left" size={24} color={theme.icon} />
          </TouchableOpacity>

          <View style={styles.dateTextWrap}>
            <Text style={[styles.dateText, { color: theme.text }]}>
              {isToday ? 'Hoy' : formatDateLong(date)}
            </Text>
            {!isToday && (
              <Text style={[styles.dateSubText, { color: theme.icon }]}>
                {formatDateLong(date)}
              </Text>
            )}
          </View>

          <TouchableOpacity
            onPress={() => canGoNext && setDate((d) => offsetDate(d, 1))}
            disabled={!canGoNext}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons
              name="chevron-right"
              size={24}
              color={canGoNext ? theme.icon : theme.icon + '30'}
            />
          </TouchableOpacity>
        </View>

        <LiturgicalBadge info={liturgical} />
      </View>

      {/* ── Content ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Día litúrgico */}
        {diaLiturgico && (
          <Text style={[styles.diaLiturgico, { color: theme.icon }]}>
            {diaLiturgico as string}
          </Text>
        )}

        {/* Loading state */}
        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.tint} size="large" />
            <Text style={[styles.loadingText, { color: theme.icon }]}>
              Cargando lecturas...
            </Text>
          </View>
        )}

        {/* Error state */}
        {!loading && error && (
          <View style={styles.centered}>
            <MaterialIcons name="wifi-off" size={40} color={theme.icon} style={{ opacity: 0.4 }} />
            <Text style={[styles.errorText, { color: theme.icon }]}>
              No se pudieron cargar las lecturas.
            </Text>
            <Text style={[styles.errorSub, { color: theme.icon }]}>
              Comprueba tu conexión e inténtalo de nuevo.
            </Text>
          </View>
        )}

        {/* No data for this date */}
        {!loading && !error && !available && (
          <View style={styles.centered}>
            <MaterialIcons name="event-busy" size={40} color={theme.icon} style={{ opacity: 0.4 }} />
            <Text style={[styles.errorText, { color: theme.icon }]}>
              Lecturas no disponibles para este día.
            </Text>
            <Text style={[styles.errorSub, { color: theme.icon }]}>
              El comentario del evangelio solo está disponible el día de hoy o días cercanos.
            </Text>
          </View>
        )}

        {/* Readings content */}
        {!loading && !error && available && (
          <>
            {/* Lectura / Comentario switcher */}
            <View style={[styles.switcher, { backgroundColor: isDark ? '#ffffff10' : '#00000008' }]}>
              {(['lectura', 'comentario'] as ViewMode[]).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[
                    styles.switcherTab,
                    viewMode === mode && [
                      styles.switcherTabActive,
                      { backgroundColor: theme.card },
                    ],
                  ]}
                  onPress={() => setViewMode(mode)}
                >
                  <Text
                    style={[
                      styles.switcherText,
                      { color: viewMode === mode ? theme.text : theme.icon },
                      viewMode === mode && { fontWeight: '700' },
                    ]}
                  >
                    {mode === 'lectura' ? 'Lectura' : 'Comentario'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── LECTURA view ── */}
            {viewMode === 'lectura' && (
              <>
                {/* Evangelio — main card */}
                <View
                  style={[
                    styles.evangelioCard,
                    {
                      backgroundColor: theme.card,
                      borderColor: isDark
                        ? 'rgba(255,255,255,0.1)'
                        : 'rgba(0,0,0,0.07)',
                      borderLeftColor: liturgical.color,
                      ...shadows.md,
                    },
                  ]}
                >
                  <Text style={[styles.evangelioLabel, { color: liturgical.color }]}>
                    Evangelio
                  </Text>
                  {cita && (
                    <Text style={[styles.evangelioCita, { color: theme.text }]}>
                      {cita as string}
                    </Text>
                  )}
                  {evangelioTexto && (
                    <Text style={[styles.evangelioTexto, { color: theme.text }]}>
                      {evangelioTexto as string}
                    </Text>
                  )}
                </View>

                {/* Other readings */}
                {primeraLectura && (
                  <ReadingCard
                    title="Primera lectura"
                    citation={primeraLectura as string}
                    accent="#A3BD31"
                  />
                )}
                {salmo && (
                  <ReadingCard
                    title="Salmo"
                    citation={salmo as string}
                    accent="#31AADF"
                  />
                )}
                {segundaLectura && (
                  <ReadingCard
                    title="Segunda lectura"
                    citation={segundaLectura as string}
                    accent="#9D1E74"
                  />
                )}
              </>
            )}

            {/* ── COMENTARIO view ── */}
            {viewMode === 'comentario' && (
              <>
                {comentario ? (
                  <View
                    style={[
                      styles.comentarioCard,
                      {
                        backgroundColor: theme.card,
                        borderColor: isDark
                          ? 'rgba(255,255,255,0.08)'
                          : 'rgba(0,0,0,0.06)',
                        ...shadows.sm,
                      },
                    ]}
                  >
                    <Text style={[styles.comentarioText, { color: theme.text }]}>
                      {comentario as string}
                    </Text>

                    {/* Attribution */}
                    {(comentarista || sourceURL) && (
                      <View
                        style={[
                          styles.attribution,
                          {
                            borderTopColor: isDark
                              ? 'rgba(255,255,255,0.08)'
                              : 'rgba(0,0,0,0.07)',
                          },
                        ]}
                      >
                        {comentarista && (
                          <Text style={[styles.comentarista, { color: theme.icon }]}>
                            Comentario: {comentarista as string}
                          </Text>
                        )}
                        {sourceURL && (
                          <TouchableOpacity
                            onPress={() =>
                              Linking.openURL(sourceURL as string).catch(() => {})
                            }
                          >
                            <Text style={[styles.sourceLink, { color: theme.tint }]}>
                              Ver fuente original →
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.centered}>
                    <Text style={[styles.errorSub, { color: theme.icon }]}>
                      Comentario no disponible para este día.
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* ── Tracker toggle ── */}
            <TouchableOpacity
              style={[
                styles.readToggle,
                {
                  backgroundColor: isRead
                    ? '#4CAF5020'
                    : isDark
                      ? '#ffffff10'
                      : '#00000008',
                  borderColor: isRead ? '#4CAF50' : isDark ? '#ffffff20' : '#00000015',
                },
              ]}
              onPress={handleToggleRead}
              activeOpacity={0.7}
              accessibilityRole="checkbox"
              accessibilityLabel={isRead ? 'Marcar como no leído' : 'Marcar como leído'}
            >
              <Animated.View style={{ transform: [{ scale: checkAnim }] }}>
                <MaterialIcons
                  name={isRead ? 'check-circle' : 'radio-button-unchecked'}
                  size={28}
                  color={isRead ? '#4CAF50' : theme.icon}
                />
              </Animated.View>
              <View style={styles.readToggleText}>
                <Text
                  style={[
                    styles.readToggleTitle,
                    { color: isRead ? '#4CAF50' : theme.text },
                  ]}
                >
                  {isRead ? '¡Leído hoy!' : 'Marcar como leído'}
                </Text>
                <Text style={[styles.readToggleSub, { color: theme.icon }]}>
                  {isRead
                    ? 'Toca para desmarcar'
                    : 'Registra tu lectura del evangelio de hoy'}
                </Text>
              </View>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 } as ViewStyle,

  // ── Top bar ──
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: spacing.sm,
  } as ViewStyle,
  backBtn: {
    padding: 4,
  } as ViewStyle,
  dateNav: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  } as ViewStyle,
  dateTextWrap: {
    alignItems: 'center',
  } as ViewStyle,
  dateText: {
    fontSize: 16,
    fontWeight: '700',
  } as TextStyle,
  dateSubText: {
    fontSize: 11,
    opacity: 0.6,
  } as TextStyle,

  // ── Content ──
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl + 20,
    gap: spacing.sm,
  } as ViewStyle,

  diaLiturgico: {
    fontSize: 12,
    fontStyle: 'italic',
    opacity: 0.7,
  } as TextStyle,

  // ── States ──
  centered: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  } as ViewStyle,
  loadingText: {
    fontSize: 14,
    marginTop: spacing.sm,
  } as TextStyle,
  errorText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  } as TextStyle,
  errorSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    opacity: 0.7,
  } as TextStyle,

  // ── Switcher ──
  switcher: {
    flexDirection: 'row',
    borderRadius: radii.lg,
    padding: 3,
    gap: 2,
  } as ViewStyle,
  switcherTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: radii.md,
  } as ViewStyle,
  switcherTabActive: {
    ...shadows.sm,
  } as ViewStyle,
  switcherText: {
    fontSize: 13,
    fontWeight: '500',
  } as TextStyle,

  // ── Evangelio card ──
  evangelioCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: spacing.md,
    gap: spacing.sm,
  } as ViewStyle,
  evangelioLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  } as TextStyle,
  evangelioCita: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
  } as TextStyle,
  evangelioTexto: {
    fontSize: 15,
    lineHeight: 24,
  } as TextStyle,

  // ── Comentario card ──
  comentarioCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  } as ViewStyle,
  comentarioText: {
    fontSize: 15,
    lineHeight: 24,
  } as TextStyle,
  attribution: {
    borderTopWidth: 1,
    paddingTop: spacing.sm,
    gap: 4,
  } as ViewStyle,
  comentarista: {
    fontSize: 12,
    fontStyle: 'italic',
  } as TextStyle,
  sourceLink: {
    fontSize: 12,
    fontWeight: '600',
  } as TextStyle,

  // ── Read toggle ──
  readToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    padding: spacing.md,
    marginTop: spacing.sm,
  } as ViewStyle,
  readToggleText: {
    flex: 1,
    gap: 2,
  } as ViewStyle,
  readToggleTitle: {
    fontSize: 15,
    fontWeight: '700',
  } as TextStyle,
  readToggleSub: {
    fontSize: 12,
    opacity: 0.7,
  } as TextStyle,
});
