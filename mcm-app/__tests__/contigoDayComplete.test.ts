import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DAY_COMPLETE_KEY,
  dayCompleteParticles,
  hasCelebratedDay,
  markDayCelebrated,
  resetDayCompleteSession,
} from '@/utils/contigoDayComplete';

beforeEach(async () => {
  await AsyncStorage.clear();
  resetDayCompleteSession();
  jest.restoreAllMocks();
});

describe('celebración del día completo', () => {
  it('el primer día no está celebrado', async () => {
    await expect(hasCelebratedDay('2026-10-17')).resolves.toBe(false);
  });

  it('una vez marcado, ese día no se vuelve a celebrar (ni tras reiniciar)', async () => {
    await markDayCelebrated('2026-10-17');
    expect(await AsyncStorage.getItem(DAY_COMPLETE_KEY)).toBe('2026-10-17');
    await expect(hasCelebratedDay('2026-10-17')).resolves.toBe(true);
    // «Reinicio de la app»: se pierde la memoria, queda el storage.
    resetDayCompleteSession();
    await expect(hasCelebratedDay('2026-10-17')).resolves.toBe(true);
  });

  it('al día siguiente se celebra otra vez', async () => {
    await markDayCelebrated('2026-10-17');
    await expect(hasCelebratedDay('2026-10-18')).resolves.toBe(false);
  });

  it('si el storage falla, se celebra como mucho una vez por sesión', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValue(new Error('nope'));
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValue(new Error('nope'));
    await expect(hasCelebratedDay('2026-10-17')).resolves.toBe(false);
    await expect(markDayCelebrated('2026-10-17')).resolves.toBeUndefined();
    await expect(hasCelebratedDay('2026-10-17')).resolves.toBe(true);
  });
});

describe('dayCompleteParticles', () => {
  it('reparte los tres colores de los hábitos a partes iguales', () => {
    const p = dayCompleteParticles(['#a', '#b', '#c']);
    expect(p).toHaveLength(9);
    for (const c of ['#a', '#b', '#c']) {
      expect(p.filter((x) => x.c === c)).toHaveLength(3);
    }
  });
});
