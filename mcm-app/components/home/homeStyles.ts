/**
 * Estilos de `app/(tabs)/index.tsx`.
 *
 * Extraídos tal cual, sin tocar ni un valor: eran 395 líneas de las
 * 1729 del fichero. Mismo patrón que `components/grupos/gruposStyles.ts`.
 */
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import colors from '@/constants/colors';
import spacing from '@/constants/spacing';
import { radii, shadows } from '@/constants/uiStyles';

export const styles = StyleSheet.create({
  safeArea: { flex: 1 } as ViewStyle,

  // ── Header ──
  headerWide: {
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  } as ViewStyle,
  logoBox: {
    backgroundColor: colors.primary,
    padding: spacing.sm,
    borderRadius: radii.sm + 2, // 10
  } as ViewStyle,
  logoText: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1.4,
    lineHeight: 38,
  } as TextStyle,
  headerIconBtn: { padding: spacing.sm } as ViewStyle,
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  } as ViewStyle,
  bellWrap: { position: 'relative' } as ViewStyle,
  dotWrap: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  dotPing: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  } as ViewStyle,
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.primary,
  } as ViewStyle,

  // ── ScrollView ──
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl,
  } as ViewStyle,
  scrollContentWide: {
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: spacing.lg,
  } as ViewStyle,

  // ── Responsive columns ──
  wideRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  } as ViewStyle,
  wideColLeft: {
    flex: 1,
  } as ViewStyle,
  wideColRight: {
    flex: 1,
  } as ViewStyle,

  section: { marginBottom: spacing.lg + 4 } as ViewStyle,
  sectionLabel: {
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  } as TextStyle,

  // ── Notification card ──
  notifCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.md + 2,
    ...shadows.md,
  } as ViewStyle,
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 2,
  } as ViewStyle,
  notifContent: {
    flex: 1,
    gap: 5,
  } as ViewStyle,
  newBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  } as ViewStyle,
  newBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  } as TextStyle,
  notifTitle: {
    fontWeight: '700',
    lineHeight: 22,
  } as TextStyle,
  notifDescription: {
    lineHeight: 19,
  } as TextStyle,
  notifIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginTop: 2,
  } as ViewStyle,
  notifCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.sm + 2,
    flexWrap: 'wrap',
  } as ViewStyle,
  destinationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
  } as ViewStyle,
  destinationChipText: {
    fontSize: 10,
    fontWeight: '700',
  } as TextStyle,
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
  } as ViewStyle,
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  } as TextStyle,
  arrowPill: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,

  // ── Quick grid ──
  quickGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  } as ViewStyle,
  // En ancho (iPad) los accesos rápidos se agrupan centrados y envuelven en
  // varias filas en vez de separarse a los extremos de la columna.
  quickGridWide: {
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.lg,
  } as ViewStyle,
  quickItem: {
    alignItems: 'center',
    gap: 7,
    width: 70,
  } as ViewStyle,
  quickIconCircle: {
    width: 56,
    height: 56,
    borderRadius: radii.full,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  quickLabel: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'center',
  } as TextStyle,

  // ── Event cards ──
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: spacing.sm + 4,
    marginBottom: spacing.sm,
    ...shadows.sm,
  } as ViewStyle,
  eventDateBox: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
    flexShrink: 0,
  } as ViewStyle,
  eventMonth: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  } as TextStyle,
  eventDay: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  } as TextStyle,
  eventInfo: {
    flex: 1,
    overflow: 'hidden',
    gap: 3,
  } as ViewStyle,
  eventTitle: {
    fontWeight: '700',
  } as TextStyle,
  calBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: radii.xs,
    alignSelf: 'flex-start',
    maxWidth: 110,
  } as ViewStyle,
  calBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  } as TextStyle,
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  } as ViewStyle,
  eventMetaText: { flex: 1 } as TextStyle,
  eventsSkeletonWrap: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  } as ViewStyle,
  eventSkeleton: {
    height: 78,
    borderRadius: radii.lg,
  } as ViewStyle,
  weekSeparator: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing.sm + 2,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
    opacity: 0.7,
  } as TextStyle,
  calendarButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    paddingVertical: 11,
    borderRadius: radii.md,
    borderWidth: 1.5,
  } as ViewStyle,
  calendarButtonText: {
    fontWeight: '700',
  } as TextStyle,

  // ── Onboarding banner ──
  onboardingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 4,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
  } as ViewStyle,
  onboardingBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
  } as TextStyle,
  onboardingBannerBody: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
    opacity: 0.8,
  } as TextStyle,

  // ── CTA "Evalúa la actividad" (destacado) ──
  evalCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    padding: spacing.md,
    borderRadius: radii.xl,
    marginBottom: spacing.md,
    ...shadows.md,
  } as ViewStyle,
  evalCtaIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    flexShrink: 0,
  } as ViewStyle,
  evalCtaTextWrap: { flex: 1 } as ViewStyle,
  evalCtaTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.2,
  } as TextStyle,
  evalCtaBody: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
    color: 'rgba(255,255,255,0.9)',
  } as TextStyle,
  evalCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    flexShrink: 0,
  } as ViewStyle,
  evalCtaBtnText: {
    fontSize: 13,
    fontWeight: '800',
  } as TextStyle,

  // ── Banner del evento activo (modo evento) ──
  eventBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 4,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
  } as ViewStyle,
  eventBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  } as ViewStyle,
  eventBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
  } as TextStyle,
  eventBannerBody: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
    opacity: 0.8,
  } as TextStyle,

  // ── Footer ──
  footer: { alignItems: 'center', paddingTop: spacing.xs } as ViewStyle,
  feedbackLink: { padding: spacing.sm, marginTop: 4 } as ViewStyle,
  feedbackText: { fontSize: 12, opacity: 0.6 } as TextStyle,
  tagline: {
    fontSize: 11,
    opacity: 0.3,
    marginTop: spacing.sm,
    letterSpacing: 0.2,
    fontStyle: 'italic',
  } as TextStyle,
});
