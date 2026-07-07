import { routeForEventId } from '@/utils/notificationEventRoute';
import type { EventConfig } from '@/constants/events';

// Registry falso para no depender de constants/events.ts (que arrastra
// require() de imágenes). Solo se rellenan los campos que usa el helper.
const fakeEvents = {
  visitapapa26: {
    id: 'visitapapa26',
    tabId: 'visitapapa',
  } as unknown as EventConfig,
  jubileo: {
    id: 'jubileo',
    // sin tabId (archivado)
  } as unknown as EventConfig,
};

describe('routeForEventId', () => {
  it('evento con tabId → ruta de su tab', () => {
    expect(routeForEventId('visitapapa26', fakeEvents)).toBe(
      '/(tabs)/visitapapa',
    );
  });

  it('evento sin tabId → /(tabs)/mas', () => {
    expect(routeForEventId('jubileo', fakeEvents)).toBe('/(tabs)/mas');
  });

  it('recorta espacios del id', () => {
    expect(routeForEventId('  visitapapa26  ', fakeEvents)).toBe(
      '/(tabs)/visitapapa',
    );
  });

  it('id desconocido → null (el llamante cae a su comportamiento normal)', () => {
    expect(routeForEventId('inexistente', fakeEvents)).toBeNull();
  });

  it('id vacío/ausente → null', () => {
    expect(routeForEventId(undefined, fakeEvents)).toBeNull();
    expect(routeForEventId(null, fakeEvents)).toBeNull();
    expect(routeForEventId('', fakeEvents)).toBeNull();
  });
});
