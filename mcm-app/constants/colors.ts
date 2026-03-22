/**
 * Design tokens de color para la app MCM.
 * Fuente única de verdad — no definir colores en otros archivos.
 */

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    shadow: '#000000',
    card: '#FFFFFF',
  },
  dark: {
    text: '#FFFFFF',
    background: '#2C2C2E',
    tint: tintColorDark,
    icon: '#C5C5C7',
    tabIconDefault: '#C5C5C7',
    tabIconSelected: tintColorDark,
    shadow: '#000000',
    card: '#3A3A3C',
  },
};

// Colores de marca MCM
const brand = {
  primary: '#253883', // Azul fondo
  secondary: '#95d2f2', // Azul letras
  accent: '#E15C62', // Rojo MIC
  info: '#31AADF', // Celeste
  success: '#A3BD31', // Verde COM
  warning: '#FCD200', // Amarillo COM
  danger: '#9D1E74', // Morado LC
  text: '#002B81', // Azul COM
  background: '#ffffff', // Fondo blanco
  white: '#ffffff', // Blanco
  black: '#000000', // Negro
  border: '#E0E0E0', // Gris claro para bordes
};

export default brand;

// Colores de UI para componentes interactivos (FABs, botones, etc.)
export const UIColors = {
  activePrimary: '#007bff', // Azul — elementos activos, bordes de FABs
  activePrimaryDark: '#0056b3', // Azul oscuro — bordes FABs activos
  accentYellow: '#f4c11e', // Amarillo — FAB principal
  textLight: '#ffffff', // Texto blanco
  textDark: '#212529', // Texto oscuro
  backgroundLight: '#ffffff', // Fondo blanco para FABs inactivos
  modalOverlay: 'rgba(0, 0, 0, 0.5)',
  secondaryText: '#6c757d', // Gris secundario
} as const;

// Colores de tabs (cabecera)
export const TabHeaderColors = {
  cancionero: '#f4c11e', // Amarillo Cantoral
  contigo: '#6B3FA0', // Morado espiritual — Contigo
  calendario: '#31AADF', // Celeste
  fotos: '#E15C62', // Rojo MIC
  comunica: '#9D1E74dd', // Morado LC con transparencia
};

// Colores de toast — Material Design estándar
export const ToastColors = {
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
  info: '#2196F3',
} as const;
