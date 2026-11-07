// La foto de perfil se reduce a 800×800 y se recodifica a JPEG en el móvil (expo-image-manipulator): la foto nunca se acerca a los 4 MB.
const mockManipulate = jest.fn();
const mockLibrary = jest.fn();
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: (...a: unknown[]) => mockManipulate(...a),
  SaveFormat: { JPEG: 'jpeg' },
}));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (o: unknown) => mockLibrary(o),
  launchCameraAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' },
}));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('@/services/comunica/localFiles', () => ({
  localFileSize: (uri: string) => (uri === 'file:///small.jpg' ? 120_000 : null),
  deleteLocalCopy: jest.fn(),
}));

import { PHOTO_MAX_SIDE, pickPhoto } from '@/hooks/comunica/pickFile';

const asset = (width: number) => ({
  canceled: false,
  assets: [{ uri: 'file:///big.heic', width, height: width, fileName: 'x', mimeType: 'image/heic', fileSize: 9_000_000 }],
});

beforeEach(() => {
  mockManipulate.mockReset();
  mockLibrary.mockReset();
});

describe('pickPhoto: reducir a 800×800', () => {
  it('una foto grande se reduce a 800 de lado y sale JPEG con su tamaño', async () => {
    mockLibrary.mockResolvedValue(asset(3024));
    mockManipulate.mockResolvedValue({ uri: 'file:///small.jpg' });
    const r = await pickPhoto('library', 0.6);
    expect(mockManipulate).toHaveBeenCalledWith(
      'file:///big.heic',
      [{ resize: { width: PHOTO_MAX_SIDE } }],
      expect.objectContaining({ format: 'jpeg' }),
    );
    expect(r).toEqual({ uri: 'file:///small.jpg', name: 'foto.jpg', mimeType: 'image/jpeg', size: 120_000 });
  });

  it('una foto que ya cabe no se agranda, pero sí se recodifica a JPEG', async () => {
    mockLibrary.mockResolvedValue(asset(500));
    mockManipulate.mockResolvedValue({ uri: 'file:///small.jpg' });
    await pickPhoto('library', 0.6);
    expect(mockManipulate.mock.calls[0][1]).toEqual([]);
  });

  it('si el manipulador falla, sigue con lo elegido (el tope de 4 MB lo comprueba quien llama)', async () => {
    mockLibrary.mockResolvedValue(asset(3024));
    mockManipulate.mockRejectedValue(new Error('x'));
    const r = await pickPhoto('library', 0.6);
    expect(r?.uri).toBe('file:///big.heic');
    expect(r?.size).toBe(9_000_000);
  });

  it('cancelar devuelve null', async () => {
    mockLibrary.mockResolvedValue({ canceled: true, assets: [] });
    expect(await pickPhoto('library', 0.6)).toBeNull();
    expect(mockManipulate).not.toHaveBeenCalled();
  });
});
