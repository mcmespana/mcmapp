// constants/typography.ts
import { Platform, TextStyle } from 'react-native';

/**
 * Escala tipográfica.
 *
 * Cubre los tamaños que la app USA de verdad. Hasta agosto de 2026 solo
 * declaraba siete (10/13/15/16/22/28/34) y los más frecuentes del repo —12, 14,
 * 11, 17, 18— no estaban: por eso casi nadie la importaba y había 666
 * `fontSize` a mano. Un token que no cubre tu caso no se usa, se rodea.
 *
 * Los nombres siguen la escala de iOS, que es de donde vienen los tamaños y
 * con la que ya está alineado el resto del sistema (los grises son los de
 * Apple, las tabs son nativas).
 *
 * ── Pesos ──
 * Un token solo trae `fontWeight` cuando el ROL lo implica; así se puede
 * sobrescribir sin sorpresas y migrar un `fontSize` suelto no cambia el peso.
 *
 * Los pesos salen de lo que la app HACE, no de una escala inventada: a 15 px
 * usa 600/700 en 53 sitios y 500 en 3, así que el 500 que ponía este fichero
 * era el raro. Lo mismo con 17 y 18 px, que van a 700.
 *
 * La escalera baja de peso al bajar de tamaño y nunca sube por encima del
 * nivel de arriba — un `h2` más gordo que un `h1` es la incoherencia que había:
 *
 *   h0 800 · h1/h2/h3 700 · title/button/overline 600 · el resto, normal
 *
 * No bajes de `caption` (13) para texto que haya que leer de verdad.
 */
const typography = {
  /** 34 — hero de pantalla. Uno por pantalla como mucho. */
  h0: {
    fontSize: 34,
    fontWeight: '800' as const,
    letterSpacing: -1.4,
  },
  /** 28 — título de pantalla. */
  h1: { fontSize: 28, fontWeight: '700' as const },
  /** 22 — sección. */
  h2: { fontSize: 22, fontWeight: '700' as const },
  /** 18 — subsección, título de card grande. */
  h3: { fontSize: 18, fontWeight: '700' as const },
  /** 17 — título de card, cabecera de fila. */
  title: { fontSize: 17, fontWeight: '600' as const },
  /** 16 — texto general. */
  body: { fontSize: 16 },
  /** 15 — botones y labels de acción. */
  button: { fontSize: 15, fontWeight: '600' as const },
  /** 14 — texto de apoyo: subtítulos de fila, descripciones. */
  subhead: { fontSize: 14 },
  /** 13 — metadatos, ayuda. El mínimo para texto que hay que leer. */
  caption: { fontSize: 13 },
  /** 12 — pie, notas al margen. */
  footnote: { fontSize: 12 },
  /** 11 — etiquetas mínimas, contadores. No para prosa. */
  micro: { fontSize: 11 },
  /** 10 — kicker uppercase con tracking. */
  overline: {
    fontSize: 10,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  /** Serif — lecturas litúrgicas y textos contemplativos largos (Contigo). */
  serif: {
    fontFamily: Platform.OS === 'ios' ? 'Palatino' : ('serif' as const),
  },
} as const;

export type Typography = {
  [key in keyof typeof typography]: TextStyle;
};

export default typography as Typography;
