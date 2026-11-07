// Módulo nativo: ítem "Subrayar" dentro del menú de selección del sistema.
//
// Envuelve un texto y le añade una acción propia al menú que sale al
// seleccionar (iOS `UIMenu` desde iOS 16, Android `ActionMode`). El resto de
// acciones del sistema —Copiar, Traducir, Buscar, Herramientas de escritura—
// se conservan intactas: el módulo se limita a añadir la suya.
//
// Ver `docs/funcionalidades/SUBRAYADO.md`.

export {
  default as HighlightMenuView,
  isHighlightMenuAvailable,
} from './src/HighlightMenuView';
export type {
  HighlightMenuViewProps,
  HighlightRequest,
} from './src/HighlightMenu.types';
