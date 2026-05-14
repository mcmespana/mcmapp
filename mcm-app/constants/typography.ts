// constants/typography.ts
import { Platform, TextStyle } from 'react-native';

const typography = {
  /** Títulos hero (34px) — Contigo y futuras pantallas con presencia */
  h0: {
    fontSize: 34,
    fontWeight: '800' as const,
    letterSpacing: -1.4,
  },
  /** Títulos de pantalla (28px) */
  h1: { fontSize: 28, fontWeight: 'bold' as const },
  /** Subtítulos, secciones (22px) */
  h2: { fontSize: 22, fontWeight: '600' as const },
  /** Texto general (16px) */
  body: { fontSize: 16 },
  /** Texto auxiliar, metadatos (13px) */
  caption: { fontSize: 13 },
  /** Botones, labels de acción (15px) */
  button: { fontSize: 15, fontWeight: '500' as const },
  /** Kicker / overline — labels uppercase pequeñas con tracking */
  overline: {
    fontSize: 10,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  /** Serif — para lecturas litúrgicas y textos contemplativos largos */
  serif: {
    fontFamily: Platform.OS === 'ios' ? 'Palatino' : ('serif' as const),
  },
} as const;

export type Typography = {
  [key in keyof typeof typography]: TextStyle;
};

export default typography as Typography;
