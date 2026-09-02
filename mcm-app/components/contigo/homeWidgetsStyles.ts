/**
 * Estilos de `components/contigo/HomeWidgets.tsx`.
 *
 * Extraídos tal cual, sin tocar ni un valor: eran 324 líneas de las
 * 1095 del fichero. Mismo patrón que `components/grupos/gruposStyles.ts`.
 */
import { Platform, StyleSheet } from 'react-native';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';

export const styles = StyleSheet.create({
  // Hero — outer carries the shadow, inner clips the gradient corners.
  heroOuter: {
    borderRadius: radii.full,
    backgroundColor: 'transparent',
    ...Platform.select({
      ios: {
        shadowColor: '#3D2E1A',
        shadowOpacity: 0.35,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 6 },
      web: { boxShadow: '0 10px 40px rgba(61,46,26,0.35)' as any },
    }),
  },
  heroClip: {
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  heroGrad: { padding: 22, minHeight: 138 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  heroRing: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroRingCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroRingNum: {
    fontSize: 26,
    fontWeight: '900',
    color: 'white',
    letterSpacing: -1,
    lineHeight: 28,
  },
  heroRingNumSm: {
    ...typography.caption,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
  },
  heroRingLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  heroTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: 'white',
    letterSpacing: -0.3,
    marginBottom: 5,
  },
  heroSubtitle: {
    ...typography.footnote,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 16,
    marginBottom: 12,
  },
  heroChips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderRadius: radii.pillFull,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  heroChipEmoji: { fontSize: 11 },
  heroChipText: {
    ...typography.micro,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
  },

  // Tile — shadow on outer wrapper, overflow clip on inner.
  tileWrap: {
    flex: 1,
    minHeight: 92,
    borderRadius: radii.xl,
    backgroundColor: 'transparent',
    ...Platform.select({
      ios: {
        shadowOpacity: 0.25,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 4 },
      web: { boxShadow: '0 6px 20px rgba(0,0,0,0.18)' as any },
    }),
  },
  tileClip: {
    flex: 1,
    minHeight: 92,
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  tileWrapEmpty: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tileContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  tileCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    ...typography.micro,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
  },

  // Teaser — outer holds shadow, inner clips border + bar.
  teaser: {
    borderRadius: radii.xl,
    backgroundColor: 'transparent',
    ...Platform.select({
      ios: {
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 2 },
    }),
  },
  teaserClip: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: 1,
  },
  teaserBar: { height: 3 },
  teaserBody: { padding: 16 },
  teaserHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  teaserKicker: {
    ...typography.micro,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  teaserTitle: {
    ...typography.body,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 20,
  },
  teaserCita: {
    borderRadius: radii.pillFull,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  teaserCitaText: { fontSize: 12, fontWeight: '800' },
  teaserPreviewWrap: { position: 'relative', marginBottom: 14 },
  teaserPreview: {
    ...typography.subhead,
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'Palatino' : 'serif',
  },
  teaserFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 36,
  },
  teaserActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teaserCta: {
    flex: 1,
    height: 38,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teaserCtaText: { fontSize: 12, fontWeight: '700' },
  teaserDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.pillFull,
    paddingHorizontal: 11,
    paddingVertical: 5,
    marginLeft: 8,
  },
  teaserDoneText: { fontSize: 11, fontWeight: '700' },

  // Week
  weekRow: { flexDirection: 'row', gap: 4 },
  weekCol: { flex: 1, alignItems: 'center', gap: 4 },
  weekHdr: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  weekTile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDay: { fontSize: 10 },
  weekDots: { flexDirection: 'row', gap: 2 },
  weekDot: { width: 4, height: 4, borderRadius: 2 },
  weekLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 12,
  },
  weekLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  weekLegendDot: { width: 8, height: 8, borderRadius: 2 },
  weekLegendStar: { fontSize: 10 },
  weekLegendText: { fontSize: 10, fontWeight: '500' },

  // Stat
  statCard: {
    flex: 1,
    borderRadius: radii.xl,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowOpacity: 0.1,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 1 },
    }),
  },
  statIcon: { fontSize: 20, marginBottom: 3 },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
    textAlign: 'center',
    textTransform: 'uppercase',
    lineHeight: 13,
  },

  // Heatmap
  heatmapHdr: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingHorizontal: 3,
  },
  heatmapHdrText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  heatmapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  heatmapCellWrap: {
    width: `${100 / 7}%`,
    padding: 3,
  },
  heatmapCell: {
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  heatmapDay: { fontSize: 12, letterSpacing: -0.2 },
  heatmapLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 10,
  },
});
