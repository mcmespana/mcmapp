import React from 'react';
import { useReorderableDrag } from 'react-native-reorderable-list';
import PlaylistRow from '@/components/playlist/PlaylistRow';

/**
 * Fila del modo "Orden ajustado" dentro de `ReorderableList` (nativo):
 * long-press sobre la fila inicia el arrastre. `useReorderableDrag` solo
 * puede usarse dentro de una celda de la lista, por eso este wrapper.
 */
export const DraggableManualRow: React.FC<
  React.ComponentProps<typeof PlaylistRow>
> = (props) => {
  const drag = useReorderableDrag();
  return <PlaylistRow {...props} onLongPress={drag} />;
};
