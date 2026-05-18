// constants/breakpoints.ts
// Breakpoints para responsividad cross-platform (especialmente web).
// Mobile-first: por debajo de `sm` se asume mobile portrait.

export const breakpoints = {
  sm: 640, // tablet portrait / phone landscape
  md: 768, // tablet landscape
  lg: 1024, // small desktop / large tablet
  xl: 1280, // desktop
} as const;

/** Max-width estándar para pantallas internas (lectura cómoda en web). */
export const maxContentWidth = 960;

/** Max-width para dashboards / Home con layouts más densos. */
export const maxContentWidthWide = 1200;

/** Breakpoint legacy usado en Home para activar layout de dos columnas. */
export const wideLayoutMinWidth = 700;
