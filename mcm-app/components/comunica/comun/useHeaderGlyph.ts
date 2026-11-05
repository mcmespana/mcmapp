// La tinta de los iconos de la cabecera del área (cuenta, compartir…).
//
// La cabecera lleva el degradado de marca, así que en iOS < 26, Android y web
// el icono va en blanco sobre el degradado. En iOS 26 el sistema pinta cada
// botón de la barra sobre una pastilla de cristal CLARA, y un glifo blanco ahí
// se queda en ~2:1 (medido en el simulador): ahí manda el color adaptativo del
// sistema (`label`), el mismo con el que dibuja la flecha de «atrás», para que
// los botones de una misma barra lleven la misma tinta y se lean en claro y en
// oscuro.

import { Platform, PlatformColor, type OpaqueColorValue } from 'react-native';
import { useComunicaTheme } from './useComunicaTheme';

export function useHeaderGlyph(): string | OpaqueColorValue {
  const t = useComunicaTheme();
  if (Platform.OS === 'ios' && parseInt(String(Platform.Version), 10) >= 26) {
    return PlatformColor('label');
  }
  return t.onGradient;
}
