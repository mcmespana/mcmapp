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
  },
};

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
  yellow: '#FCD200', // Amarillo COM — estrellas de valoración, Autobuses
  purple: '#9D1E74', // Morado LC — Comunica
  text: '#002B81', // Azul COM — texto de marca
  background: '#ffffff', // Fondo blanco
  white: '#ffffff', // Blanco
  black: '#000000', // Negro
  border: '#E0E0E0', // Gris claro para bordes
};

export default brand;

// Colores de UI para componentes interactivos (FABs, botones, etc.)
export const UIColors = {
  activePrimary: '#007bff', // Azul — elementos activos, bordes de FABs
  activePrimaryDark: '#0056b3', // Azul oscuro — bordes FABs activos
  accentYellow: '#f4c11e', // Amarillo — FAB principal
  textLight: '#ffffff', // Texto blanco
  textDark: '#212529', // Texto oscuro
  backgroundLight: '#ffffff', // Fondo blanco para FABs inactivos
  modalOverlay: 'rgba(0, 0, 0, 0.5)',
  secondaryText: '#6c757d', // Gris secundario
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
