/**
 * Tests de `hooks/useSectionFontScale.ts`.
 *
 * Tamaño de letra por sección con herencia del global: mientras la sección no
 * tenga un override propio debe seguir al `fontScale` general (para que el
 * ajuste general se note también ahí), y en cuanto se fija uno, debe
 * desacoplarse hasta que se resetee. El bug histórico era memoizar mal el
 * objeto de overrides y romper la identidad estable de `setScale`/`reset`.
 */
import { renderHook, act } from '@testing-library/react-native';
import useSectionFontScale, {
  SECTION_FONT_MIN,
  SECTION_FONT_MAX,
} from '@/hooks/useSectionFontScale';

let mockSettings: { fontScale: number; sectionFontScales?: Record<string, number> };
const mockSetSettings = jest.fn((values: Record<string, unknown>) => {
  mockSettings = { ...mockSettings, ...values };
});

jest.mock('@/contexts/AppSettingsContext', () => ({
  useAppSettings: () => ({ settings: mockSettings, setSettings: mockSetSettings }),
}));

beforeEach(() => {
  mockSettings = { fontScale: 1, sectionFontScales: {} };
  mockSetSettings.mockClear();
});

describe('useSectionFontScale', () => {
  it('sin override, hereda el fontScale global', async () => {
    mockSettings = { fontScale: 1.4, sectionFontScales: {} };
    const { result } = await renderHook(() => useSectionFontScale('contigo'));
    expect(result.current.scale).toBe(1.4);
    expect(result.current.hasOverride).toBe(false);
    expect(result.current.globalScale).toBe(1.4);
  });

  it('con override, usa el valor de la sección, no el global', async () => {
    mockSettings = {
      fontScale: 1,
      sectionFontScales: { contigo: 1.8 },
    };
    const { result } = await renderHook(() => useSectionFontScale('contigo'));
    expect(result.current.scale).toBe(1.8);
    expect(result.current.hasOverride).toBe(true);
  });

  it('setScale fija un override propio para la sección, clamp incluido', async () => {
    const { result } = await renderHook(() => useSectionFontScale('materiales'));
    await act(async () => result.current.setScale(5)); // por encima de MAX
    expect(mockSetSettings).toHaveBeenCalledWith({
      sectionFontScales: { materiales: SECTION_FONT_MAX },
    });
  });

  it('setScale respeta el mínimo', async () => {
    const { result } = await renderHook(() => useSectionFontScale('materiales'));
    await act(async () => result.current.setScale(0.1));
    expect(mockSetSettings).toHaveBeenCalledWith({
      sectionFontScales: { materiales: SECTION_FONT_MIN },
    });
  });

  it('setScale conserva los overrides de otras secciones', async () => {
    mockSettings = {
      fontScale: 1,
      sectionFontScales: { otraSeccion: 1.5 },
    };
    const { result } = await renderHook(() => useSectionFontScale('contigo'));
    await act(async () => result.current.setScale(1.2));
    expect(mockSetSettings).toHaveBeenCalledWith({
      sectionFontScales: { otraSeccion: 1.5, contigo: 1.2 },
    });
  });

  it('reset() sin override no hace nada', async () => {
    const { result } = await renderHook(() => useSectionFontScale('contigo'));
    await act(async () => result.current.reset());
    expect(mockSetSettings).not.toHaveBeenCalled();
  });

  it('reset() con override lo elimina y deja el resto intacto', async () => {
    mockSettings = {
      fontScale: 1,
      sectionFontScales: { contigo: 1.6, otraSeccion: 1.2 },
    };
    const { result } = await renderHook(() => useSectionFontScale('contigo'));
    await act(async () => result.current.reset());
    expect(mockSetSettings).toHaveBeenCalledWith({
      sectionFontScales: { otraSeccion: 1.2 },
    });
  });

  it('expone min/max/step constantes', async () => {
    const { result } = await renderHook(() => useSectionFontScale('contigo'));
    expect(result.current.min).toBe(SECTION_FONT_MIN);
    expect(result.current.max).toBe(SECTION_FONT_MAX);
    expect(result.current.step).toBeCloseTo(0.1);
  });

  it('sin sectionFontScales en settings (undefined), no revienta', async () => {
    mockSettings = { fontScale: 1.2 };
    const { result } = await renderHook(() => useSectionFontScale('contigo'));
    expect(result.current.scale).toBe(1.2);
    expect(result.current.hasOverride).toBe(false);
  });
});
