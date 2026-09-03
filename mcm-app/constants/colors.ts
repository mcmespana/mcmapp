/**
 * Design tokens de color para la app MCM. **Fuente única de verdad.**
 *
 * Reglas (las largas están en `design.md`, raíz del monorepo):
 *
 * 1. No se escriben hex en componentes. Si falta un color, se añade aquí con
 *    nombre semántico y comentario.
 * 2. Un token se llama por lo que ES, no por dónde se usó primero. Si el
 *    nombre semántico no es verdad en toda la app, se usa el nombre del color
 *    (por eso `green`/`yellow`/`purple` y no `success`/`warning`/`danger`:
 *    el verde pinta Reflexiones y el amarillo las estrellas de valoración —
 *    no son estados).
 * 3. Excepciones sancionadas — hay exactamente dos sitios más con color, y
 *    ambos son identidad deliberada de un territorio (`design.md` §2):
 *      · `components/contigo/theme.ts` — paleta cálida de Contigo.
 *      · `constants/events.ts` — `tintColor` propio de cada evento.
 *    Cualquier otro color fuera de este archivo es un bug.
 * 4. `mcm-app/global.css` NO es una tercera paleta: son las variables del tema
 *    de HeroUI, cuyos nombres pertenecen a HeroUI (su `--accent` es nuestro
 *    `primary`). Se alimentan de los valores de aquí; no las renombres.
 */

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

/**
 * Roles de superficie y texto por modo. Es la ÚNICA capa de roles: no hay un
 * `Surfaces` aparte ni un `TextColors` aparte, porque tener dos familias para
 * lo mismo es justo lo que se está quitando.
 *
 * Los seis roles de abajo del todo (`textStrong` … `separator`) se añadieron
 * en 2026-08 porque no existían y por eso se escribían a mano: había ~110
 * ternarios `isDark ? '#F5F5F7' : '#1C1C1E'` repartidos por la app, con la
 * deriva típica de copiar y pegar (dos grises distintos para el mismo papel:
 * `#A0A0A8`/`#6B6B70` y `#AEAEB2`/`#636366`). Se unificaron en el par con más
 * contraste de los dos.
 */
export const Colors = {
  light: {
    text: '#11181C',
    background: '#ffffff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    shadow: '#000000',
    card: '#FFFFFF',

    /** Títulos y texto que tiene que destacar sobre el cuerpo. */
    textStrong: '#1C1C1E',
    /** Subtítulos, metadatos, texto de apoyo. */
    textSecondary: '#636366',
    /**
     * Terciario: placeholders, leyendas, sellos de tiempo. Lo más tenue que
     * puede ser un TEXTO sin dejar de leerse: 4,5:1 sobre blanco y sobre el
     * gris de los campos (#F2F2F7). Era `#8E8E93`, que se quedaba en 2,9:1.
     */
    textMuted: '#6E6E73',
    /** Enlaces y acciones en texto. En claro es el azul de marca. */
    link: '#253883',
    /** Fondo hundido: lo que va DEBAJO de las cards (listas, agrupaciones). */
    backgroundSunken: '#F2F2F7',
    /** Hairline entre filas. Más sutil que `border`, que es para cajas. */
    separator: '#E5E5EA',
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

    textStrong: '#F5F5F7',
    textSecondary: '#AEAEB2',
    /** Terciario. En oscuro `#8E8E93` ya pasa (5,2:1 sobre el gris de campo). */
    textMuted: '#8E8E93',
    link: '#7AB3FF',
    backgroundSunken: '#1C1C1E',
    separator: '#3A3A3C',
  },
};

/**
 * Resuelve los roles del modo activo.
 *
 * Mismo patrón que `warm(isDark)` de Contigo, para que las dos paletas se usen
 * igual:  `themeColors(isDark).textSecondary`.
 */
export const themeColors = (isDark: boolean) =>
  isDark ? Colors.dark : Colors.light;

/**
 * Grises del sistema de Apple, tal cual. La app ya los usaba —eran los hex más
 * repetidos del repo—, solo que escritos a mano uno por uno.
 *
 * Para roles de texto y superficie usa `Colors`/`themeColors`: esto es la
 * paleta cruda, para cuando de verdad necesitas un gris concreto.
 */
export const SystemGray = {
  light: {
    gray: '#8E8E93',
    gray2: '#AEAEB2',
    gray3: '#C7C7CC',
    gray4: '#D1D1D6',
    gray5: '#E5E5EA',
    gray6: '#F2F2F7',
  },
  dark: {
    gray: '#8E8E93',
    gray2: '#636366',
    gray3: '#48484A',
    gray4: '#3A3A3C',
    gray5: '#2C2C2E',
    gray6: '#1C1C1E',
  },
} as const;

// Colores de marca MCM.
//
// Es una paleta CROMÁTICA (los colores del logo), no semántica: el estado
// («esto ha ido bien», «esto es un error») se expresa con `ToastColors` o
// `SwipeColors`, que son los que sí significan eso en su contexto.
const brand = {
  primary: '#253883', // Azul fondo — identidad MCM
  secondary: '#95d2f2', // Azul letras
  accent: '#E15C62', // Rojo MIC — acento institucional (CTAs, badges)
  info: '#31AADF', // Celeste — enlaces e informativos
  green: '#A3BD31', // Verde COM — Reflexiones, Conso+, duraciones
  // Hay DOS amarillos a cuatro puntos de diferencia y hacen cosas distintas:
  //   · `brand.yellow` (#FCD200) — el de MARCA (amarillo COM). Estrellas de
  //     valoración, categorías, el tab de la Visita del Papa.
  //   · `UIColors.accentYellow` (#f4c11e) — el del CANTORAL. Su tab, su FAB y
  //     el destacado ámbar salen de ahí.
  // Si estás pintando algo del cantoral, el segundo. Si no, este.
  yellow: '#FCD200', // Amarillo COM — estrellas de valoración, Autobuses
  purple: '#9D1E74', // Morado LC — Comunica
  text: '#002B81', // Azul COM — texto de marca
  background: '#ffffff', // Fondo blanco
  white: '#ffffff', // Blanco
  black: '#000000', // Negro
  border: '#E0E0E0', // Gris claro para bordes
};

