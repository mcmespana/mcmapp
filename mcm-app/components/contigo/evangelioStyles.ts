/**
 * Estilos de `app/(tabs)/contigo/evangelio.tsx`.
 *
 * Extraídos tal cual, sin tocar ni un valor: eran 266 líneas de las
 * 1244 del fichero. Mismo patrón que `components/grupos/gruposStyles.ts`.
 */
import { StyleSheet } from 'react-native';
import { radii, shadows } from '@/constants/uiStyles';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Acciones del header NATIVO (guardar / ajustes). Minimal —solo padding— para
  // que iOS 26 las envuelva en su cápsula liquid-glass.
  nativeHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  nativeHeaderBtn: {
    padding: 6,
  },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    zIndex: 50,
  },
  floatingActions: {
    flexDirection: 'row',
    gap: 12,
  },
  frostedBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {},
  // Custom Segmented Control
  segmentedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 4,
    borderRadius: 14,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  segmentActive: {
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 15,
  },
  // Date navigator
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  dateNavBtn: {
    padding: 10,
    borderRadius: 14,
  },
  dateDisplay: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  dateText: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    textTransform: 'capitalize',
    textAlign: 'center',
  },
  badgeRow: {
    marginTop: 8,
  },
  // "Hoy" en pequeñito: solo sale cuando estás mirando otro día, y ocupa lo
  // justo para no competir con la fecha ni con el badge litúrgico.
  todayMiniPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'center',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  todayMiniLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  diaLiturgico: {
    fontSize: 12,
    marginTop: 6,
    fontWeight: '700',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tituloLiturgico: {
    fontSize: 13,
    marginTop: 4,
    fontWeight: '500',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // States
  stateContainer: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  stateText: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
  },
  todayBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 100,
  },
  todayBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  // Main content
  mainContent: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  evangelioCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
    ...shadows.sm,
  },
  cardContent: {
    padding: 20,
  },
  citaBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
    marginBottom: 20,
  },
  citaText: {
    fontSize: 14,
    fontWeight: '700',
  },
  bodyText: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '400',
  },
  authorText: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 24,
    textAlign: 'right',
    fontStyle: 'italic',
  },
  sourceLink: {
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sourceText: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 4,
  },
  // Tracker
  trackerContainer: {
    marginBottom: 28,
    alignItems: 'center',
  },
  trackerBtnWrap: {
    width: '100%',
    borderRadius: 16,
    minHeight: 54,
  },
  trackerGradient: {
    width: '100%',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'center',
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 8,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  trackerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackerText: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 10,
  },
  trackerNote: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 20,
    lineHeight: 17,
  },
  // Other readings
  divider: {
    height: 1,
    marginBottom: 20,
    marginHorizontal: 8,
  },
  otherReadings: {
    marginBottom: 16,
  },
  otherReadingsTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 16,
    textAlign: 'center',
  },
  // Checkmark overlay
  checkOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  checkCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
