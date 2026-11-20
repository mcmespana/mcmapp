/**
 * Estilos de `app/(tabs)/(inicio)/index.tsx`.
 *
 * Extraídos tal cual, sin tocar ni un valor: eran 395 líneas de las
 * 1729 del fichero. Mismo patrón que `components/grupos/gruposStyles.ts`.
 */
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import colors from '@/constants/colors';
import spacing from '@/constants/spacing';
import { radii, shadows } from '@/constants/uiStyles';
import typography from '@/constants/typography';

export const styles = StyleSheet.create({
  safeArea: { flex: 1 } as ViewStyle,

  // ── Header ──
  headerWide: {
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  } as ViewStyle,
  logoText: {
    ...typography.h0,
    fontWeight: '800',
    letterSpacing: -1.4,
    lineHeight: 38,
  } as TextStyle,
  headerIconBtn: { padding: spacing.sm } as ViewStyle,
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.xl,
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
  // Rojo MIC: el azul marino de antes se perdía sobre el cristal oscuro de la
  // cabecera (~1,5:1). El rojo pasa de 3:1 en los dos modos.
  dotPing: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: radii.pillFull,
    backgroundColor: colors.accent,
  } as ViewStyle,
  dot: {
    width: 9,
    height: 9,
    borderRadius: radii.pillFull,
    backgroundColor: colors.accent,
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

  section: { marginBottom: spacing.lg } as ViewStyle,
  // `SectionHeader` trae su propio padding lateral (20) y margen superior:
  // en la Home la sección ya va dentro del padding de página.
  sectionHeader: {
    paddingHorizontal: 0,
    marginTop: 0,
  } as ViewStyle,

  // ── Notification card ──
  // La tarjeta de la Home es UNA: la de «Cantos para el domingo» (radio lg,
  // relleno md, sombra `card`, sin borde). Antes había tres recetas seguidas.
  notifCard: {
    borderRadius: radii.lg,
    padding: spacing.md,
    ...shadows.card,
  } as ViewStyle,
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  } as ViewStyle,
  notifContent: {
    flex: 1,
    gap: spacing.xs,
  } as ViewStyle,
  newBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.xs,
    alignSelf: 'flex-start',
  } as ViewStyle,
  newBadgeText: {
    ...typography.overline,
    fontWeight: '800',
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
    borderRadius: radii.pillFull,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginTop: 2,
  } as ViewStyle,
  notifCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  } as ViewStyle,
  destinationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radii.xl,
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
    borderRadius: radii.xl,
  } as ViewStyle,
  actionBtnText: {
    ...typography.footnote,
    fontWeight: '700',
  } as TextStyle,

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
    gap: spacing.sm,
    width: 70,
  } as ViewStyle,
  // Letra del sistema grande: en 70 px las etiquetas se partían a media
  // palabra («Canto/ral»). Pasan a 3 por fila, en varias filas.
  quickGridLarge: {
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    rowGap: spacing.md,
  } as ViewStyle,
  quickItemLarge: { width: '33.33%', paddingHorizontal: 2 } as ViewStyle,
  quickIconCircle: {
    width: 56,
    height: 56,
    borderRadius: radii.full,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  quickLabel: {
    ...typography.footnote,
    fontWeight: '600',
    textAlign: 'center',
  } as TextStyle,

  // ── Event cards ──
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.card,
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
    ...typography.overline,
    fontWeight: '800',
  } as TextStyle,
  eventDay: {
    ...typography.body,
    fontWeight: '800',
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  } as TextStyle,
  eventInfo: {
    flex: 1,
    overflow: 'hidden',
    gap: spacing.xs,
  } as ViewStyle,
  eventTitle: {
    fontWeight: '600',
  } as TextStyle,
  /** Punto del color del calendario, delante de «Calendario · Lugar». */
  calDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pillFull,
    flexShrink: 0,
  } as ViewStyle,
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
    ...typography.footnote,
    fontWeight: '600',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
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
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
  } as ViewStyle,
  onboardingBannerTitle: {
    ...typography.body,
    fontWeight: '600',
  } as TextStyle,
  onboardingBannerBody: {
    ...typography.subhead,
    marginTop: 2,
  } as TextStyle,
  /**
   * «Evalúa la app»: la fila es una tarjeta normal (sin borde) y lleva una X
   * HERMANA de la zona pulsable, no hija (un botón dentro de otro es HTML
   * inválido en web y el lector de pantalla los lee como uno).
   */
  appEvalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.lg,
    marginBottom: spacing.lg,
    ...shadows.card,
  } as ViewStyle,
  appEvalMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    paddingRight: 0,
  } as ViewStyle,
  appEvalClose: {
    width: 44,
    height: 44,
    marginRight: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,

  // ── CTA "Evalúa la actividad" (destacado) ──
  evalCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.xl,
    marginBottom: spacing.lg,
    ...shadows.raised,
  } as ViewStyle,
  evalCtaIcon: {
    width: 46,
    height: 46,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    flexShrink: 0,
  } as ViewStyle,
  evalCtaTextWrap: { flex: 1 } as ViewStyle,
  evalCtaLarge: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  } as ViewStyle,
  evalCtaTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.2,
  } as TextStyle,
  evalCtaBody: {
    ...typography.footnote,
    lineHeight: 16,
    marginTop: 2,
    color: colors.white,
  } as TextStyle,
  evalCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.xl,
    flexShrink: 0,
  } as ViewStyle,
  evalCtaBtnText: {
    ...typography.caption,
    fontWeight: '800',
  } as TextStyle,

  // ── Banner del evento activo (modo evento) ──
  eventBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
  } as ViewStyle,
  eventBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  } as ViewStyle,
  eventBannerTitle: {
    ...typography.body,
    fontWeight: '600',
  } as TextStyle,
  eventBannerBody: {
    ...typography.subhead,
    marginTop: 2,
  } as TextStyle,

  // ── Footer ──
  footer: { alignItems: 'center', paddingTop: spacing.xs } as ViewStyle,
  feedbackLink: { padding: spacing.sm, marginTop: 4 } as ViewStyle,
  feedbackText: {
    ...typography.footnote,
    textDecorationLine: 'underline',
  } as TextStyle,
  tagline: {
    ...typography.micro,
    opacity: 0.3,
    marginTop: spacing.sm,
    letterSpacing: 0.2,
    fontStyle: 'italic',
  } as TextStyle,
});
