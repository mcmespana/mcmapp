/**
 * Configuración de las evaluaciones (del evento y de la app).
 *
 * Las preguntas viven aquí como *fallback* y, en el caso del evento, pueden
 * sobreescribirse desde Firebase para editarlas sin desplegar (patrón habitual
 * de la app). El nodo Firebase esperado para el evento es:
 *
 *   activities/<evento>/evaluacion
 *   ├── updatedAt: <timestamp>
 *   ├── hidden?:   boolean            (oculta la tarjeta en el hub)
 *   └── data:                          ← EvaluationConfig
 *       ├── evaluationOpen: boolean    (enciende el banner de la Home)
 *       ├── title / intro
 *       └── questions: EvalQuestion[]
 *
 * Las RESPUESTAS las escribe la propia app bajo:
 *   activities/<evento>/evaluacion/respuestas/<pushId>   (evaluación del evento)
 *   app/evaluations/<pushId>                              (evaluación de la app)
 */
import type { ComponentProps } from 'react';
import type { MaterialIcons } from '@expo/vector-icons';

export type EvalQuestionType = 'stars' | 'text' | 'yesno';

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
}

export interface EvaluationConfig {
  /** Solo evento: enciende el banner "Evalúa la actividad" en la Home. */
  evaluationOpen?: boolean;
  title?: string;
  intro?: string;
  questions: EvalQuestion[];
}

/** Icono Material por defecto para cada tipo (no usado directamente aquí, útil
 * si en el futuro se quiere mapear). */
export type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

// ─── Evaluación del EVENTO (fallback) ────────────────────────────────
export const DEFAULT_EVENT_EVALUATION: EvaluationConfig = {
  evaluationOpen: false,
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

// ─── Evaluación de la APP (fallback) ─────────────────────────────────
export const DEFAULT_APP_EVALUATION: EvaluationConfig = {
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
