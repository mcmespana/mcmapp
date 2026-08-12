import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

/** Offsets de la selección, en unidades UTF-16 (las mismas que en JS). */
export interface HighlightRequest {
  start: number;
  end: number;
}

export interface HighlightMenuViewProps {
  /** Texto del ítem del menú. Sin castellano incrustado en el nativo. */
  label?: string;
  /** Apaga el ítem sin desmontar la vista. */
  enabled?: boolean;
  /** Se dispara al tocar el ítem, con la selección que había. */
  onHighlightRequest?: (event: { nativeEvent: HighlightRequest }) => void;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}
