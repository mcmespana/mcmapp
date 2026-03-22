// app/(tabs)/contigo.tsx — Tab "Contigo" con Revisión del Día
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';
import brand from '@/constants/colors';
import spacing from '@/constants/spacing';
import { radii, shadows } from '@/constants/uiStyles';
import { useDailyReview } from '@/hooks/useDailyReview';
import DailyReviewScreen from '../screens/DailyReviewScreen';
import ReviewHistoryScreen from '../screens/ReviewHistoryScreen';
import ReviewDetailScreen from '../screens/ReviewDetailScreen';

const CONTIGO_COLORS = {
  primary: '#1B3A5C',
  primaryLight: '#2A5A8C',
  accent: '#D4A843',
  accentLight: '#F5E6C4',
  warmBg: '#FBF8F3',
  warmBgDark: '#1C1C2E',
  cardBg: '#FFFFFF',
  cardBgDark: '#2A2A3C',
  reviewGradientStart: '#1B3A5C',
  reviewGradientEnd: '#2A5A8C',
} as const;

type Screen =
  | { type: 'home' }
  | { type: 'review'; date?: string }
  | { type: 'history' }
  | { type: 'detail'; date: string };

function getTodayDate(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

function formatTodayShort(): string {
  const d = new Date();
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  return `${days[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]}`;
}

export default function ContigoTab() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const { getReview, getAllReviewsSorted, loading } = useDailyReview();
  const [screen, setScreen] = useState<Screen>({ type: 'home' });

  // Subtle entrance animation
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideUp, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeIn, slideUp]);

  const colors = useMemo(
    () => ({
      bg: isDark ? CONTIGO_COLORS.warmBgDark : CONTIGO_COLORS.warmBg,
      card: isDark ? CONTIGO_COLORS.cardBgDark : CONTIGO_COLORS.cardBg,
      text: isDark ? '#FFFFFF' : CONTIGO_COLORS.primary,
      textSecondary: isDark ? '#A0AEC0' : '#5A6B7D',
      border: isDark ? '#3A3A4C' : '#E8EDF2',
    }),
    [isDark],
  );

  const todayReview = getReview(getTodayDate());
  const recentReviews = useMemo(() => {
    return getAllReviewsSorted().slice(0, 3);
  }, [getAllReviewsSorted]);

  const totalReviews = useMemo(() => {
    return getAllReviewsSorted().length;
  }, [getAllReviewsSorted]);

  // Calculate streak
  const streak = useMemo(() => {
    let count = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      if (getReview(dateStr)) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }, [getReview]);

  const handleGoToReview = useCallback((date?: string) => {
    setScreen({ type: 'review', date });
  }, []);

  const handleGoToHistory = useCallback(() => {
    setScreen({ type: 'history' });
  }, []);

  const handleGoToDetail = useCallback((date: string) => {
    setScreen({ type: 'detail', date });
  }, []);

  const handleGoHome = useCallback(() => {
    setScreen({ type: 'home' });
  }, []);

  // ── Subscreen rendering ──
  if (screen.type === 'review') {
    return (
      <DailyReviewScreen
        onClose={handleGoHome}
        initialDate={screen.date}
      />
    );
  }

  if (screen.type === 'history') {
    return (
      <ReviewHistoryScreen
        onClose={handleGoHome}
        onViewReview={(date) => setScreen({ type: 'detail', date })}
      />
    );
  }

  if (screen.type === 'detail') {
    return (
      <ReviewDetailScreen
        date={screen.date}
        onClose={() => setScreen({ type: 'history' })}
      />
    );
  }

  // ── Home screen ──
  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{
            opacity: fadeIn,
            transform: [{ translateY: slideUp }],
          }}
        >
          {/* Header */}
          <View style={s.header}>
            <Text style={[s.headerTitle, { color: colors.text }]}>
              Contigo
            </Text>
            <Text style={[s.headerSubtitle, { color: colors.textSecondary }]}>
              Propuestas para la oración de cada día
            </Text>
            <Text style={[s.headerDate, { color: CONTIGO_COLORS.accent }]}>
              {formatTodayShort()}
            </Text>
          </View>

          {/* Main CTA — Revisión del Día */}
          <TouchableOpacity
            style={[s.reviewCard, shadows.md]}
            onPress={() => handleGoToReview()}
            activeOpacity={0.85}
          >
            <View style={s.reviewCardContent}>
              <View style={s.reviewCardIcon}>
                <MaterialIcons name="visibility" size={32} color="#FFFFFF" />
              </View>
              <View style={s.reviewCardText}>
                <Text style={s.reviewCardTitle}>Revisión del día</Text>
                <Text style={s.reviewCardSubtitle}>
                  {todayReview
                    ? 'Ya has hecho tu revisión de hoy'
                    : 'Dedica unos minutos a revisar tu día'}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#FFFFFF80" />
            </View>
            {todayReview && (
              <View style={s.reviewCardBadge}>
                <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
                <Text style={s.reviewCardBadgeText}>Completada</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Stats row */}
          {totalReviews > 0 && (
            <View style={s.statsRow}>
              <View
                style={[
                  s.statCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  shadows.sm,
                ]}
              >
                <Text style={[s.statNumber, { color: CONTIGO_COLORS.accent }]}>
                  {streak}
                </Text>
                <Text style={[s.statLabel, { color: colors.textSecondary }]}>
                  {streak === 1 ? 'día seguido' : 'días seguidos'}
                </Text>
              </View>
              <View
                style={[
                  s.statCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  shadows.sm,
                ]}
              >
                <Text style={[s.statNumber, { color: CONTIGO_COLORS.accent }]}>
                  {totalReviews}
                </Text>
                <Text style={[s.statLabel, { color: colors.textSecondary }]}>
                  {totalReviews === 1 ? 'revisión' : 'revisiones'}
                </Text>
              </View>
            </View>
          )}

          {/* Quick explanation card */}
          <View
            style={[
              s.infoCard,
              { backgroundColor: colors.card, borderColor: colors.border },
              shadows.sm,
            ]}
          >
            <View style={s.infoCardHeader}>
              <MaterialIcons
                name="info-outline"
                size={20}
                color={CONTIGO_COLORS.accent}
              />
              <Text style={[s.infoCardTitle, { color: colors.text }]}>
                ¿Qué es la Revisión del día?
              </Text>
            </View>
            <Text style={[s.infoCardText, { color: colors.textSecondary }]}>
              Una práctica de la tradición ignaciana para revisar el día desde el
              amor de Dios. Cinco pasos guiados por frases de María Rosa Molas
              te invitan a dar gracias, pedir perdón, y preparar el mañana.
            </Text>
          </View>

          {/* Recent reviews */}
          {recentReviews.length > 0 && (
            <View style={s.recentSection}>
              <View style={s.recentHeader}>
                <Text style={[s.recentTitle, { color: colors.text }]}>
                  Revisiones recientes
                </Text>
                <TouchableOpacity onPress={handleGoToHistory}>
                  <Text style={[s.recentSeeAll, { color: CONTIGO_COLORS.accent }]}>
                    Ver todas
                  </Text>
                </TouchableOpacity>
              </View>
              {recentReviews.map((review) => {
                const [, m, d] = review.date.split('-').map(Number);
                const months = [
                  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
                  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
                ];
                const summary =
                  review.steps.gracias_tags?.join(', ') ||
                  review.steps.presencia?.substring(0, 40) ||
                  'Revisión completada';
                return (
                  <TouchableOpacity
                    key={review.date}
                    style={[
                      s.recentCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => handleGoToDetail(review.date)}
                    activeOpacity={0.7}
                  >
                    <View style={s.recentDateBadge}>
                      <Text style={s.recentDateDay}>{d}</Text>
                      <Text style={s.recentDateMonth}>{months[m - 1]}</Text>
                    </View>
                    <Text
                      style={[s.recentCardText, { color: colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {summary}
                    </Text>
                    <MaterialIcons
                      name="chevron-right"
                      size={20}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Music section placeholder */}
          <TouchableOpacity
            style={[
              s.musicCard,
              { borderColor: CONTIGO_COLORS.accent + '40' },
            ]}
            activeOpacity={0.7}
            onPress={() => {
              // Future: Open Spotify playlist
            }}
          >
            <MaterialIcons
              name="music-note"
              size={24}
              color={CONTIGO_COLORS.accent}
            />
            <View style={s.musicCardText}>
              <Text style={[s.musicCardTitle, { color: colors.text }]}>
                Música para orar
              </Text>
              <Text
                style={[s.musicCardSubtitle, { color: colors.textSecondary }]}
              >
                Próximamente
              </Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl * 2,
  },

  // ── Header ──
  header: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  headerDate: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: spacing.sm,
  },

  // ── Review card (main CTA) ──
  reviewCard: {
    backgroundColor: CONTIGO_COLORS.primary,
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  reviewCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  reviewCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewCardText: { flex: 1 },
  reviewCardTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  reviewCardSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  reviewCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  reviewCardBadgeText: {
    color: '#4CAF50',
    fontSize: 13,
    fontWeight: '500',
  },

  // ── Stats ──
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },

  // ── Info card ──
  infoCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  infoCardTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  infoCardText: {
    fontSize: 14,
    lineHeight: 21,
  },

  // ── Recent reviews ──
  recentSection: {
    marginBottom: spacing.lg,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  recentTitle: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  recentSeeAll: {
    fontSize: 14,
    fontWeight: '500',
  },
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.sm + 2,
    marginBottom: spacing.xs,
    gap: 12,
  },
  recentDateBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: CONTIGO_COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentDateDay: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 18,
  },
  recentDateMonth: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  recentCardText: {
    flex: 1,
    fontSize: 14,
  },

  // ── Music card ──
  musicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: spacing.md,
  },
  musicCardText: { flex: 1 },
  musicCardTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  musicCardSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});
