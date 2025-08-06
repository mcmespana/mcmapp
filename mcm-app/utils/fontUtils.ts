import { Platform } from 'react-native';

// Mapeo de fuentes CSS a fuentes nativas de React Native
export const getFontMapping = () => {
  if (Platform.OS === 'ios') {
    return {
      monospace: {
        css: "'Roboto Mono', 'Courier New', monospace",
        native: 'Courier'
      },
      serif: {
        css: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
        native: 'Times New Roman'
      },
      sansSerif: {
        css: "'Helvetica Neue', 'Arial', sans-serif",
        native: 'Helvetica Neue'
      }
    };
  } else {
    // Android
    return {
      monospace: {
        css: "'Roboto Mono', 'Courier New', monospace",
        native: 'monospace'
      },
      serif: {
        css: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
        native: 'serif'
      },
      sansSerif: {
        css: "'Helvetica Neue', 'Arial', sans-serif",
        native: 'normal' // Usar 'normal' en Android para asegurar diferencia con serif
      }
    };
  }
};

// Función para convertir CSS font family a nombres nativos de React Native
export const getNativeFontFamily = (cssValue: string): string | undefined => {
  if (cssValue.includes('monospace') || cssValue.includes('Courier') || cssValue.includes('Roboto Mono')) {
    return Platform.OS === 'ios' ? 'Courier' : 'monospace';
  }
  
  if (cssValue.includes('serif') || cssValue.includes('Palatino') || cssValue.includes('Book Antiqua')) {
    return Platform.OS === 'ios' ? 'Times New Roman' : 'serif';
  }
  
  // Sans-serif - usar undefined para que use la fuente por defecto del sistema
  return undefined;
};

// Función para obtener el valor CSS desde el valor nativo
export const getCSSFromNative = (nativeValue: string): string => {
  const mapping = getFontMapping();
  
  if (nativeValue === mapping.monospace.native) {
    return mapping.monospace.css;
  }
  
  if (nativeValue === mapping.serif.native) {
    return mapping.serif.css;
  }
  
  // Sans-serif (default)
  return mapping.sansSerif.css;
};
