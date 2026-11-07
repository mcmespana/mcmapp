/**
 * Tests de `hooks/useStatusBarTheme.ts`.
 *
 * Cambia el color de la barra de estado de iOS Safari (PWA) según la página.
 * Si el meta tag equivocado se actualiza, o la detección de iOS falla, la
 * barra de estado se queda con el color de otra sección.
 *
 * No hay DOM real en el entorno de test: se simula `document`/`window` con
 * objetos mínimos que implementan solo lo que el hook usa.
 */
import { renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';
import useStatusBarTheme, {
  getPageThemeColor,
  updateThemeColor,
} from '@/hooks/useStatusBarTheme';

function makeMeta() {
  return { name: '', content: '' };
}

function makeFakeDocument() {
  const metas: Record<string, ReturnType<typeof makeMeta>> = {};
  const head = {
    appendChild: (meta: ReturnType<typeof makeMeta>) => {
      metas[meta.name] = meta;
    },
  };
  return {
    head,
    querySelector: (selector: string) => {
      const match = selector.match(/name="([^"]+)"/);
      const name = match ? match[1] : '';
      return metas[name] ?? null;
    },
    createElement: () => makeMeta(),
    __metas: metas,
  };
}

const originalWindow = (global as { window?: unknown }).window;
const originalDocument = (global as { document?: unknown }).document;

let fakeDocument: ReturnType<typeof makeFakeDocument>;

beforeEach(() => {
  Platform.OS = 'web';
  fakeDocument = makeFakeDocument();
  (global as { document?: unknown }).document = fakeDocument;
  (global as { window?: unknown }).window = {
    navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' },
  };
});

afterEach(() => {
  (global as { window?: unknown }).window = originalWindow;
  (global as { document?: unknown }).document = originalDocument;
});

describe('getPageThemeColor', () => {
  it('devuelve el color configurado para una ruta conocida', () => {
    expect(getPageThemeColor('/calendario')).toBe('#31AADF');
  });

  it('cae al color de "/" para rutas desconocidas', () => {
    expect(getPageThemeColor('/no-existe')).toBe(getPageThemeColor('/'));
  });
});

describe('useStatusBarTheme', () => {
  it('no hace nada fuera de web', async () => {
    Platform.OS = 'ios';
    await renderHook(() => useStatusBarTheme('/jubileo'));
    expect(Object.keys(fakeDocument.__metas)).toHaveLength(0);
  });

  it('no hace nada si el user agent no es iOS', async () => {
    (global as { window?: unknown }).window = {
      navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0)' },
    };
    await renderHook(() => useStatusBarTheme('/jubileo'));
    expect(Object.keys(fakeDocument.__metas)).toHaveLength(0);
  });

  it('crea y actualiza los meta tags para la ruta actual', async () => {
    await renderHook(() => useStatusBarTheme('/jubileo'));
    expect(fakeDocument.__metas['theme-color'].content).toBe('#A3BD31');
    expect(
      fakeDocument.__metas['apple-mobile-web-app-status-bar-style'].content,
    ).toBe('black-translucent');
    expect(fakeDocument.__metas['msapplication-navbutton-color'].content).toBe(
      '#A3BD31',
    );
  });

  it('cae a la config de "/" para rutas sin config específica', async () => {
    await renderHook(() => useStatusBarTheme('/ruta-rara'));
    expect(fakeDocument.__metas['theme-color'].content).toBe('#ffffff');
  });

  it('reutiliza el meta tag existente en vez de crear uno nuevo', async () => {
    const { rerender } = await renderHook(
      ({ pathname }: { pathname: string }) => useStatusBarTheme(pathname),
      { initialProps: { pathname: '/jubileo' } },
    );
    const metaRef = fakeDocument.__metas['theme-color'];
    await rerender({ pathname: '/calendario' });
    expect(fakeDocument.__metas['theme-color']).toBe(metaRef);
    expect(metaRef.content).toBe('#31AADF');
  });
});

describe('updateThemeColor', () => {
  it('no hace nada fuera de web', () => {
    Platform.OS = 'ios';
    updateThemeColor('#000000');
    expect(Object.keys(fakeDocument.__metas)).toHaveLength(0);
  });

  it('no revienta si los meta tags aún no existen', () => {
    expect(() => updateThemeColor('#000000')).not.toThrow();
  });

  it('actualiza los meta tags existentes con el color y estilo dados', async () => {
    await renderHook(() => useStatusBarTheme('/jubileo'));
    updateThemeColor('#123456', 'black');
    expect(fakeDocument.__metas['theme-color'].content).toBe('#123456');
    expect(
      fakeDocument.__metas['apple-mobile-web-app-status-bar-style'].content,
    ).toBe('black');
    expect(fakeDocument.__metas['msapplication-navbutton-color'].content).toBe(
      '#123456',
    );
  });

  it('usa "black-translucent" por defecto', async () => {
    await renderHook(() => useStatusBarTheme('/jubileo'));
    updateThemeColor('#ABCDEF');
    expect(
      fakeDocument.__metas['apple-mobile-web-app-status-bar-style'].content,
    ).toBe('black-translucent');
  });
});
