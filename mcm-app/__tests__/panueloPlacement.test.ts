import {
  clampToFlap,
  nextFreeSlot,
  normalizeRotation,
  placementDistance,
} from '@/utils/panueloPlacement';

describe('clampToFlap', () => {
  it('deja como está un punto que ya cabe', () => {
    expect(clampToFlap(0.2, 0.3)).toEqual([0.2, 0.3]);
  });

  it('cuanto más cerca del pico, menos se puede ir hacia los lados', () => {
    const [top] = clampToFlap(1, 0.1);
    const [low] = clampToFlap(1, 0.8);
    expect(top).toBeGreaterThan(low);
    expect(low).toBeGreaterThan(0);
  });

  it('con valores imposibles devuelve un sitio válido', () => {
    const [u, v] = clampToFlap(NaN, Infinity);
    expect(Number.isFinite(u)).toBe(true);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(1);
  });
});

describe('normalizeRotation', () => {
  it.each([
    [0, 0],
    [360, 0],
    [190, -170],
    [-190, 170],
    [725, 5],
    [NaN, 0],
  ])('%p → %p', (input, expected) => {
    expect(normalizeRotation(input)).toBe(expected);
  });
});

describe('nextFreeSlot', () => {
  it('la primera pieza va arriba, en el centro', () => {
    expect(nextFreeSlot([])).toEqual({ u: 0, v: 0.2, rot: 0 });
  });

  it('veinte piezas seguidas caen dentro y las primeras no se pisan', () => {
    const taken: { u: number; v: number }[] = [];
    for (let i = 0; i < 20; i++) {
      const slot = nextFreeSlot(taken);
      expect(clampToFlap(slot.u, slot.v)).toEqual([slot.u, slot.v]);
      if (i < 11) {
        for (const other of taken) {
          expect(placementDistance(slot, other)).toBeGreaterThanOrEqual(0.3);
        }
      }
      taken.push(slot);
    }
  });

  it('con los huecos buenos llenos, el logo es lo último que se tapa', () => {
    const taken: { u: number; v: number }[] = [];
    for (let i = 0; i < 11; i++) taken.push(nextFreeSlot(taken));
    const next = nextFreeSlot(taken);
    expect(placementDistance(next, { u: 0, v: 0.6 })).toBeGreaterThan(0.25);
  });
});
