// app/screens/ReviewHistoryScreen.tsx — Historial de revisiones del día
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import { radii, shadows } from '@/constants/uiStyles';
import { useDailyReview } from '@/hooks/useDailyReview';
import type { DailyReview } from '@/hooks/useDailyReview';
import { REVIEW_STEPS } from '@/constants/reviewSteps';

interface Props {
  onClose: () => void;
  onViewReview: (date: string) => void;
}

const REVIEW_COLORS = {
  primary: '#1B3A5C',
  accent: '#D4A843',
  bg: '#F7F9FC',
  bgDark: '#1C1C2E',
  card: '#FFFFFF',
  cardDark: '#2A2A3C',
} as const;

function formatDateLong(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const days = [
    'Domingo', 'Lunes', 'Martes', 'Miércoles',
    'Jueves', 'Viernes', 'Sábado',
  ];
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  return `${days[date.getDay()]}, ${d} de ${months[m - 1]} del ${y}`;
}

function getReviewSummary(review: DailyReview): string[] {
  const items: string[] = [];
  const s = review.steps;
  if (s.gracias_tags?.length) {
    items.push(`Agradecí: ${s.gracias_tags.join(', ')}`);
  }
  if (s.perdon_tags?.length) {
    items.push(`Pedí perdón: ${s.perdon_tags.join(', ')}`);
  }
  if (s.manana_texto) {
    items.push(`Mañana: ${s.manana_texto.substring(0, 60)}${s.manana_texto.length > 60 ? '...' : ''}`);
  }
  if (items.length === 0 && s.presencia) {
    items.push(s.presencia.substring(0, 80) + (s.presencia.length > 80 ? '...' : ''));
  }
  return items;
}

export default function ReviewHistoryScreen({ onClose, onViewReview }: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const { getAllReviewsSorted, loading } = useDailyReview();

  const reviews = useMemo(() => getAllReviewsSorted(), [getAllReviewsSorted]);

  const colors = {
    bg: isDark ? REVIEW_COLORS.bgDark : REVIEW_COLORS.bg,
    card: isDark ? REVIEW_COLORS.cardDark : REVIEW_COLORS.card,
    text: isDark ? '#FFFFFF' : REVIEW_COLORS.primary,
    textSecondary: isDark ? '#A0AEC0' : '#5A6B7D',
    border: isDark ? '#3A3A4C' : '#E8EDF2',
  };

  // Group reviews by month
  const grouped = useMemo(() => {
    const groups: Record<string, DailyReview[]> = {};
    reviews.forEach((r) => {
      const [y, m] = r.date.split('-');
      const key = `${y}-${m}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    return groups;
  }, [reviews]);

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.bg }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} style={s.backButton}>
          <MaterialIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]}>
          Mis revisiones
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={s.emptyState}>
          <Text style={[s.emptyText, { color: colors.textSecondary }]}>
            Cargando…
          </Text>
        </View>
      ) : reviews.length === 0 ? (
        <View style={s.emptyState}>
          <MaterialIcons
            name="auto-stories"
            size={64}
            color={colors.border}
          />
          <Text style={[s.emptyTitle, { color: colors.text }]}>
            Aún no hay revisiones
          </Text>
          <Text style={[s.emptyText, { color: colors.textSecondary }]}>
            Cuando completes tu primera revisión del día, aparecerá aquí.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {Object.entries(grouped).map(([monthKey, monthReviews]) => {
            const [y, m] = monthKey.split('-').map(Number);
            return (
              <View key={monthKey} style={s.monthSection}>
                <Text style={[s.monthTitle, { color: colors.textSecondary }]}>
                  {monthNames[m - 1]} {y}
                </Text>
                {monthReviews.map((review) => {
                  const summary = getReviewSummary(review);
                  return (
                    <TouchableOpacity
                      key={review.date}
                      style={[
                        s.reviewCard,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                        },
                        shadows.sm,
                      ]}
                      onPress={() => onViewReview(review.date)}
                      activeOpacity={0.7}
                    >
                      <View style={s.reviewCardHeader}>
                        <View style={s.reviewDateBadge}>
                          <Text style={s.reviewDateDay}>
                            {review.date.split('-')[2]}
                          </Text>
                        </View>
                        <View style={s.reviewCardInfo}>
                          <Text
                            style={[s.reviewDateText, { color: colors.text }]}
                          >
                            {formatDateLong(review.date)}
                          </Text>
                        </View>
                        <MaterialIcons
                          name="chevron-right"
                          size={22}
                          color={colors.textSecondary}
                        />
                      </View>
                      {summary.length > 0 && (
                        <View style={s.reviewSummary}>
                          {summary.map((item, i) => (
                            <Text
                              key={i}
                              style={[
                                s.reviewSummaryText,
                                { color: colors.textSecondary },
                              ]}
                              numberOfLines={1}
                            >
                              {item}
                            </Text>
                          ))}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: { padding: 4 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  monthSection: {
    marginTop: spacing.lg,
  },
  monthTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    paddingHorizontal: 4,
  },
  reviewCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  reviewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reviewDateBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1B3A5C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewDateDay: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  reviewCardInfo: { flex: 1 },
  reviewDateText: {
    fontSize: 15,
    fontWeight: '500',
  },
  reviewSummary: {
    marginTop: spacing.sm,
    paddingLeft: 52,
    gap: 2,
  },
  reviewSummaryText: {
    fontSize: 13,
    lineHeight: 18,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
