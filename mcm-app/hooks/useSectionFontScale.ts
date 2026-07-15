import { useCallback } from 'react';
import { useAppSettings } from '@/contexts/AppSettingsContext';

export const SECTION_FONT_MIN = 0.85;
export const SECTION_FONT_MAX = 2.2;
export const SECTION_FONT_STEP = 0.1;

const clamp = (n: number) =>
  Math.min(
    SECTION_FONT_MAX,
    Math.max(SECTION_FONT_MIN, Math.round(n * 100) / 100),
  );

export interface SectionFontScale {
  /** Escala efectiva a aplicar (override de la sección o, si no hay, el global). */
  scale: number;
  /** True si la sección tiene un tamaño propio configurado. */
  hasOverride: boolean;
  /** Escala global de la app (fallback cuando no hay override). */
  globalScale: number;
  /** Fija un tamaño propio para la sección (independiza del global). */
  setScale: (value: number) => void;
  /** Elimina el tamaño propio: la sección vuelve a heredar del global. */
  reset: () => void;
  min: number;
  max: number;
  step: number;
}

/**
 * Tamaño de letra específico por sección con herencia del global.
 *
 * Si la sección no tiene un tamaño propio, usa el `fontScale` global (así, al
 * cambiar el tamaño general, las secciones sin configurar se ajustan solas y la
 * transición es suave). En cuanto el usuario fija un tamaño para la sección,
 * esta queda desacoplada del global hasta que se resetee.
 *
 * Reutilizable: pasa una `key` distinta por sección (p.ej. `'contigo'`,
 * `'materiales'`).
 */
export default function useSectionFontScale(key: string): SectionFontScale {
  const { settings, setSettings } = useAppSettings();
  const overrides = settings.sectionFontScales ?? {};
  const hasOverride = Object.prototype.hasOwnProperty.call(overrides, key);
  const globalScale = settings.fontScale;
  const scale = hasOverride ? overrides[key] : globalScale;

  const setScale = useCallback(
    (value: number) => {
      setSettings({
        sectionFontScales: { ...overrides, [key]: clamp(value) },
      });
    },
    [setSettings, overrides, key],
  );

  const reset = useCallback(() => {
    if (!hasOverride) return;
    const next = { ...overrides };
    delete next[key];
    setSettings({ sectionFontScales: next });
  }, [setSettings, overrides, key, hasOverride]);

  return {
    scale,
    hasOverride,
    globalScale,
    setScale,
    reset,
    min: SECTION_FONT_MIN,
    max: SECTION_FONT_MAX,
    step: SECTION_FONT_STEP,
  };
}
