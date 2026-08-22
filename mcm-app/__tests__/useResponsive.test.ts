/**
 * Test de `hooks/useResponsive.ts`.
 *
 * Calcula los breakpoints reactivos (`isSm`/`isMd`/`isLg`/`isXl`/`isWide`) a
 * partir del ancho de ventana. Si los umbrales se desalinean con
 * `constants/breakpoints.ts`, una pantalla puede pensar que está en móvil
 * cuando en realidad ya es tablet/desktop.
 */
import { renderHook } from '@testing-library/react-native';
import { Platform, useWindowDimensions } from 'react-native';
import { useResponsive } from '@/hooks/useResponsive';

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  Object.defineProperty(actual, 'useWindowDimensions', {
    configurable: true,
    value: jest.fn(),
  });
  return actual;
});

function setDims(width: number, height = 800) {
  (useWindowDimensions as jest.Mock).mockReturnValue({ width, height });
}

describe('useResponsive', () => {
  afterEach(() => {
    Platform.OS = 'ios';
  });

  it('móvil pequeño: todos los breakpoints en false', async () => {
    setDims(400);
    const { result } = await renderHook(() => useResponsive());
    expect(result.current.isSm).toBe(false);
    expect(result.current.isMd).toBe(false);
    expect(result.current.isLg).toBe(false);
    expect(result.current.isXl).toBe(false);
    expect(result.current.isWide).toBe(false);
  });

  it('activa isSm a partir de 640', async () => {
    setDims(640);
    const { result } = await renderHook(() => useResponsive());
    expect(result.current.isSm).toBe(true);
    expect(result.current.isMd).toBe(false);
  });

  it('activa isMd a partir de 768', async () => {
    setDims(768);
    const { result } = await renderHook(() => useResponsive());
    expect(result.current.isMd).toBe(true);
    expect(result.current.isLg).toBe(false);
  });

  it('activa isLg a partir de 1024 e isWide desde 700', async () => {
    setDims(1024);
    const { result } = await renderHook(() => useResponsive());
    expect(result.current.isLg).toBe(true);
    expect(result.current.isWide).toBe(true);
  });

  it('activa isXl a partir de 1280', async () => {
    setDims(1280);
    const { result } = await renderHook(() => useResponsive());
    expect(result.current.isXl).toBe(true);
  });

  it('isWeb refleja Platform.OS', async () => {
    Platform.OS = 'web';
    setDims(400);
    const { result } = await renderHook(() => useResponsive());
    expect(result.current.isWeb).toBe(true);

    Platform.OS = 'android';
    const { result: result2 } = await renderHook(() => useResponsive());
    expect(result2.current.isWeb).toBe(false);
  });
});
