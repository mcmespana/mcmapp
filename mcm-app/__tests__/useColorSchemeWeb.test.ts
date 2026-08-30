/**
 * Test de `hooks/useColorScheme.web.ts`.
 *
 * Resuelve el tema claro/oscuro combinando el ajuste del usuario ('system' |
 * 'light' | 'dark') con el esquema del sistema operativo, y sincroniza el
 * `<html>` para que el CSS de la web (Tailwind `dark:`) lo detecte. Si la
 * resolución falla, la web queda con clases de tema mezcladas o el toggle no
 * hace nada.
 */
import { renderHook } from '@testing-library/react-native';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme.web';

let mockTheme: 'light' | 'dark' | 'system' = 'system';

jest.mock('@/contexts/AppSettingsContext', () => ({
  useAppSettings: () => ({ settings: { theme: mockTheme } }),
}));

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  Object.defineProperty(actual, 'useColorScheme', {
    configurable: true,
    value: jest.fn(),
  });
  return actual;
});

function makeFakeDocumentElement() {
  const classes = new Set<string>();
  return {
    dataset: {} as Record<string, string>,
    style: {} as Record<string, string>,
    classList: {
      toggle: (name: string, active: boolean) => {
        if (active) classes.add(name);
        else classes.delete(name);
      },
      has: (name: string) => classes.has(name),
    },
  };
}

const originalDocument = (global as { document?: unknown }).document;
let documentElement: ReturnType<typeof makeFakeDocumentElement>;

beforeEach(() => {
  mockTheme = 'system';
  documentElement = makeFakeDocumentElement();
  (global as { document?: unknown }).document = { documentElement };
});

afterEach(() => {
  (global as { document?: unknown }).document = originalDocument;
  jest.clearAllMocks();
});

describe('useColorScheme (web)', () => {
  it('con theme "system" y dispositivo oscuro, resuelve dark', async () => {
    (useRNColorScheme as jest.Mock).mockReturnValue('dark');
    const { result } = await renderHook(() => useColorScheme());
    expect(result.current).toBe('dark');
    expect(documentElement.dataset.theme).toBe('dark');
    expect(documentElement.classList.has('dark')).toBe(true);
  });

  it('con theme "system" y dispositivo claro, resuelve light', async () => {
    (useRNColorScheme as jest.Mock).mockReturnValue('light');
    const { result } = await renderHook(() => useColorScheme());
    expect(result.current).toBe('light');
    expect(documentElement.classList.has('light')).toBe(true);
  });

  it('con theme "system" y dispositivo null/undefined, cae a light', async () => {
    (useRNColorScheme as jest.Mock).mockReturnValue(null);
    const { result } = await renderHook(() => useColorScheme());
    expect(result.current).toBe('light');
  });

  it('un theme explícito ("dark") ignora el dispositivo', async () => {
    mockTheme = 'dark';
    (useRNColorScheme as jest.Mock).mockReturnValue('light');
    const { result } = await renderHook(() => useColorScheme());
    expect(result.current).toBe('dark');
  });

  it('un theme explícito ("light") ignora el dispositivo', async () => {
    mockTheme = 'light';
    (useRNColorScheme as jest.Mock).mockReturnValue('dark');
    const { result } = await renderHook(() => useColorScheme());
    expect(result.current).toBe('light');
  });

  it('actualiza colorScheme en el estilo del documento', async () => {
    (useRNColorScheme as jest.Mock).mockReturnValue('dark');
    await renderHook(() => useColorScheme());
    expect(documentElement.style.colorScheme).toBe('dark');
  });

  it('no revienta si document no existe', async () => {
    (global as { document?: unknown }).document = undefined;
    (useRNColorScheme as jest.Mock).mockReturnValue('dark');
    await expect(
      renderHook(() => useColorScheme()),
    ).resolves.toBeDefined();
  });
});
