import { Platform } from 'react-native';
import colors from './colors';

// ── Border Radius ──
export const radii = {
  xs: 4, // badges pequeños
  sm: 8, // botones, inputs
  md: 12, // toasts, modales, date boxes
  lg: 14, // cards de contenido
  xl: 18, // cards destacadas
  pill: 20, // chips, pills de acción
  full: 28, // FABs, icon circles (56x56)
} as const;

// ── Sombras ──
export const shadows = {
  /** Cards de contenido — sutil */
  sm: Platform.select({
    ios: {
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
    },
    default: { elevation: 1 },
  }),
  /** Cards elevadas, paneles — media */
  md: Platform.select({
    ios: {
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 6,
    },
    default: { elevation: 3 },
  }),
  /** Toasts, FABs, overlays — prominente */
  lg: Platform.select({
    ios: {
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    default: { elevation: 8 },
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
