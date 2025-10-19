/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
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
    shadow: '#000000', // Added shadow color for light theme
  },
  dark: {
    text: '#FFFFFF',
    background: '#2C2C2E',
    tint: tintColorDark,
    icon: '#C5C5C7',
    tabIconDefault: '#C5C5C7',
    tabIconSelected: tintColorDark,
    shadow: '#000000', // Added shadow color for dark theme (can be adjusted)
  },
};

// constants/colors.js
export default {
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

// Tab header colors
export const TabHeaderColors = {
  calendario: '#31AADF', // Celeste
  fotos: '#E15C62', // Rojo MIC
  comunica: '#9D1E74dd', // Morado LC con transparencia
};
