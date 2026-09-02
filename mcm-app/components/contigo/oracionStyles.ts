/**
 * Estilos de `app/(tabs)/contigo/oracion.tsx`.
 *
 * Extraídos tal cual, sin tocar ni un valor: eran 297 líneas de las
 * 1189 del fichero. Mismo patrón que `components/grupos/gruposStyles.ts`.
 */
import { StyleSheet } from 'react-native';
import { radii, shadows } from '@/constants/uiStyles';
import typography from '@/constants/typography';

export const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    zIndex: 50,
    borderBottomWidth: 1,
  },
  frostedBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },

  // Scroll
  scrollContent: {},

  // Date nav
  dateNavCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 20,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: radii.xl,
    borderWidth: 1,
    ...shadows.card,
  },
  navBtn: {
    padding: 10,
    borderRadius: 14,
  },
  dateCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  dateText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    textTransform: 'capitalize',
    textAlign: 'center',
  },

  // Completed banner
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: 8,
  },
  completedText: {
    ...typography.caption,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },

  // Sections container
  sectionsStack: {
    paddingHorizontal: 16,
    gap: 12,
  },

  // Section card
  sectionCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: 20,
    ...shadows.card,
  },
  sectionLabel: {
    ...typography.micro,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 18,
  },

  // Emotions
  emotionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  emotionItem: {
    alignItems: 'center',
    gap: 8,
  },
  emotionDimmed: { opacity: 0.38 },
  emotionCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emotionLabel: {
    ...typography.micro,
    letterSpacing: 0.1,
  },

  // Duration buckets
  bucketGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  bucketPill: {
    paddingHorizontal: 17,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: '30%',
    alignItems: 'center',
  },
  bucketText: {
    ...typography.subhead,
    letterSpacing: -0.1,
  },

  // Custom duration card
  customCard: {
    marginTop: 16,
    borderRadius: radii.lg,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
  },
  customLabel: {
    ...typography.micro,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 18,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 28,
  },
  stepperBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  stepperNumber: {
    fontSize: 60,
    fontWeight: '800',
    lineHeight: 68,
    letterSpacing: -2,
  },
  stepperUnit: {
    fontSize: 18,
    fontWeight: '600',
  },

  // Save button
  saveBtnWrap: {
    borderRadius: 100,
    minHeight: 56,
  },
  saveBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 17,
    gap: 10,
    width: '100%',
    borderRadius: 100,
  },
  saveBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 17,
    gap: 10,
    width: '100%',
    borderRadius: 100,
  },
  saveBtnText: {
    ...typography.body,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  // Calendar
  calHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  calMonthTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginTop: 2,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 100,
    marginTop: 2,
  },
  statText: {
    ...typography.footnote,
    fontWeight: '700',
  },
  weekdayRow: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 6,
  },
  weekdayCell: {
    alignItems: 'center',
  },
  weekdayText: {
    ...typography.micro,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 20,
  },
  calCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDay: {
    ...typography.footnote,
  },
  calDayDone: {
    ...typography.footnote,
  },

  // Legend
  legendWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    ...typography.footnote,
    fontWeight: '500',
  },
});
