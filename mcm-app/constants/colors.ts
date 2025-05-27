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
    headerBackground: '#f4c11e',
    headerText: '#ffffff',

    // From AppColors
    primary: '#007bff',
    primaryDark: '#0056b3',
    accentYellow: '#f4c11e',
    textLight: '#ffffff',
    textDark: '#212529',
    backgroundLight: '#ffffff',
    modalOverlay: 'rgba(0, 0, 0, 0.5)',
    secondaryText: '#6c757d',

    // From default export
    defaultPrimary:   '#253883',
    secondary: '#95d2f2',
    accent:    '#E15C62',
    info:      '#31AADF',
    success:   '#A3BD31',
    warning:   '#FCD200',
    danger:    '#9D1E74',
    defaultText:      '#002B81',
    defaultBackground:'#ffffff',
    white:     '#ffffff',
    black:     '#000000',
  },
  dark: {
    text: '#ECEDEE',
    background: '#343A40',
    tint: tintColorDark,
    icon: '#ADB5BD',
    tabIconDefault: '#ADB5BD',
    tabIconSelected: tintColorDark,
    headerBackground: '#212529',
    headerText: '#ECEDEE',

    // From AppColors
    primary: '#3390ff',
    primaryDark: '#1a70cc',
    accentYellow: '#f4c11e',
    textLight: '#ffffff',
    textDark: '#E0E0E0',
    backgroundLight: '#424242',
    modalOverlay: 'rgba(0, 0, 0, 0.6)',
    secondaryText: '#adb5bd',

    // From default export
    defaultPrimary: '#5F7BC8',
    secondary: '#B0E0E6',
    accent: '#F08080',
    info: '#7BC8F0',
    success: '#B8D05A',
    warning: '#FFD700',
    danger: '#C75DAA',
    defaultText: '#D0DFFF',
    defaultBackground: '#3A3A3A',
    white: '#ffffff',
    black: '#000000',
  },

  
};
