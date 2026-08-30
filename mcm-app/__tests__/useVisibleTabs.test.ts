/**
 * Test de `hooks/useVisibleTabs.ts`.
 *
 * Oculta el tab del evento en curso si el panel lo archivó
 * (`activities/<id>/_meta.status = 'archived'`). Sin este filtro, archivar un
 * evento desde el panel no tenía ningún efecto visible en la barra de tabs.
 */
import { renderHook } from '@testing-library/react-native';
import { useVisibleTabs } from '@/hooks/useVisibleTabs';

let mockResolved: { tabs: string[] } = { tabs: [] };
let mockActiveEvent: { tabId?: string; status?: string } = {};

jest.mock('@/hooks/useResolvedProfileConfig', () => ({
  useResolvedProfileConfig: () => mockResolved,
}));

jest.mock('@/contexts/ActiveEventContext', () => ({
  useActiveMeta: () => ({ activeEvent: mockActiveEvent }),
}));

beforeEach(() => {
  mockResolved = { tabs: [] };
  mockActiveEvent = {};
});

describe('useVisibleTabs', () => {
  it('devuelve todos los tabs del perfil si el evento activo no está archivado', async () => {
    mockResolved = { tabs: ['index', 'cancionero', 'visitapapa'] };
    mockActiveEvent = { tabId: 'visitapapa', status: 'active' };
    const { result } = await renderHook(() => useVisibleTabs());
    expect(result.current).toEqual(
      new Set(['index', 'cancionero', 'visitapapa']),
    );
  });

  it('quita el tab del evento archivado', async () => {
    mockResolved = { tabs: ['index', 'cancionero', 'visitapapa'] };
    mockActiveEvent = { tabId: 'visitapapa', status: 'archived' };
    const { result } = await renderHook(() => useVisibleTabs());
    expect(result.current).toEqual(new Set(['index', 'cancionero']));
  });

  it('no falla si el evento archivado no tiene tabId', async () => {
    mockResolved = { tabs: ['index', 'cancionero'] };
    mockActiveEvent = { status: 'archived' };
    const { result } = await renderHook(() => useVisibleTabs());
    expect(result.current).toEqual(new Set(['index', 'cancionero']));
  });

  it('no toca la lista si el tab archivado ni siquiera estaba visible', async () => {
    mockResolved = { tabs: ['index'] };
    mockActiveEvent = { tabId: 'visitapapa', status: 'archived' };
    const { result } = await renderHook(() => useVisibleTabs());
    expect(result.current).toEqual(new Set(['index']));
  });
});
