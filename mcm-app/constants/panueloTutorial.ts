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
 *     - `title`: corto, de 1 a 4 palabras. Se pinta grande.
 *     - `body`: la frase de entrada: una o dos frases cortas, de tú, sin
 *       exclamaciones de más ni lenguaje de marketing (`design.md` §8). Solo lo
 *       que la app hace HOY: si una función no existe, no se cuenta.
 *     - `steps` (opcional): 2–3 pasos numerados para un «cómo se hace».
 *     - `rows` (opcional): filas «icono + título + descripción», como las
 *       hojas de «Novedades» de Apple. Aquí va lo que no cabe en la frase de
 *       entrada: lo que se une a un paso en vez de ser otro.
 *     Una introducción tiene de 6 a 7 pasos como mucho: si algo nuevo va
 *     junto a un paso que ya existe, funde las dos cosas (una fila más) en
 *     lugar de añadir una página.
 *     - `example` (opcional): lo que hace el visor mientras se lee el paso.
 *       Es UN solo visor (el de la pantalla) con otro estado; cada paso lo deja
 *       como lo explica:
 *         · `color` y `pieces`: la tela y los ids de piezas del catálogo de
 *           ejemplo (`constants/panueloEjemplo.json`; se cosen en los primeros
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
import type { MaterialIcons } from '@/components/ui/icons';
import type { PanueloColor } from '@/types/panuelo';

/** Se guarda al terminar el tutorial; si es mayor que lo guardado, se vuelve a enseñar. */
export const PANUELO_TUTORIAL_VERSION = 4;

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

/** Una fila de la hoja: icono a la izquierda, título y descripción. */
export interface PanueloTutorialRow {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  text?: string;
}

export interface PanueloTutorialSection {
  id: string;
  title: string;
  /** La frase de entrada. */
  body: string;
  /** Un «cómo se hace» en 2–3 pasos numerados, bajo la frase de entrada. */
  steps?: string[];
  /** Filas «icono + título + descripción», bajo los pasos. */
  rows?: PanueloTutorialRow[];
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
    body: 'Este es tu pañuelo, en 3D.',
    rows: [
      {
        icon: '3d-rotation',
        title: 'Gíralo y acércalo',
        text: 'Con un dedo lo giras; con dos, te acercas.',
      },
      {
        icon: 'palette',
        title: 'Su color es tu etapa',
        text: 'Rojo, verde, azul o amarillo, según tu etapa en el movimiento.',
      },
      {
        icon: 'cloud-done',
        title: 'Se guarda solo',
        text: 'En tu cuenta si has iniciado sesión; si no, solo en este móvil.',
      },
    ],
    example: {
      color: 'green',
      pieces: ['pionero-alpha', 'corazon-consolacion'],
    },
  },
  {
    id: 'las-piezas',
    title: 'Chapas y pines',
    body: 'Tu pañuelo se llena de chapas, pines, cintas, parches, medallas y pulseras que consigues participando.',
    rows: [
      {
        icon: 'groups',
        title: 'Para todos',
        text: 'Algunas te llegan solo por abrir el pañuelo.',
      },
      {
        icon: 'vpn-key',
        title: 'Con un código',
        text: 'Se da en la actividad.',
      },
      {
        icon: 'card-giftcard',
        title: 'Repartidas',
        text: 'Te las da la organización.',
      },
    ],
    example: { color: 'green', pieces: SIX, art: SIX },
  },
  {
    id: 'canjear',
    title: 'Canjear un código',
    body: 'Con el código de una actividad consigues una chapa o un pin nuevo. Si te llega un enlace, abre el pañuelo con el código ya escrito.',
    steps: [
      'Pulsa «Canjear» en tu colección.',
      'Escribe el código que te han dado.',
      'Aparece en tu pañuelo, lista para verla.',
    ],
    example: {
      color: 'green',
      pieces: ['pionero-alpha', 'corazon-consolacion', 'parche-pascua'],
      reveal: 'parche-pascua',
    },
  },
  {
    id: 'verlas-de-cerca',
    title: 'Verlas de cerca',
    body: 'Toca una chapa o un pin, en el pañuelo o en tu colección, y sale para que le des vueltas.',
    rows: [
      {
        icon: 'info-outline',
        title: 'Su ficha',
        text: 'Qué es, de dónde viene y cuándo la conseguiste.',
      },
      {
        icon: 'zoom-in',
        title: 'Medallas',
        text: 'Las que tienen modelo propio ofrecen «Verla de cerca».',
      },
    ],
    example: { color: 'green', pieces: SIX, focus: 'medalla-jubileo-2025' },
  },
  {
    id: 'tu-coleccion',
    title: 'Tu colección',
    body: 'Debajo del pañuelo está tu colección: lo que tienes y, en silueta, lo que te falta.',
    rows: [
      {
        icon: 'filter-list',
        title: 'Filtrar',
        text: '«Puestas» son las que llevas cosidas; «Sin poner», las que tienes guardadas.',
      },
      {
        icon: 'ios-share',
        title: 'Compartir',
        text: 'El botón de arriba a la derecha hace una foto de tu pañuelo para mandarla.',
      },
      {
        icon: 'swap-horiz',
        title: 'Intercambiar',
        text: 'Las pulseras y las chapas comunes se cambian en persona: una enseña su código y la otra lo escribe. Hace falta haber entrado con tu cuenta.',
      },
    ],
    example: { color: 'green', pieces: SIX },
  },
  {
    id: 'decorarlo',
    title: 'Decorarlo',
    body: 'Coses las chapas y los pines donde quieras. Los que quitas no se pierden: vuelven a tu colección.',
    steps: [
      'Entra en «Decorar».',
      'Arrastra uno para moverlo. En su ficha puedes girarlo o quitarlo.',
      'Pulsa «Listo».',
    ],
    rows: [
      {
        icon: 'auto-fix-high',
        title: 'Recolocar',
        text: 'Si queda revuelto, los reparte todos para que no se pisen. Antes te pregunta, porque deshace lo que habías puesto.',
      },
    ],
    example: {
      color: 'green',
      pieces: SIX,
      mode: 'edit',
      select: 'corazon-consolacion',
    },
  },
  {
    id: 'cambiar-de-etapa',
    title: 'Cambiar de etapa',
    body: 'Al cambiar de etapa cambias de pañuelo. Si tu etapa viene de Comunica, la app lo detecta y te lo propone; si no, toca tú el color nuevo.',
    rows: [
      {
        icon: 'swap-horiz',
        title: 'Tú decides',
        text: 'Mantienes tus chapas y pines, o empiezas de cero. En cualquier caso, los conservas.',
      },
      {
        icon: 'history',
        title: 'Mis pañuelos',
        text: 'El de antes se guarda como recuerdo. Lo ves con el botón del reloj, junto a «Canjear», y con «Volver» regresas al tuyo.',
      },
    ],
    example: {
      color: 'green',
      pieces: ['pionero-alpha', 'corazon-consolacion', 'parche-pascua'],
      toColor: 'blue',
    },
  },
];
