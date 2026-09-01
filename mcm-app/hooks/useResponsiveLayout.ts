import { useWindowDimensions } from 'react-native';
import { breakpoints } from '@/constants/breakpoints';

/**
 * Tamaño efectivo de pantalla, agnóstico de plataforma.
 *
 * Los cortes salen de `constants/breakpoints.ts`, que es la fuente única:
 * - `xs`  → móvil vertical (< sm)
 * - `sm`  → móvil grande o tablet pequeño vertical (< md)
 * - `md`  → tablet vertical (< lg)
 * - `lg`  → tablet horizontal / escritorio (>= lg)
 */
export type ResponsiveSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ResponsiveLayout {
  width: number;
  height: number;
  size: ResponsiveSize;
  /** >= `breakpoints.md` — empieza a tener sentido layout de tablet */
  isWide: boolean;
  /** >= `breakpoints.lg` — tablet horizontal / escritorio */
  isExtraWide: boolean;
  /** True si la orientación actual es horizontal. */
  isLandscape: boolean;
  /** True si la orientación actual es vertical. */
  isPortrait: boolean;
  /** Número de columnas recomendado para grids de categorías. */
  gridColumns: number;
  /** Max-width pensado para listas legibles. */
  readableMaxWidth: number;
  /** Max-width pensado para contenido amplio (canción + acordes). */
  contentMaxWidth: number;
}

/**
 * Hook único para resolver breakpoints en toda la app.
 *
 * Pensado para que las pantallas no se estiren de forma desproporcionada
 * en iPad portrait, iPad landscape y web amplio, conservando el diseño
 * mobile-first en móvil.
 */
export function useResponsiveLayout(): ResponsiveLayout {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  let size: ResponsiveSize = 'xs';
  if (width >= breakpoints.lg) size = 'lg';
  else if (width >= breakpoints.md) size = 'md';
  else if (width >= breakpoints.sm) size = 'sm';

  const isWide = width >= breakpoints.md;
  const isExtraWide = width >= breakpoints.lg;

  const gridColumns = isExtraWide ? 3 : isWide ? 2 : 1;
  const readableMaxWidth = isExtraWide ? 760 : isWide ? 640 : width;
  const contentMaxWidth = isExtraWide ? 980 : isWide ? 760 : width;

  return {
    width,
    height,
    size,
    isWide,
    isExtraWide,
    isLandscape,
    isPortrait: !isLandscape,
    gridColumns,
    readableMaxWidth,
    contentMaxWidth,
  };
}
