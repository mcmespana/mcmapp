/**
 * Test de `hooks/useResponsiveLayout.ts`.
 *
 * ÚNICO hook de breakpoints de la app: lo consumen las pantallas para decidir
 * columnas de grid y max-width (móvil / tablet vertical / tablet horizontal y
 * escritorio). Un umbral desalineado deja el grid mal en iPad.
 *
 * Había un segundo hook (`useResponsive`) con sus propios umbrales y cero usos
 * en la app; se borró en 2026-08. Si alguien vuelve a crear uno paralelo, el
 * primer test de aquí abajo es el que avisa de que los cortes ya no salen de
 * `constants/breakpoints.ts`.
 */
import { renderHook } from '@testing-library/react-native';
import { useWindowDimensions } from 'react-native';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { breakpoints } from '@/constants/breakpoints';

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  Object.defineProperty(actual, 'useWindowDimensions', {
    configurable: true,
    value: jest.fn(),
  });
  return actual;
});

function setDims(width: number, height: number) {
  (useWindowDimensions as jest.Mock).mockReturnValue({ width, height });
}

describe('useResponsiveLayout', () => {
  it('los cortes salen de constants/breakpoints.ts, no de números sueltos', async () => {
    for (const [key, size] of [
      [breakpoints.sm, 'sm'],
      [breakpoints.md, 'md'],
      [breakpoints.lg, 'lg'],
    ] as const) {
      setDims(key, 900);
      const { result } = await renderHook(() => useResponsiveLayout());
      expect(result.current.size).toBe(size);
      // Un píxel por debajo del corte todavía NO es ese tamaño.
      setDims(key - 1, 900);
      const { result: below } = await renderHook(() => useResponsiveLayout());
      expect(below.current.size).not.toBe(size);
    }
  });

  it('móvil portrait (< 480): size xs, 1 columna, maxWidth = width', async () => {
    setDims(390, 800);
    const { result } = await renderHook(() => useResponsiveLayout());
    expect(result.current.size).toBe('xs');
    expect(result.current.isWide).toBe(false);
    expect(result.current.isExtraWide).toBe(false);
    expect(result.current.isPortrait).toBe(true);
    expect(result.current.gridColumns).toBe(1);
    expect(result.current.readableMaxWidth).toBe(390);
    expect(result.current.contentMaxWidth).toBe(390);
  });

  it('móvil grande / tablet pequeño (< 720): size sm', async () => {
    setDims(500, 900);
    const { result } = await renderHook(() => useResponsiveLayout());
    expect(result.current.size).toBe('sm');
    expect(result.current.isWide).toBe(false);
  });

  it('iPad portrait (< 1024): size md, 2 columnas, maxWidths fijos', async () => {
    setDims(800, 1100);
    const { result } = await renderHook(() => useResponsiveLayout());
    expect(result.current.size).toBe('md');
    expect(result.current.isWide).toBe(true);
    expect(result.current.isExtraWide).toBe(false);
    expect(result.current.gridColumns).toBe(2);
    expect(result.current.readableMaxWidth).toBe(640);
    expect(result.current.contentMaxWidth).toBe(760);
    expect(result.current.isPortrait).toBe(true);
  });

  it('iPad landscape / desktop (>= 1024): size lg, 3 columnas', async () => {
    setDims(1200, 800);
    const { result } = await renderHook(() => useResponsiveLayout());
    expect(result.current.size).toBe('lg');
    expect(result.current.isExtraWide).toBe(true);
    expect(result.current.gridColumns).toBe(3);
    expect(result.current.readableMaxWidth).toBe(760);
    expect(result.current.contentMaxWidth).toBe(980);
    expect(result.current.isLandscape).toBe(true);
  });

  it('landscape/portrait se decide por width vs height', async () => {
    setDims(500, 500);
    const { result } = await renderHook(() => useResponsiveLayout());
    expect(result.current.isLandscape).toBe(false);
    expect(result.current.isPortrait).toBe(true);
  });
});
