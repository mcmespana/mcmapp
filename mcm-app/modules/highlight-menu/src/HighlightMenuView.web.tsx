import * as React from 'react';
import { View } from 'react-native';

import type { HighlightMenuViewProps } from './HighlightMenu.types';

/** En web nunca hay módulo nativo, así que el ítem del menú no existe. */
export const isHighlightMenuAvailable = false;

/**
 * En web no hay menú nativo de selección que personalizar: la vista es un
 * contenedor transparente y el subrayado se hace con el modo lápiz de siempre.
 */
export default function HighlightMenuView({
  style,
  children,
}: HighlightMenuViewProps) {
  return <View style={style}>{children}</View>;
}
