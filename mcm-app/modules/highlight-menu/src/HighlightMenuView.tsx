import { requireNativeView, requireOptionalNativeModule } from 'expo';
import * as React from 'react';
import { View } from 'react-native';

import type { HighlightMenuViewProps } from './HighlightMenu.types';

/**
 * ¿Está el módulo nativo DENTRO de este binario?
 *
 * Hace falta preguntarlo porque el ítem del menú es código nativo y no viaja
 * por OTA: un bundle nuevo puede caer sobre un binario viejo. Y si el módulo no
 * está, `requireNativeView` NO lanza — devuelve un componente cuyo nombre de
 * vista nativa no existe, así que React Native lo sustituye por su placeholder
 * de "componente sin implementar". Como esta vista ENVUELVE el texto de la
 * lectura, eso se llevaría por delante el render del texto.
 *
 * Con el módulo ausente devolvemos un `View` pelado: se pierde el ítem del menú
 * (que sin nativo no puede existir) y NADA más — el modo lápiz sigue entero.
 */
export const isHighlightMenuAvailable =
  requireOptionalNativeModule('HighlightMenu') != null;

const NativeView = isHighlightMenuAvailable
  ? requireNativeView<HighlightMenuViewProps>('HighlightMenu')
  : null;

export default function HighlightMenuView(props: HighlightMenuViewProps) {
  if (!NativeView) {
    const { style, children } = props;
    return <View style={style}>{children}</View>;
  }
  return <NativeView {...props} />;
}
