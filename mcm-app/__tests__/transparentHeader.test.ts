/**
 * `components/tabs/transparentHeader.ts`: la cabecera transparente de las
 * portadas de pestaña (Inicio y Más). Solo iOS; en Android y web tiene que
 * seguir opaca, o el contenido quedaría debajo sin hueco reservado.
 */
import { Platform } from 'react-native';
import { transparentHeaderOptions } from '@/components/tabs/transparentHeader';

function conPlataforma(os: string, version: string | number, fn: () => void) {
  const osSpy = jest.replaceProperty(Platform, 'OS', os as never);
  const verSpy = jest
    .spyOn(Platform, 'Version', 'get')
    .mockReturnValue(version as never);
  try {
    fn();
  } finally {
    osSpy.restore();
    verSpy.mockRestore();
  }
}

describe('transparentHeaderOptions', () => {
  it('iOS 26: transparente, sin material (el sistema pone el cristal)', () => {
    conPlataforma('ios', '26.0', () => {
      expect(transparentHeaderOptions()).toEqual({ headerTransparent: true });
    });
  });

  it('iOS anterior a 26: transparente con el material de barra', () => {
    conPlataforma('ios', '18.2', () => {
      expect(transparentHeaderOptions()).toEqual({
        headerTransparent: true,
        headerBlurEffect: 'systemChromeMaterial',
      });
    });
  });

  it('Android y web: opaca', () => {
    conPlataforma('android', 35, () => {
      expect(transparentHeaderOptions()).toEqual({ headerTransparent: false });
    });
    conPlataforma('web', 0, () => {
      expect(transparentHeaderOptions()).toEqual({ headerTransparent: false });
    });
  });
});
