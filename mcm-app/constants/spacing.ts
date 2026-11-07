// constants/spacing.ts
export default {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

/**
 * Alto de la barra de pestañas flotante en estado expandido. Es el valor por
 * defecto de `expandedHeight` de expo-native-compact-tabs; lo declaramos aquí
 * para que las pantallas puedan reservar sitio con el mismo número.
 */
export const TAB_BAR_HEIGHT = 78;

/** Alto en estado compacto (valor por defecto de `compactHeight`). */
export const TAB_BAR_COMPACT_HEIGHT = 70;

/**
 * Espacio que una pantalla debe dejar libre al final de su scroll para que la
 * barra no tape el contenido: el alto de la barra más un respiro visual.
 *
 * NO incluye el safe-area inset — para eso está `useTabBarClearance()`, que es
 * lo que hay que usar en las pantallas. Esta constante es para quien necesite
 * el número puro (estilos estáticos, cálculos).
 */
export const TAB_BAR_CLEARANCE = TAB_BAR_HEIGHT + 12;
