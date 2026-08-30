/**
 * Tests de `useIncomingPlaylist`: importar una playlist abriendo un fichero
 * `.mcm` (desde WhatsApp, Files…). Lo importante:
 *
 *  - Solo procesa URLs `file://`/`content://` — un deep link normal
 *    (`https://…`) no debe intentar leerse como fichero.
 *  - Entiende los dos formatos: el legacy (array plano de filenames) y el v2
 *    (`{ version: 2, songs: [...] }`).
 *  - En web no hace NADA (ni siquiera pregunta la URL inicial): no hay
 *    `file://` real en un navegador.
 *  - El callback siempre es el más reciente (vía ref), aunque cambie sin
 *    que el efecto se vuelva a suscribir.
 */
import { renderHook, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as FileSystem from 'expo-file-system/legacy';
import { useIncomingPlaylist } from '@/hooks/useIncomingPlaylist';

jest.mock('expo-linking', () => ({
  getInitialURL: jest.fn(() => Promise.resolve(null)),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));
jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: { UTF8: 'utf8' },
}));

function setPlatform(os: string) {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
}

const realOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  setPlatform('ios');
  (Linking.getInitialURL as jest.Mock).mockResolvedValue(null);
  (Linking.addEventListener as jest.Mock).mockReturnValue({
    remove: jest.fn(),
  });
});

afterEach(() => {
  setPlatform(realOS);
});

describe('cold start (getInitialURL)', () => {
  it('importa el .mcm que abrió la app', async () => {
    (Linking.getInitialURL as jest.Mock).mockResolvedValue(
      'file:///tmp/lista.mcm',
    );
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
      JSON.stringify(['a.cho', 'b.cho']),
    );
    const onImport = jest.fn();
    await renderHook(() => useIncomingPlaylist(onImport));
    await waitFor(() => expect(onImport).toHaveBeenCalledWith(['a.cho', 'b.cho']));
  });

  it('ignora una URL que no sea file:// o content://', async () => {
    (Linking.getInitialURL as jest.Mock).mockResolvedValue(
      'https://mcmapp.example/coro?c=1234',
    );
    const onImport = jest.fn();
    await renderHook(() => useIncomingPlaylist(onImport));
    await waitFor(() => expect(Linking.getInitialURL).toHaveBeenCalled());
    expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
    expect(onImport).not.toHaveBeenCalled();
  });

  it('acepta también content://', async () => {
    (Linking.getInitialURL as jest.Mock).mockResolvedValue(
      'content://com.android.providers/lista.mcm',
    );
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
      JSON.stringify(['c.cho']),
    );
    const onImport = jest.fn();
    await renderHook(() => useIncomingPlaylist(onImport));
    await waitFor(() => expect(onImport).toHaveBeenCalledWith(['c.cho']));
  });

  it('sin URL inicial, no llama a onImport', async () => {
    const onImport = jest.fn();
    await renderHook(() => useIncomingPlaylist(onImport));
    await waitFor(() => expect(Linking.getInitialURL).toHaveBeenCalled());
    expect(onImport).not.toHaveBeenCalled();
  });
});

describe('formatos del fichero', () => {
  it('entiende el formato v2 ({ version: 2, songs: [...] })', async () => {
    (Linking.getInitialURL as jest.Mock).mockResolvedValue(
      'file:///tmp/lista.mcm',
    );
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
      JSON.stringify({
        version: 2,
        songs: [{ filename: 'a.cho' }, { filename: 'b.cho' }],
      }),
    );
    const onImport = jest.fn();
    await renderHook(() => useIncomingPlaylist(onImport));
    await waitFor(() => expect(onImport).toHaveBeenCalledWith(['a.cho', 'b.cho']));
  });

  it('un array vacío no dispara onImport', async () => {
    (Linking.getInitialURL as jest.Mock).mockResolvedValue(
      'file:///tmp/lista.mcm',
    );
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
      JSON.stringify([]),
    );
    const onImport = jest.fn();
    await renderHook(() => useIncomingPlaylist(onImport));
    await waitFor(() => expect(FileSystem.readAsStringAsync).toHaveBeenCalled());
    expect(onImport).not.toHaveBeenCalled();
  });

  it('JSON corrupto no revienta ni llama a onImport', async () => {
    (Linking.getInitialURL as jest.Mock).mockResolvedValue(
      'file:///tmp/lista.mcm',
    );
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('no-json');
    const onImport = jest.fn();
    await renderHook(() => useIncomingPlaylist(onImport));
    await waitFor(() => expect(FileSystem.readAsStringAsync).toHaveBeenCalled());
    expect(onImport).not.toHaveBeenCalled();
  });
});

describe('warm start (evento "url" en caliente)', () => {
  it('procesa la URL que llega mientras la app está abierta', async () => {
    let handler: ((e: { url: string }) => void) | null = null;
    (Linking.addEventListener as jest.Mock).mockImplementation((_e, cb) => {
      handler = cb;
      return { remove: jest.fn() };
    });
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
      JSON.stringify(['x.cho']),
    );
    const onImport = jest.fn();
    await renderHook(() => useIncomingPlaylist(onImport));
    await waitFor(() => expect(handler).not.toBeNull());
    await handler!({ url: 'file:///tmp/otra.mcm' });
    await waitFor(() => expect(onImport).toHaveBeenCalledWith(['x.cho']));
  });

  it('usa siempre el onImport más reciente, sin volver a suscribirse', async () => {
    let handler: ((e: { url: string }) => void) | null = null;
    (Linking.addEventListener as jest.Mock).mockImplementation((_e, cb) => {
      handler = cb;
      return { remove: jest.fn() };
    });
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
      JSON.stringify(['y.cho']),
    );
    const onImportA = jest.fn();
    const onImportB = jest.fn();
    const { rerender } = await renderHook(
      ({ cb }: { cb: (songs: string[]) => void }) => useIncomingPlaylist(cb),
      { initialProps: { cb: onImportA } },
    );
    await rerender({ cb: onImportB });
    expect(Linking.addEventListener).toHaveBeenCalledTimes(1);

    await handler!({ url: 'file:///tmp/lista.mcm' });
    await waitFor(() => expect(onImportB).toHaveBeenCalledWith(['y.cho']));
    expect(onImportA).not.toHaveBeenCalled();
  });

  it('quita la suscripción al desmontar', async () => {
    const remove = jest.fn();
    (Linking.addEventListener as jest.Mock).mockReturnValue({ remove });
    const { unmount } = await renderHook(() => useIncomingPlaylist(jest.fn()));
    await unmount();
    expect(remove).toHaveBeenCalled();
  });
});

describe('en web', () => {
  it('no hace nada en absoluto', async () => {
    setPlatform('web');
    const onImport = jest.fn();
    await renderHook(() => useIncomingPlaylist(onImport));
    expect(Linking.getInitialURL).not.toHaveBeenCalled();
    expect(Linking.addEventListener).not.toHaveBeenCalled();
  });
});
