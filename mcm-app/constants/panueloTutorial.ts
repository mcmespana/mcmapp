/**
 * El tutorial del pañuelo: unas pocas secciones que se enseñan la primera vez
 * que se abre la pantalla y siempre que se pulsa el botón de información.
 * Sustituye a los textos de ayuda sueltos que antes había por la pantalla.
 *
 * Es DATOS, para ampliarlo sin tocar la pantalla:
 *
 *  1. Añade un objeto al array de abajo, en el orden en que debe verse.
 *     - `id`: único y estable (kebab-case).
 *     - `title`: corto, de 1 a 4 palabras.
 *     - `body`: dos o tres frases cortas, de tú, sin exclamaciones de más ni
 *       lenguaje de marketing (`design.md` §8). Solo lo que la app hace HOY:
 *       si una función no existe, no se cuenta.
 *     - `example` (opcional): el pañuelo de ejemplo que se ve en el visor
 *       mientras se lee la sección. `color` es el color de la tela y
 *       `pieces` los ids de piezas del catálogo de muestra
 *       (`firebase-seed/panuelo.json`; se pintan en los primeros huecos).
 *       `art` (opcional) son ids para dibujar en plano bajo el texto.
 *  2. Cuando el cambio sea de verdad (una función nueva o una que cambia),
 *     SUBE `PANUELO_TUTORIAL_VERSION`: quien ya lo vio lo verá otra vez una vez.
 *     Para retocar una frase, no la subas.
 *  3. Pon el cambio en `docs/funcionalidades/PANUELO.md` y en el CHANGELOG.
 */
import type { PanueloColor } from '@/types/panuelo';

/** Se guarda al terminar el tutorial; si es mayor que lo guardado, se vuelve a enseñar. */
export const PANUELO_TUTORIAL_VERSION = 1;

export interface PanueloTutorialExample {
  color: PanueloColor;
  /** Ids del catálogo de muestra que lleva cosidas el pañuelo de ejemplo. */
  pieces?: string[];
  /** Ids que se dibujan en plano bajo el texto. */
  art?: string[];
}

export interface PanueloTutorialSection {
  id: string;
  title: string;
  body: string;
  example?: PanueloTutorialExample;
}

export const PANUELO_TUTORIAL: readonly PanueloTutorialSection[] = [
  {
    id: 'tu-panuelo',
    title: 'Tu pañuelo',
    body: 'Este es tu pañuelo, en 3D. Su color es tu etapa en el movimiento. Con la sesión iniciada se guarda en tu cuenta; sin ella, solo en este móvil.',
    example: { color: 'green', pieces: ['pionero-alpha'] },
  },
  {
    id: 'las-piezas',
    title: 'Las piezas',
    body: 'Chapas, pines, cintas, parches, medallas y pulseras. Se consiguen por participar: unas son para todos, otras llegan con un código y otras te las reparten.',
    example: {
      color: 'green',
      pieces: [
        'pionero-alpha',
        'corazon-consolacion',
        'cinta-campamento',
        'parche-pascua',
        'medalla-jubileo-2025',
        'pulsera-amistad',
      ],
      art: [
        'pionero-alpha',
        'corazon-consolacion',
        'cinta-campamento',
        'parche-pascua',
        'medalla-jubileo-2025',
        'pulsera-amistad',
      ],
    },
  },
  {
    id: 'decorarlo',
    title: 'Decorarlo',
    body: 'En «Decorar» arrastras las piezas por el pañuelo, las giras y las quitas. Las que quitas vuelven a tu colección: no se pierden.',
    example: {
      color: 'green',
      pieces: ['pionero-alpha', 'corazon-consolacion', 'parche-pascua'],
    },
  },
  {
    id: 'verlas-de-cerca',
    title: 'Verlas de cerca',
    body: 'Toca una pieza y sale del pañuelo para que le des vueltas. Debajo verás qué es, de dónde viene y cuándo la conseguiste.',
    example: {
      color: 'green',
      pieces: ['pionero-alpha', 'medalla-jubileo-2025', 'cinta-campamento'],
    },
  },
  {
    id: 'cambiar-de-etapa',
    title: 'Cambiar de etapa',
    body: 'Cuando cambias de etapa cambias de pañuelo. El anterior se guarda en «Mis pañuelos» y decides si te llevas las piezas o empiezas limpio.',
    example: {
      color: 'blue',
      pieces: ['pionero-alpha', 'corazon-consolacion'],
    },
  },
];
