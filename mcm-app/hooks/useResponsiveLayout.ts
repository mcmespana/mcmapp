import { useWindowDimensions } from 'react-native';

/**
 * Tamaño efectivo de pantalla, agnóstico de plataforma.
 *
 * Breakpoints alineados con tablets/iPad y web:
 * - `xs`  → móvil portrait (< 480)
 * - `sm`  → móvil grande o tablet pequeño portrait (< 720)
 * - `md`  → iPad portrait (< 1024)
 * - `lg`  → iPad landscape / desktop (>= 1024)
 */
export type ResponsiveSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ResponsiveLayout {
  width: number;
  height: number;
  size: ResponsiveSize;
  /** >= 720 px — empieza a tener sentido layout de tablet */
  isWide: boolean;
  /** >= 1024 px — iPad landscape / desktop */
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
  if (width >= 1024) size = 'lg';
  else if (width >= 720) size = 'md';
  else if (width >= 480) size = 'sm';

  const isWide = width >= 720;
  const isExtraWide = width >= 1024;

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
