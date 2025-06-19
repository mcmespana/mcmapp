import { Platform } from 'react-native';
import colors from './colors'; // Assuming black is defined in your colors.ts or use a hardcoded '#000'

export const commonShadow = {
  // Common properties for both iOS and Android
  ...Platform.select({
    ios: {
      shadowColor: colors.black, // Or '#000'
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.20, // Slightly more subtle than 0.25
      shadowRadius: 3.00, // Slightly smaller radius
    },
    android: {
      elevation: 4, // Slightly less pronounced elevation
    },
  }),
};

// You can add other common UI styles here, for example, border styles
export const commonBorder = {
  borderWidth: 1,
  borderColor: colors.border, // Assuming a border color is in colors.ts
};

export const textShadow = {
  textShadowColor: 'rgba(0, 0, 0, 0.5)', // A semi-transparent black
  textShadowOffset: { width: 0, height: 1 }, // Shadow slightly below the text
  textShadowRadius: 2, // A little blur
};

export const pagePadding = {
  paddingHorizontal: 16, // Default horizontal padding
};

export const buttonBorderRadius = {
  borderRadius: 8, // Default border radius for buttons
};

export const commonStyles = {
  textShadow: textShadow,
  pagePadding: pagePadding,
  buttonBorderRadius: buttonBorderRadius,
};
