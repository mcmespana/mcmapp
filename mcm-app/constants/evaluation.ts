/**
 * Configuración de las evaluaciones (del evento y de la app).
 *
 * TODO (preguntas, títulos y el flag `evaluationOpen` del CTA de la Home) se
 * define aquí en código. No se lee nada de Firebase para la configuración: para
 * cambiar preguntas o apagar el CTA se edita este archivo y se publica una OTA.
 *
 * Las RESPUESTAS sí se guardan en Firebase:
 *   activities/<evento>/evaluacion/respuestas/<pushId>   (evaluación del evento)
 *   app/evaluations/<pushId>                              (evaluación de la app)
 */
import type { ComponentProps } from 'react';
import type { MaterialIcons } from '@expo/vector-icons';

/**
 * Tipos de pregunta soportados por el wizard de encuestas/evaluaciones.
 *  - `stars`  → valoración 1..5 (estrellas).
 *  - `text`   → texto libre (multilínea).
 *  - `yesno`  → booleano (Sí / No).
 *  - `scale`  → escala numérica configurable (p. ej. NPS 0..10).
 *  - `single` → una opción de una lista (radio).
 *  - `multi`  → varias opciones de una lista (checkbox).
 */
export type EvalQuestionType =
  | 'stars'
  | 'text'
  | 'yesno'
  | 'scale'
  | 'single'
  | 'multi';

/** Opción de una pregunta `single`/`multi`. */
export interface EvalOption {
  /** Valor estable que se guarda en la respuesta. */
  value: string;
  /** Texto mostrado al usuario. */
  label: string;
}

export interface EvalQuestion {
  /** Identificador estable (clave en el objeto de respuestas). */
  id: string;
  type: EvalQuestionType;
  /** Enunciado mostrado al usuario. */
  label: string;
  /** Placeholder para preguntas de texto. */
  placeholder?: string;
  /** Si falta o es false, la pregunta es obligatoria para poder enviar. */
  optional?: boolean;
  // ── solo `scale` ──
  /** Valor mínimo de la escala (por defecto 0). */
  min?: number;
  /** Valor máximo de la escala (por defecto 10). */
  max?: number;
  /** Etiqueta bajo el extremo izquierdo (p. ej. "Nada probable"). */
  minLabel?: string;
  /** Etiqueta bajo el extremo derecho (p. ej. "Muy probable"). */
  maxLabel?: string;
  // ── solo `single` / `multi` ──
  /** Opciones disponibles. */
  options?: EvalOption[];
}

/** Estado de publicación de una encuesta/evaluación (lo controla el panel). */
export type SurveyStatus = 'draft' | 'scheduled' | 'open' | 'closed';

export interface EvaluationConfig {
  /**
   * Legacy: enciende el banner. Se mantiene por compatibilidad. Lo recomendado
   * es usar `status` + ventana (`opensAt`/`closesAt`). Si `status` viene, manda
   * `status`; si no, se usa `evaluationOpen`.
   */
  evaluationOpen?: boolean;
  /** Estado de publicación (preferido sobre `evaluationOpen`). */
  status?: SurveyStatus;
  /** Epoch ms: antes de esta fecha la encuesta no está abierta. */
  opensAt?: number;
  /** Epoch ms: después de esta fecha la encuesta se considera cerrada. */
  closesAt?: number;
  title?: string;
  intro?: string;
  /** Título de la pantalla de agradecimiento (tras enviar). */
  thanksTitle?: string;
  /** Cuerpo de la pantalla de agradecimiento. */
  thanksBody?: string;
  /** Título cuando la encuesta está cerrada. */
  closedTitle?: string;
  /** Cuerpo cuando la encuesta está cerrada. */
  closedBody?: string;
  /** Color de acento opcional (hex) que sobreescribe el del evento. */
  accentColor?: string;
  questions: EvalQuestion[];
}

/**
 * ¿Está la encuesta abierta para responder ahora mismo?
 * Prioriza `status`; cae a `evaluationOpen` (legacy). Respeta la ventana
 * `opensAt`/`closesAt` en ambos casos.
 */
