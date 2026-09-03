// constants/breakpoints.ts
//
// Fuente única de los cortes responsive. Mobile-first: por debajo de `sm` se
// asume móvil en vertical.
//
// Ojo: estos números son los que la app USA de verdad (los de
// `useResponsiveLayout`, que es el hook con el que están hechas las pantallas).
// Antes este fichero declaraba otros (640/768/1024/1280) que no coincidían con
// ninguna pantalla, porque su único consumidor era un hook con cero usos.

export const breakpoints = {
  /** Móvil grande / móvil en horizontal. */
  sm: 480,
  /** Tablet en vertical — a partir de aquí tiene sentido un layout de tablet. */
  md: 720,
  /** Tablet en horizontal y escritorio. */
  lg: 1024,
} as const;

/**
 * Anchuras máximas de contenido.
 *
 * ⚠️ Hay DOS escaleras conviviendo y no están unificadas:
 *
 *   · `readable`/`content` (640/760 y 760/980) — las de `useResponsiveLayout`,
 *     que usan cantoral, calendario y "Más".
 *   · `maxContentWidth`/`maxContentWidthWide` (960/1200) — las de
 *     `PageContainer`, que usan las pantallas internas y los eventos.
 *
 * O sea: la misma app limita el contenido a 640, 760, 960 o 1200 según en qué
 * pantalla estés. Unificarlas cambia el layout en tablet y web, así que hay que
 * verlo en un dispositivo — está anotado en `docs/planes/PLAN_DISENO.md` §F.
 */

/** Max-width estándar para pantallas internas (`PageContainer`). */
export const maxContentWidth = 960;

/** Max-width para dashboards / Home con layouts más densos. */
export const maxContentWidthWide = 1200;
