/**
 * Las fotos de las fichas (plan 05): la precarga no presta el token de una
 * foto de nuestro servidor a las de otro dominio.
 */
import { Image } from 'expo-image';
import { prefetchPhotos } from '@/services/comunica/photos';

jest.mock('expo-image', () => ({
  Image: { prefetch: jest.fn().mockResolvedValue(true) },
}));

it('cada foto se pide con sus cabeceras: las ajenas, sin sesión', async () => {
  await prefetchPhotos([
    { uri: 'https://api.test/v1/photos/a', headers: { Authorization: 'B t' } },
    { uri: 'https://otro.example/b.jpg' },
  ]);
  const calls = (Image.prefetch as jest.Mock).mock.calls;
  expect(calls).toEqual([
    [
      ['https://api.test/v1/photos/a'],
      { cachePolicy: 'disk', headers: { Authorization: 'B t' } },
    ],
    [['https://otro.example/b.jpg'], { cachePolicy: 'disk' }],
  ]);
});
