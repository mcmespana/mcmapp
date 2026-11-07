/**
 * Test de `hooks/useFontScale.ts`.
 *
 * Multiplica el `fontScale` global por un factor extra opcional. Es el hook
 * que usan las pantallas que necesitan un tamaño de letra relativo al ajuste
 * general del usuario pero un poco distinto (p.ej. subtítulos más pequeños).
 */
import { renderHook } from '@testing-library/react-native';
import useFontScale from '@/hooks/useFontScale';

let mockFontScale = 1;

jest.mock('@/contexts/AppSettingsContext', () => ({
  useAppSettings: () => ({ settings: { fontScale: mockFontScale } }),
}));

beforeEach(() => {
  mockFontScale = 1;
});

describe('useFontScale', () => {
  it('devuelve el fontScale global sin factor extra', async () => {
    mockFontScale = 1.3;
    const { result } = await renderHook(() => useFontScale());
    expect(result.current).toBe(1.3);
  });

  it('multiplica por el factor extra recibido', async () => {
    mockFontScale = 1.5;
    const { result } = await renderHook(() => useFontScale(2));
    expect(result.current).toBe(3);
  });

  it('con factor 0 devuelve 0', async () => {
    mockFontScale = 2;
    const { result } = await renderHook(() => useFontScale(0));
    expect(result.current).toBe(0);
  });
});