export function isEvaluationOpen(
  config: Pick<
    EvaluationConfig,
    'status' | 'evaluationOpen' | 'opensAt' | 'closesAt'
  >,
  now: number = Date.now(),
): boolean {
  if (config.status === 'draft' || config.status === 'closed') return false;
  if (typeof config.opensAt === 'number' && now < config.opensAt) return false;
  if (typeof config.closesAt === 'number' && now > config.closesAt)
    return false;
  if (config.status === 'open' || config.status === 'scheduled') return true;
  // Sin `status`: cae a la flag legacy (true por defecto si no viene).
  return config.evaluationOpen !== false;
}

/**
 * Combina la config local (fallback en código) con la remota (Firebase). La
 * remota gana campo a campo; si trae `questions` no vacío, sustituye a las del
 * fallback (no se mezclan pregunta a pregunta). Si la remota es null/undefined
 * (offline o nodo inexistente) devuelve el fallback intacto.
 */
export function mergeEvaluationConfig(
  fallback: EvaluationConfig,
  remote?: Partial<EvaluationConfig> | null,
): EvaluationConfig {
  if (!remote) return fallback;
  const questions =
    Array.isArray(remote.questions) && remote.questions.length > 0
      ? remote.questions
      : fallback.questions;
  return { ...fallback, ...remote, questions };
}

/** Icono Material por defecto para cada tipo (no usado directamente aquí, útil
 * si en el futuro se quiere mapear). */
export type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

// ─── Evaluación del EVENTO ───────────────────────────────────────────
// `evaluationOpen` enciende el CTA "Evalúa la actividad" en la Home (config
// en código, no en Firebase). Pon `false` para ocultarlo.
export const DEFAULT_EVENT_EVALUATION: EvaluationConfig = {
  evaluationOpen: true,
  title: 'Evalúa la actividad',
  intro:
    'Tu opinión nos ayuda a mejorar los próximos encuentros. Te llevará un par de minutos 🙏',
  questions: [
    {
      id: 'general',
      type: 'stars',
      label: 'Valoración general',
    },
    {
      id: 'organizacion_mcm',
      type: 'stars',
      label: 'Organización MCM',
      optional: true,
    },
    {
      id: 'organizacion_papa',
      type: 'stars',
      label: 'Organización Visita del Papa (general)',
      optional: true,
    },
    {
      id: 'convivencia',
      type: 'stars',
      label: 'Convivencia',
      optional: true,
    },
    {
      id: 'gustado',
      type: 'text',
      label: '¿Qué es lo que más te ha gustado?',
      placeholder: 'Eso que te llevas de estos días…',
      optional: true,
    },
    {
      id: 'mejorar',
      type: 'text',
      label: '¿Qué mejorarías?',
      placeholder: 'Tus sugerencias, con cariño…',
      optional: true,
    },
    {
      id: 'comentarios',
      type: 'text',
      label: 'Comentarios',
      placeholder: 'Cualquier otra cosa que quieras contarnos…',
      optional: true,
    },
  ],
};

// ─── Evaluación de la APP ────────────────────────────────────────────
// `evaluationOpen` enciende el CTA "Evalúa la app" en la Home.
export const DEFAULT_APP_EVALUATION: EvaluationConfig = {
  evaluationOpen: true,
  title: 'Evalúa la app',
  intro: 'Cuéntanos cómo te ha funcionado la app durante el evento.',
  questions: [
    {
      id: 'general',
      type: 'stars',
      label: '¿Cómo valoras la app en general?',
    },
    {
      id: 'errores',
      type: 'text',
      label: '¿Has encontrado algún error o fallo?',
      placeholder: 'Pantalla o función que no iba bien…',
      optional: true,
    },
    {
      id: 'util',
      type: 'text',
      label: '¿Qué te ha resultado más útil?',
      placeholder: 'Lo que más has usado…',
      optional: true,
    },
    {
      id: 'mejorar',
      type: 'text',
      label: '¿Qué echas en falta o mejorarías?',
      placeholder: 'Tus ideas para la app…',
      optional: true,
    },
    {
      id: 'recomendarias',
      type: 'yesno',
      label: '¿Recomendarías la app?',
      optional: true,
    },
  ],
};

/** Clave de AsyncStorage para recordar que ya se evaluó (y ocultar el banner). */
export const evaluationDoneKey = (scope: string): string =>
  `evaluacion_done_${scope}`;
