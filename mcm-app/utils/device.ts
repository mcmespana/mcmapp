import { Platform } from 'react-native';

/**
 * ¿La app corre en un iPad? Cualquier iPad, cualquier versión de iOS.
 *
 * `Platform.isPad` es de React Native (no un módulo nativo aparte) y vale
 * `true` solo en iOS con idioma de dispositivo iPad. En iPhone, Android y web
 * es `false`/`undefined`. Un iPad MDM no se distingue de uno normal desde la
 * app: por eso el flag `fotosEnIpad` apaga las fotos en todos.
 */
export function isIpad(): boolean {
  return Platform.OS === 'ios' && Platform.isPad === true;
}
