import { Platform } from 'react-native';

// Función para convertir CSS font family a nombres nativos de React Native
export const getNativeFontFamily = (cssValue: string): string | undefined => {
  // Antes que «serif»: «sans-serif» contiene «serif» y la letra del sistema
  // salía en la vista previa como Times New Roman.
  if (cssValue.includes('sans-serif') || cssValue.includes('system-ui')) {
    return undefined;
  }
  if (
    cssValue.includes('monospace') ||
    cssValue.includes('Courier') ||
    cssValue.includes('Roboto Mono')
  ) {
    return Platform.OS === 'ios' ? 'Courier' : 'monospace';
  }

  if (
    cssValue.includes('serif') ||
    cssValue.includes('Palatino') ||
    cssValue.includes('Book Antiqua')
  ) {
    return Platform.OS === 'ios' ? 'Times New Roman' : 'serif';
  }

  // Sans-serif - usar undefined para que use la fuente por defecto del sistema
  return undefined;
};
