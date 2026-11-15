/**
 * El tutorial del pañuelo: unos pasos que se enseñan a pantalla completa la
 * primera vez que se abre la pantalla y siempre que se pulsa el «?» de la
 * cabecera. Sustituye a los textos de ayuda sueltos que antes había por la
 * pantalla.
 *
 * Es DATOS, para ampliarlo sin tocar la pantalla:
 *
 *  1. Añade un objeto al array de abajo, en el orden en que debe verse.
 *     - `id`: único y estable (kebab-case).
 *     - `title`: corto, de 1 a 4 palabras.
 *     - `body`: dos a cuatro frases cortas, de tú, sin exclamaciones de más ni
 *       lenguaje de marketing (`design.md` §8). Solo lo que la app hace HOY:
 *       si una función no existe, no se cuenta.
 *     - `steps` (opcional): 2–3 pasos numerados para un «cómo se hace».
 *     - `example` (opcional): lo que hace el visor mientras se lee el paso.
 *       Es UN solo visor (el de la pantalla) con otro estado; cada paso lo deja
 *       como lo explica:
 *         · `color` y `pieces`: la tela y los ids de piezas del catálogo de
 *           muestra (`firebase-seed/panuelo.json`; se cosen en los primeros
 *           huecos). Imprescindibles.
 *         · `mode: 'edit'`: el visor en modo decorar.
 *         · `select`: una pieza seleccionada (con `mode: 'edit'`).
 *         · `focus`: una pieza enfocada, flotando delante.
 *         · `reveal`: una pieza que se presenta, como al canjear un código.
 *         · `toColor`: al cabo de un momento la tela cambia a este color.
 *         · `art`: ids que se dibujan en plano bajo el texto.
 *  2. Cuando el cambio sea de verdad (una función nueva o una que cambia),
 *     SUBE `PANUELO_TUTORIAL_VERSION`: quien ya lo vio lo verá otra vez una vez.
 *     Para retocar una frase, no la subas.
 *  3. Pon el cambio en `docs/funcionalidades/PANUELO.md` y en el CHANGELOG.
 */
import type { PanueloColor } from '@/types/panuelo';

/** Se guarda al terminar el tutorial; si es mayor que lo guardado, se vuelve a enseñar. */
export const PANUELO_TUTORIAL_VERSION = 2;

export interface PanueloTutorialExample {
  color: PanueloColor;
  /** Ids del catálogo de muestra que lleva cosidas el pañuelo de ejemplo. */
  pieces?: string[];
  /** El visor en modo decorar. */
  mode?: 'view' | 'edit';
  /** Pieza seleccionada (modo decorar). */
  select?: string;
  /** Pieza enfocada: flota delante del pañuelo. */
  focus?: string;
  /** Pieza que se presenta como recién conseguida. */
  reveal?: string;
  /** La tela cambia a este color pasado un momento. */
  toColor?: PanueloColor;
  /** Ids que se dibujan en plano bajo el texto. */
  art?: string[];
}

export interface PanueloTutorialSection {
  id: string;
  title: string;
  body: string;
  /** Un «cómo se hace» en 2–3 pasos numerados, bajo el texto. */
  steps?: string[];
  example?: PanueloTutorialExample;
}

const SIX = [
  'pionero-alpha',
  'corazon-consolacion',
  'cinta-campamento',
  'parche-pascua',
  'medalla-jubileo-2025',
  'pulsera-amistad',
];

