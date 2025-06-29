// constants/typography.ts
import { TextStyle } from 'react-native';

const typography = {
  h1: { fontSize: 28, fontWeight: 'bold' as const },
  h2: { fontSize: 22, fontWeight: '600' as const },
  body: { fontSize: 16 },
  caption: { fontSize: 13 },
  button: { fontSize: 15, fontWeight: '500' as const },
} as const;

export type Typography = {
  [key in keyof typeof typography]: TextStyle;
};

export default typography as Typography;
// This file contains the typography styles used in the application.
