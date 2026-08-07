/**
 * Estilos de `app/(tabs)/contigo/revision.tsx`.
 *
 * Extraídos tal cual, sin tocar ni un valor: eran 194 líneas de las
 * 892 del fichero. Mismo patrón que `components/grupos/gruposStyles.ts`.
 */
import { Platform, StyleSheet, type TextStyle } from 'react-native';

/**
 * Tipografía ÚNICA para todo lo que el usuario escribe (los tres campos de los
 * dos pasos). Antes la lista de gratitud usaba la fuente del sistema y los
 * textos largos serif, así que cada paso se veía de un tipo distinto.
 *
 * Vive aquí y no en la pantalla porque la usan los dos: estos estilos y su JSX.
 */
export const WRITING_FONT: TextStyle = {
  fontFamily: Platform.OS === 'ios' ? 'Palatino' : 'serif',
  fontSize: 16,
  // Android mete un padding vertical fantasma en TextInput que descuadra el
  // centrado; con esto el texto queda donde toca en ambas plataformas.
  includeFontPadding: false,
};

export const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    position: 'relative',
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Close X is pulled out of the flow and pinned to the left edge so the
  // date-stepper can sit centered as a single, breathable unit.
  headerBtnAbs: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  dateStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '70%',
  },
  dateStepperBtn: {
    width: 28,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  navTitleText: {
    fontSize: 16,
    fontWeight: '700',
    maxWidth: 200,
  },
  dateCenter: {
    alignItems: 'center',
    paddingHorizontal: 6,
    minWidth: 160,
  },
  dateTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  dateSub: { fontSize: 10, marginTop: 1 },
  pillRow: { alignItems: 'center', paddingTop: 10 },
  pillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  stepRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 14,
    paddingBottom: 6,
  },
  stepDot: { height: 4, borderRadius: 2 },
  stepLabel: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginTop: 2,
  },

  h2: {
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 6,
    lineHeight: 26,
  },
  helpText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 18,
  },
  modeRow: { flexDirection: 'row', gap: 6, marginBottom: 18 },
  modeChip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // La fila ES la caja: el borde y el fondo viven aquí, y la estrella y el
  // input son hermanos centrados en flex. Antes la estrella iba absoluta con un
  // `lineHeight: 50` a mano y el texto quedaba descuadrado.
  gratRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    gap: 10,
  },
  gratStar: {
    fontSize: 13,
    fontWeight: '800',
    includeFontPadding: false,
  },
  gratInput: {
    flex: 1,
    ...WRITING_FONT,
    // Sin esto Android reserva su propio padding vertical y el texto se va
    // hacia arriba dentro de la caja.
    paddingVertical: 0,
  },
  listActions: { flexDirection: 'row', gap: 10 },
  listActionText: { fontSize: 14, fontWeight: '600' },
  removeBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  textarea: {
    minHeight: 200,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    ...WRITING_FONT,
    lineHeight: 26,
  },

  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  savedRow: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  savedText: { fontSize: 16, fontWeight: '700' },
  backBtn: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtn: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'white',
    letterSpacing: -0.2,
  },
});
