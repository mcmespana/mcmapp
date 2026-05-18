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
  xxl: 22, // cards hero (Contigo, próximamente otras heroes)
  full: 28, // FABs, icon circles (56x56)
  pillFull: 999, // badges/dots circulares
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
    web: {
      // @ts-ignore - boxShadow is valid on web but typed differently in older RN types
      boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.06)',
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
    web: {
      // @ts-ignore
      boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.12)',
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
    web: {
      // @ts-ignore
      boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
    },
    default: { elevation: 8 },
  }),
  /** Hero cards, teaser destacado — más prominente que md, sin llegar a overlay */
  xl: Platform.select({
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
  /** Sombra tintada cálida — para cards en zonas cálidas (Contigo, futuros heroes) */
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
  /** Sombra tintada fría — para cards institucionales destacadas (ya usado inline en SettingsPanel) */
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
