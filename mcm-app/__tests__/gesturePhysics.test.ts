import {
  rubberBand,
  rubberBandClamp,
  shouldCommitGesture,
  toCoreSpring,
} from '@/utils/gesturePhysics';
import { springs } from '@/constants/animations';

describe('física de gestos (skill gestures)', () => {
  it('sigue 1:1 hasta el límite y cede elástico pasado él', () => {
    expect(rubberBand(40, 100)).toBe(40);
    expect(rubberBand(150, 100)).toBeCloseTo(110);
    expect(rubberBand(-150, 100)).toBeCloseTo(-110);
    expect(rubberBand(50)).toBeCloseTo(10);
  });

  it('rubberBandClamp: dentro intacto, fuera con resistencia', () => {
    expect(rubberBandClamp(-50, -100, 0)).toBe(-50);
    expect(rubberBandClamp(50, -100, 0)).toBeCloseTo(10);
    expect(rubberBandClamp(-150, -100, 0)).toBeCloseTo(-110);
  });

  it('compromete por distancia O por velocidad', () => {
    expect(shouldCommitGesture(120, 0, 80, 500)).toBe(true); // arrastre lento
    expect(shouldCommitGesture(20, 900, 80, 500)).toBe(true); // flick corto
    expect(shouldCommitGesture(-20, -900, 80, 500)).toBe(true);
    expect(shouldCommitGesture(20, 100, 80, 500)).toBe(false);
  });

  it('no compromete si se suelta volviendo hacia atrás con decisión', () => {
    expect(shouldCommitGesture(150, -900, 80, 500)).toBe(false);
    expect(shouldCommitGesture(-150, 900, 80, 500)).toBe(false);
  });

  it('toCoreSpring traduce la forma de Apple (amortiguamiento ζ intacto)', () => {
    const { stiffness, damping, mass } = toCoreSpring(springs.snap);
    expect(mass).toBe(1);
    const zeta = damping / (2 * Math.sqrt(stiffness * mass));
    expect(zeta).toBeCloseTo(springs.snap.dampingRatio);
    // ω = 2π / 0,4 s
    expect(Math.sqrt(stiffness)).toBeCloseTo((2 * Math.PI) / 0.4);
  });
});
