import { Platform, useWindowDimensions } from 'react-native';
import { breakpoints } from '@/constants/breakpoints';

export interface ResponsiveState {
  width: number;
  height: number;
  /** True when width >= sm (640px). */
  isSm: boolean;
  /** True when width >= md (768px). */
  isMd: boolean;
  /** True when width >= lg (1024px). */
  isLg: boolean;
  /** True when width >= xl (1280px). */
  isXl: boolean;
  /**
   * Legacy convenience flag matching the existing Home layout breakpoint
   * (`windowWidth >= 700`). Use new `isSm`/`isMd` for new code.
   */
  isWide: boolean;
  /** Is the app running in a web browser (vs native mobile)? */
  isWeb: boolean;
}

/**
 * Reactive responsive state based on window size.
 * Mostly useful for web — on native mobile, isSm/isMd/etc. are typically false
 * unless the device is a tablet in landscape.
 *
 * Usage:
 *   const { isMd, isWeb } = useResponsive();
 *   const columns = isMd ? 3 : 1;
 */
export function useResponsive(): ResponsiveState {
  const { width, height } = useWindowDimensions();
  return {
    width,
    height,
    isSm: width >= breakpoints.sm,
    isMd: width >= breakpoints.md,
    isLg: width >= breakpoints.lg,
    isXl: width >= breakpoints.xl,
    isWide: width >= 700,
    isWeb: Platform.OS === 'web',
  };
}
