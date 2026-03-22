// app/screens/ReviewDetailScreen.tsx — Ver detalle de una revisión pasada
import React from 'react';
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
import spacing from '@/constants/spacing';
import { radii, shadows } from '@/constants/uiStyles';
import { useDailyReview } from '@/hooks/useDailyReview';
import { REVIEW_STEPS } from '@/constants/reviewSteps';

interface Props {
  date: string;
  onClose: () => void;
}

const COLORS = {
  primary: '#1B3A5C',
  accent: '#D4A843',
  bg: '#F7F9FC',
  bgDark: '#1C1C2E',
  card: '#FFFFFF',
  cardDark: '#2A2A3C',
};

function formatDateLong(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  return `${d} de ${months[m - 1]} del ${y}`;
}

export default function ReviewDetailScreen({ date, onClose }: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const { getReview } = useDailyReview();
  const review = getReview(date);

  const colors = {
    bg: isDark ? COLORS.bgDark : COLORS.bg,
    card: isDark ? COLORS.cardDark : COLORS.card,
    text: isDark ? '#FFFFFF' : COLORS.primary,
    textSecondary: isDark ? '#A0AEC0' : '#5A6B7D',
    border: isDark ? '#3A3A4C' : '#E8EDF2',
    tagBg: isDark ? '#3A3A4C' : '#EDF2F7',
  };

  if (!review) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.bg }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose}>
            <MaterialIcons name="chevron-left" size={28} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={s.emptyState}>
          <Text style={[s.emptyText, { color: colors.textSecondary }]}>
            No se encontró la revisión
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const steps = review.steps;
  const sections: { title: string; quote: string; icon: string; content: React.ReactNode }[] = [];

  // Step 1
  if (steps.presencia) {
    sections.push({
      title: REVIEW_STEPS[0].title,
      quote: REVIEW_STEPS[0].quote,
      icon: REVIEW_STEPS[0].icon,
      content: <Text style={[s.sectionText, { color: colors.text }]}>{steps.presencia}</Text>,
    });
  }

  // Step 2
  if (steps.gracias_tags?.length || steps.gracias_texto) {
    sections.push({
      title: REVIEW_STEPS[1].title,
      quote: REVIEW_STEPS[1].quote,
      icon: REVIEW_STEPS[1].icon,
      content: (
        <View>
          {steps.gracias_tags?.length ? (
            <View style={s.tagsRow}>
              {steps.gracias_tags.map((tag) => (
                <View key={tag} style={[s.tag, { backgroundColor: colors.tagBg }]}>
                  <Text style={[s.tagText, { color: colors.text }]}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {steps.gracias_texto ? (
            <Text style={[s.sectionText, { color: colors.text }]}>{steps.gracias_texto}</Text>
          ) : null}
        </View>
      ),
    });
  }

  // Step 3
  if (steps.perdon_tags?.length || steps.perdon_texto) {
    sections.push({
      title: REVIEW_STEPS[2].title,
      quote: REVIEW_STEPS[2].quote,
      icon: REVIEW_STEPS[2].icon,
      content: (
        <View>
          {steps.perdon_tags?.length ? (
            <View style={s.tagsRow}>
              {steps.perdon_tags.map((tag) => (
                <View key={tag} style={[s.tag, { backgroundColor: colors.tagBg }]}>
                  <Text style={[s.tagText, { color: colors.text }]}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {steps.perdon_texto ? (
            <Text style={[s.sectionText, { color: colors.text }]}>{steps.perdon_texto}</Text>
          ) : null}
        </View>
      ),
    });
  }

  // Step 4
  if (steps.conocimiento_texto) {
    sections.push({
      title: REVIEW_STEPS[3].title,
      quote: REVIEW_STEPS[3].quote,
      icon: REVIEW_STEPS[3].icon,
      content: <Text style={[s.sectionText, { color: colors.text }]}>{steps.conocimiento_texto}</Text>,
    });
  }

  // Step 5
  if (steps.manana_texto) {
    sections.push({
      title: REVIEW_STEPS[4].title,
      quote: REVIEW_STEPS[4].quote,
      icon: REVIEW_STEPS[4].icon,
      content: <Text style={[s.sectionText, { color: colors.text }]}>{steps.manana_texto}</Text>,
    });
  }

  // Closing
  if (steps.cierre_texto) {
    sections.push({
      title: 'Cierre',
      quote: '',
      icon: 'auto-awesome',
      content: <Text style={[s.sectionText, { color: colors.text }]}>{steps.cierre_texto}</Text>,
    });
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.bg }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} style={s.backBtn}>
          <MaterialIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]}>
          {formatDateLong(date)}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {sections.map((section, idx) => (
          <View
            key={idx}
            style={[
              s.sectionCard,
              { backgroundColor: colors.card, borderColor: colors.border },
              shadows.sm,
            ]}
          >
            <View style={s.sectionHeader}>
              <MaterialIcons
                name={section.icon as any}
                size={22}
                color={COLORS.accent}
              />
              <Text style={[s.sectionTitle, { color: colors.text }]}>
                {section.title}
              </Text>
            </View>
            {section.quote ? (
              <Text style={[s.sectionQuote, { color: COLORS.accent }]}>
                {section.quote}
              </Text>
            ) : null}
            {section.content}
          </View>
        ))}
      </ScrollView>
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
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  sectionCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionQuote: {
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  sectionText: {
    fontSize: 15,
    lineHeight: 22,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.sm,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
});
