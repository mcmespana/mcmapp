/**
 * Tests de `useContigoDayMenu`: qué pasa al pulsar un día de la racha/del
 * calendario. La regla que vale la pena blindar: si solo hay UNA cosa que
 * ver (nada guardado ese día → solo el evangelio), se abre directamente sin
 * pedirle nada a la persona; con varias, se ofrece el submenú.
 */
import { renderHook, act } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { getDayOptions } from '@/components/contigo/DayActionSheet';
import { h } from '@/utils/haptics';
import { useContigoDayMenu } from '@/hooks/useContigoDayMenu';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));
jest.mock('@/components/contigo/DayActionSheet', () => ({
  getDayOptions: jest.fn(),
}));
jest.mock('@/utils/haptics', () => ({
  h: { tap: jest.fn() },
}));

const mockPush = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
});

describe('un solo día con una única opción disponible', () => {
  it('abre esa opción directamente, sin menú ni háptica', async () => {
    (getDayOptions as jest.Mock).mockReturnValue([
      { key: 'evangelio', title: 'Evangelio', subtitle: '', icon: 'x', recorded: false },
    ]);
    const { result } = await renderHook(() => useContigoDayMenu());
    await act(async () => result.current.handleDayPress('2026-08-20', null));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(tabs)/contigo/evangelio',
      params: { date: '2026-08-20' },
    });
    expect(h.tap).not.toHaveBeenCalled();
    expect(result.current.dayMenu).toBeNull();
  });
});

describe('varias opciones disponibles', () => {
  it('no navega directamente: da háptica y abre el submenú', async () => {
    (getDayOptions as jest.Mock).mockReturnValue([
      { key: 'revision', title: 'Revisión', subtitle: '', icon: 'x', recorded: true },
      { key: 'evangelio', title: 'Evangelio', subtitle: '', icon: 'x', recorded: true },
    ]);
    const rec = { date: '2026-08-20', readingDone: true, prayerDone: false, timestamp: 1 };
    const { result } = await renderHook(() => useContigoDayMenu());
    await act(async () => result.current.handleDayPress('2026-08-20', rec));

    expect(mockPush).not.toHaveBeenCalled();
    expect(h.tap).toHaveBeenCalled();
    expect(result.current.dayMenu).toEqual({ date: '2026-08-20', rec });
  });
});

describe('openDay', () => {
  it('cierra el menú y navega a la ruta pedida', async () => {
    (getDayOptions as jest.Mock).mockReturnValue([
      { key: 'a', title: '', subtitle: '', icon: '', recorded: true },
      { key: 'b', title: '', subtitle: '', icon: '', recorded: true },
    ]);
    const { result } = await renderHook(() => useContigoDayMenu());
    await act(async () =>
      result.current.handleDayPress('2026-08-20', {
        date: '2026-08-20',
        readingDone: true,
        prayerDone: true,
        timestamp: 1,
      }),
    );
    expect(result.current.dayMenu).not.toBeNull();

    await act(async () => result.current.openDay('oracion', '2026-08-20'));
    expect(result.current.dayMenu).toBeNull();
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(tabs)/contigo/oracion',
      params: { date: '2026-08-20' },
    });
  });
});

describe('closeDayMenu', () => {
  it('cierra el submenú sin navegar', async () => {
    (getDayOptions as jest.Mock).mockReturnValue([
      { key: 'a', title: '', subtitle: '', icon: '', recorded: true },
      { key: 'b', title: '', subtitle: '', icon: '', recorded: true },
    ]);
    const { result } = await renderHook(() => useContigoDayMenu());
    await act(async () =>
      result.current.handleDayPress('2026-08-20', {
        date: '2026-08-20',
        readingDone: true,
        prayerDone: true,
        timestamp: 1,
      }),
    );
    await act(async () => result.current.closeDayMenu());
    expect(result.current.dayMenu).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
