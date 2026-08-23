/**
 * Tests de `hooks/useReadingHighlights.ts`.
 *
 * Orquesta el subrayado de las 5 fuentes de lectura del día (evangelio,
 * comentario, lectura1, salmo, lectura2) sobre las funciones puras de
 * `utils/highlightRanges.ts`. El bug histórico que motivó extraer este hook:
 * añadir una fuente nueva significaba repetir memos/handlers a mano, y la
 * primera/segunda lectura se quedaban sin subrayado por un olvido así.
 *
 * La selección es "pegajosa" (se queda con la última no vacía) para que un
 * toque en un chip de color no la pierda si iOS colapsa la selección nativa
 * antes de que llegue el onPress.
 */
import { renderHook, act } from '@testing-library/react-native';
import { useReadingHighlights } from '@/hooks/useReadingHighlights';
import type { DailyReadings } from '@/hooks/useDailyReadings';
import type { StoredBookmark } from '@/utils/contigoBookmarks';

const readings = {
  evangelio: { texto: 'Amaos los unos a los otros.', comentario: 'Comenta esto.' },
  lectura1: { texto: 'Primera lectura del día.' },
  salmo: { texto: 'Bendice alma mia.' },
  lectura2: { texto: 'Segunda lectura del día.' },
} as unknown as DailyReadings;

async function mount(bookmark?: StoredBookmark, setHighlights = jest.fn()) {
  const hook = await renderHook(() =>
    useReadingHighlights('2026-08-22', readings, bookmark, setHighlights),
  );
  return { setHighlights, ...hook };
}

describe('useReadingHighlights', () => {
  it('expone el texto canónico de las 5 fuentes', async () => {
    const { result } = await mount();
    expect(result.current.canonical.evangelio).toBe(
      'Amaos los unos a los otros.',
    );
    expect(result.current.canonical.lectura1).toBe('Primera lectura del día.');
  });

  it('con readings null, el canónico de todas las fuentes es cadena vacía', async () => {
    const { result } = await renderHook(() =>
      useReadingHighlights('2026-08-22', null, undefined, jest.fn()),
    );
    expect(result.current.canonical.evangelio).toBe('');
    expect(result.current.canonical.salmo).toBe('');
  });

  it('normaliza los rangos guardados en el bookmark por fuente', async () => {
    const bookmark: StoredBookmark = {
      date: '2026-08-22',
      highlights: {
        evangelio: [{ start: 0, end: 5, color: 'mint', text: 'Amaos' }],
      },
    } as unknown as StoredBookmark;
    const { result } = await mount(bookmark);
    expect(result.current.ranges.evangelio).toEqual([
      { start: 0, end: 5, color: 'mint', text: 'Amaos' },
    ]);
    expect(result.current.ranges.lectura1).toEqual([]);
  });

  it('sin selección, hasSelection es false y selection es null', async () => {
    const { result } = await mount();
    expect(result.current.hasSelection).toBe(false);
    expect(result.current.selection).toBeNull();
  });

  it('onSelectionChange marca una selección activa por fuente', async () => {
    const { result } = await mount();
    await act(async () =>
      result.current.onSelectionChange.evangelio({ start: 0, end: 5 }),
    );
    expect(result.current.hasSelection).toBe(true);
  });

  it('onSelectionChange(null) no borra una selección ya activa (pegajosa)', async () => {
    const { result } = await mount();
    await act(async () =>
      result.current.onSelectionChange.evangelio({ start: 0, end: 5 }),
    );
    await act(async () => result.current.onSelectionChange.evangelio(null));
    expect(result.current.hasSelection).toBe(true);
  });

  it('clearSelection sí borra la selección activa', async () => {
    const { result } = await mount();
    await act(async () =>
      result.current.onSelectionChange.evangelio({ start: 0, end: 5 }),
    );
    await act(async () => result.current.clearSelection());
    expect(result.current.hasSelection).toBe(false);
  });

  it('applyColor llama a setHighlights con el rango añadido y limpia la selección', async () => {
    const setHighlights = jest.fn();
    const { result } = await mount(undefined, setHighlights);
    await act(async () =>
      result.current.onSelectionChange.evangelio({ start: 0, end: 5 }),
    );
    await act(async () => result.current.applyColor('sun'));

    expect(setHighlights).toHaveBeenCalledWith(
      '2026-08-22',
      'evangelio',
      [{ start: 0, end: 5, color: 'sun', text: 'Amaos' }],
      readings,
    );
    expect(result.current.hasSelection).toBe(false);
  });

  it('applyColor con un target explícito conserva la selección marcada', async () => {
    const setHighlights = jest.fn();
    const { result } = await mount(undefined, setHighlights);
    await act(async () =>
      result.current.applyColor('mint', {
        source: 'lectura1',
        sel: { start: 0, end: 7 },
      }),
    );
    expect(setHighlights).toHaveBeenCalledWith(
      '2026-08-22',
      'lectura1',
      expect.any(Array),
      readings,
    );
    // Con target, la selección queda "puesta" (no se limpia del todo).
    expect(result.current.hasSelection).toBe(true);
  });

  it('applyColor sin ninguna selección activa no hace nada', async () => {
    const setHighlights = jest.fn();
    const { result } = await mount(undefined, setHighlights);
    await act(async () => result.current.applyColor('sun'));
    expect(setHighlights).not.toHaveBeenCalled();
  });

  it('erase quita el subrayado del tramo seleccionado', async () => {
    const setHighlights = jest.fn();
    const bookmark: StoredBookmark = {
      date: '2026-08-22',
      highlights: {
        evangelio: [{ start: 0, end: 27, color: 'sun', text: readings.evangelio!.texto }],
      },
    } as unknown as StoredBookmark;
    const { result } = await mount(bookmark, setHighlights);
    await act(async () =>
      result.current.onSelectionChange.evangelio({ start: 0, end: 5 }),
    );
    await act(async () => result.current.erase());
    expect(setHighlights).toHaveBeenCalled();
    const [, , newRanges] = setHighlights.mock.calls[0];
    expect(newRanges.every((r: { start: number }) => r.start >= 5)).toBe(true);
    expect(result.current.hasSelection).toBe(false);
  });

  it('erase sin selección activa no hace nada', async () => {
    const setHighlights = jest.fn();
    const { result } = await mount(undefined, setHighlights);
    await act(async () => result.current.erase());
    expect(setHighlights).not.toHaveBeenCalled();
  });

  it('selection refleja el color existente bajo la selección activa', async () => {
    const bookmark: StoredBookmark = {
      date: '2026-08-22',
      highlights: {
        evangelio: [{ start: 0, end: 5, color: 'rose', text: 'Amaos' }],
      },
    } as unknown as StoredBookmark;
    const { result } = await mount(bookmark);
    await act(async () =>
      result.current.onSelectionChange.evangelio({ start: 0, end: 5 }),
    );
    expect(result.current.selection).toEqual({ color: 'rose', full: true });
  });
});