export const PANUELO_TUTORIAL: readonly PanueloTutorialSection[] = [
  {
    id: 'tu-panuelo',
    title: 'Tu pañuelo',
    body: 'Este es tu pañuelo, en 3D. Gíralo con el dedo y acércalo con dos. Su color es tu etapa en el movimiento. Con la sesión iniciada se guarda en tu cuenta; sin ella, solo en este móvil.',
    example: {
      color: 'green',
      pieces: ['pionero-alpha', 'corazon-consolacion'],
    },
  },
  {
    id: 'las-piezas',
    title: 'Las piezas',
    body: 'Chapas, pines, cintas, parches, medallas y pulseras. Se consiguen por participar en las actividades: unas son para todos, otras llegan con un código y otras te las reparte la organización.',
    example: { color: 'green', pieces: SIX, art: SIX },
  },
  {
    id: 'verlas-de-cerca',
    title: 'Verlas de cerca',
    body: 'Toca una pieza, en el pañuelo o en tu colección de abajo, y sale para que le des vueltas. En su ficha ves qué es, de dónde viene y cuándo la conseguiste. Las medallas con modelo propio tienen «Verla de cerca».',
    example: {
      color: 'green',
      pieces: SIX,
      focus: 'medalla-jubileo-2025',
    },
  },
  {
    id: 'decorarlo',
    title: 'Decorarlo',
    body: 'Las piezas se cosen donde tú quieras. Las que quitas no se pierden: vuelven a tu colección.',
    steps: [
      'Entra en «Decorar».',
      'Arrastra una pieza para moverla. En su ficha puedes girarla o quitarla.',
      'Pulsa «Listo».',
    ],
    example: {
      color: 'green',
      pieces: SIX,
      mode: 'edit',
      select: 'corazon-consolacion',
    },
  },
  {
    id: 'recolocar',
    title: 'Recolocar',
    body: 'Si tienes muchas piezas y el pañuelo ha quedado revuelto, «Recolocar» las reparte todas para que no se pisen. Aparece en «Decorar» y antes te pregunta, porque deshace cómo las habías puesto.',
    example: { color: 'green', pieces: SIX, mode: 'edit' },
  },
  {
    id: 'canjear',
    title: 'Canjear un código',
    body: 'Algunas piezas se consiguen con un código que se da en la actividad. También puede llegar en un enlace que abre el pañuelo con el código ya escrito.',
    steps: [
      'Pulsa «Canjear» en tu colección.',
      'Escribe el código que te han dado.',
      'La pieza aparece en tu pañuelo.',
    ],
    example: {
      color: 'green',
      pieces: ['pionero-alpha', 'corazon-consolacion', 'parche-pascua'],
      reveal: 'parche-pascua',
    },
  },
  {
    id: 'tu-coleccion',
    title: 'Tu colección',
    body: 'Debajo del pañuelo está tu colección: lo que tienes y, en silueta, lo que te falta. Con el filtro eliges qué ver: «Todas», «Puestas» (las que llevas cosidas) o «Sin poner» (las que tienes guardadas).',
    example: {
      color: 'green',
      pieces: ['pionero-alpha', 'corazon-consolacion'],
    },
  },
  {
    id: 'compartir',
    title: 'Compartir',
    body: 'El botón de compartir, arriba a la derecha del pañuelo, hace una foto de cómo lo llevas ahora para que se la mandes a quien quieras.',
    example: { color: 'green', pieces: SIX },
  },
  {
    id: 'cambiar-de-etapa',
    title: 'Cambiar de etapa',
    body: 'Al cambiar de etapa cambias de pañuelo. Si tu etapa viene de Comunica, la app lo detecta y te lo propone; si no, toca tú el color nuevo. Eliges si mantienes tus chapas y pines o empiezas de cero. En cualquier caso las conservas.',
    example: {
      color: 'green',
      pieces: ['pionero-alpha', 'corazon-consolacion', 'parche-pascua'],
      toColor: 'blue',
    },
  },
  {
    id: 'mis-panuelos',
    title: 'Mis pañuelos',
    body: 'Cada vez que cambias de etapa, el pañuelo de antes se guarda como recuerdo si llevaba alguna pieza. Los ves con el botón del reloj, junto a «Canjear». Se miran en 3D, solo para ver, y con «Volver» regresas al tuyo.',
    example: {
      color: 'red',
      pieces: ['pionero-alpha', 'cinta-campamento'],
    },
  },
];
