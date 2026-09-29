import { Platform } from 'react-native';
import colors from './colors';

// ── Border Radius ──
//
// Escala alineada a la rejilla de 4 px, igual que `spacing`. Cada escalón está
// a 4 px o más del vecino: si dudas entre dos, es que da igual — coge el que
// diga la tabla.
//
// Antes había nueve escalones con `lg 14 / xl 18 / pill 20 / xxl 22` metidos en
// 8 px de rango. Nadie los distingue a ojo, pero todo el mundo dudaba al
// elegir, y esa duda acababa en un `borderRadius: 16` hardcodeado.
export const radii = {
  xs: 4, // badges pequeños
  sm: 8, // botones, inputs, controles
  md: 12, // modales, toasts, bottom sheets, date boxes
  lg: 16, // cards de contenido
  xl: 20, // cards destacadas, chips y cards hero
  full: 28, // FABs e icon circles de 56×56
  pillFull: 999, // badges y dots circulares, citation pills
} as const;

// ── Sombras ──
//
// Se llaman por su FUNCIÓN, no por su tamaño. Con nombres de talla el orden
// mentía: `lg` (opacity 0.3) era más marcada que `xl` (0.18), así que quien
// pedía "la más fuerte" cogía la que no era. `__tests__/designTokens.test.ts`
// comprueba que la escalera sigue siendo monótona.
export const shadows = {
  /** Cards de contenido — sutil, la de por defecto. */
  card: Platform.select({
    ios: {
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
    },
    web: {
      // @ts-ignore - boxShadow is valid on web but typed differently in older RN types
      boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.06)',
    },
    default: { elevation: 1 },
  }),
  /** Cards elevadas y paneles — media. */
  raised: Platform.select({
    ios: {
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 6,
    },
    web: {
      // @ts-ignore
      boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.12)',
    },
    default: { elevation: 3 },
  }),
  /** Hero cards y teaser destacado — presencia sin ser un overlay. */
  hero: Platform.select({
    ios: {
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
    },
    web: {
      // @ts-ignore
      boxShadow: '0px 6px 12px rgba(0, 0, 0, 0.18)',
    },
    default: { elevation: 6 },
  }),
  /**
   * Toasts, FABs y overlays — lo que flota por encima de la pantalla.
   *
   * Estaba en opacity 0.3, que chocaba de frente con el "sombras sutiles" del
   * norte de diseño y se veía sucia en modo claro. 0.22 sigue despegando el
   * elemento del fondo sin ensuciarlo.
   */
  overlay: Platform.select({
    ios: {
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.22,
      shadowRadius: 8,
    },
    web: {
      // @ts-ignore
      boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.22)',
    },
    default: { elevation: 8 },
  }),
  /** Sombra tintada cálida — cards destacadas en zona cálida (Contigo). */
  warm: Platform.select({
    ios: {
      shadowColor: '#64461E',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 10,
    },
    web: {
      // @ts-ignore
      boxShadow: '0px 4px 10px rgba(100, 70, 30, 0.18)',
    },
    default: { elevation: 4 },
  }),
  /** Sombra tintada fría — cards institucionales destacadas. */
  cool: Platform.select({
    ios: {
      shadowColor: '#253883',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 10,
    },
    web: {
      // @ts-ignore
      boxShadow: '0px 4px 10px rgba(37, 56, 131, 0.18)',
    },
    default: { elevation: 4 },
  }),
} as const;

// ── Texto con sombra ──
export const textShadow = {
  textShadowColor: 'rgba(0, 0, 0, 0.5)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 2,
} as const;

// ── Padding de página ──
export const pagePadding = {
  paddingHorizontal: 16,
} as const;

// ── Bordes ──
export const commonBorder = {
  borderWidth: 1,
  borderColor: colors.border,
} as const;

/**
 * Anillo de foco. En web y con teclado externo (iPad, Android con teclado) el
 * foco tiene que verse: hasta ahora no había ninguno definido y cada campo se
 * las apañaba como podía.
 *
 * Se aplica al contenedor del control, no al texto.
 */
export const focusRing = {
  borderWidth: 2,
  borderColor: colors.info,
} as const;