export default brand;

// Colores de UI para componentes interactivos.
//
// Tenía nueve claves y CUATRO no las usaba nadie (`activePrimaryDark`,
// `textLight`, `textDark`, `backgroundLight`). Borradas en agosto de 2026: un
// token muerto no es inofensivo, es una respuesta plausible a la pregunta
// equivocada.
export const UIColors = {
  /** Azul de acción del sistema (iOS): botones y enlaces nativos. */
  iosBlue: '#007AFF',
  /**
   * Azul de los ACORDES del cantoral. Es un azul web (#007bff), 1 punto de
   * tono por debajo del `iosBlue` del sistema — no son el mismo color ni el
   * mismo papel, y el nombre lo escondía. Vive en el HTML que genera
   * `useSongProcessor`, no en la UI nativa.
   */
  chordBlue: '#007bff',
  /** Gris del texto secundario DENTRO del HTML de una canción. */
  chordSecondaryText: '#6c757d',
  /** Amarillo del cantoral — FAB principal y color de su tab. */
  accentYellow: '#f4c11e',
  modalOverlay: 'rgba(0, 0, 0, 0.5)',
} as const;

// Colores de tabs (cabecera)
export const TabHeaderColors = {
  cancionero: '#f4c11e', // Amarillo Cantoral
  visitapapa: '#FCD200', // Amarillo Vaticano — Visita Papa
  calendario: '#31AADF', // Celeste
  fotos: '#E15C62', // Rojo MIC
  comunica: 'rgba(157, 30, 116, 0.87)', // Morado LC con transparencia
  contigo: '#B8860B', // Dorado cálido - Contigo
};

// Colores de toast — Material Design estándar
export const ToastColors = {
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
  info: '#2196F3',
} as const;

// Estados visuales compartidos (selección, hover, pressed)
// Usado en SongListItem y futuros componentes con estado seleccionado.
export const StateColors = {
  selectedBgLight: '#E8F5E9', // Fondo de item seleccionado en light
  selectedBgDark: '#1A3320', // Fondo de item seleccionado en dark
  hoverOverlay: 'rgba(0, 0, 0, 0.04)',
  hoverOverlayDark: 'rgba(255, 255, 255, 0.06)',
  pressedOverlay: 'rgba(0, 0, 0, 0.08)',
  pressedOverlayDark: 'rgba(255, 255, 255, 0.10)',
} as const;

// Swipe action colors en SongListItem — Apple system colors
export const SwipeColors = {
  add: '#34C759', // Apple system green — swipe derecho "Seleccionar"
  remove: '#FF453A', // Apple system red — swipe izquierdo "Quitar"
} as const;

// Key pill background en SongListItem
export const KeyPillColors = {
  bgLight: '#EEF4FF',
  bgDark: '#1A2744',
} as const;

// Colores de emociones — usado en Contigo (oración) y disponible para futuros trackers.
export const EmotionColors = {
  joy: '#FCD200', // Alegría — amarillo COM
  sadness: '#31AADF', // Tristeza — celeste
  anger: '#E15C62', // Enfado — rojo MIC
  fear: '#6B3FA0', // Miedo — púrpura
  disgust: '#3A7D44', // Asco — verde bosque
} as const;

// Versiones suaves (light) de cada emoción para fondos de chips/cards.
export const EmotionColorsSoft = {
  joy: '#FDE68A',
  sadness: '#BFDBFE',
  anger: '#FECACA',
  fear: '#DDD6FE',
  disgust: '#BBF7D0',
} as const;

// Colores de las categorías del modal de feedback (sustituye magic numbers en AppFeedbackModal).
export const FeedbackCategoryColors = {
  bug: '#FF6B6B', // Error / bug
  idea: '#4ECDC4', // Sugerencia / idea
  praise: '#FFD93D', // Felicitación
} as const;

/**
 * Destacado ámbar: la canción o playlist marcada. Vivía como cuatro hex
 * sueltos repetidos en `PlaylistRow`, `SongListItem` y `TransposeBottomSheet`,
 * con deriva entre ellos (`#3A2D0A` en uno, `#3A2800` en otro).
 */
export const HighlightColors = {
  light: { bg: '#FFF4DA', fg: '#7A5A00', border: '#F4C11E' },
  dark: { bg: '#3A2D0A', fg: '#F4C11E', border: '#7A5A00' },
} as const;

/** Verde de Carismochito. Estaba duplicado como constante en 3 ficheros. */
export const CarismoColors = {
  light: '#1B9E4B',
  dark: '#9DE86B',
} as const;

/**
 * Colores litúrgicos. No son decoración: son los del tiempo litúrgico, y los
 * fija la Iglesia, no nosotros. Estaban escritos a mano dentro de
 * `LiturgicalBadge`, que es el único sitio donde se sabía cuál era cuál.
 */
export const LiturgicalColors = {
  /** Tiempo Ordinario. */
  green: '#3A7D44',
  /** Adviento y Cuaresma. */
  purple: '#6B3FA0',
  /** Navidad y Pascua. */
  gold: '#D4A070',
  /** Semana Santa (Domingo de Ramos y Viernes Santo). */
  red: '#C41E3A',
  /** Gaudete y Laetare — el rosa de los dos domingos de alegría. */
  rose: '#D4A0A7',
} as const;
