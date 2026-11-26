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
import type { MaterialIcons } from '@/components/ui/icons';

/**
 * Tipos de pregunta soportados por el wizard de encuestas/evaluaciones.
 *  - `stars`  → valoración 1..5 (estrellas).
 *  - `text`   → texto libre (multilínea).
 *  - `yesno`  → booleano (Sí / No).
 *  - `scale`  → escala numérica configurable (p. ej. NPS 0..10).
 *  - `single` → una opción de una lista (radio).
 *  - `multi`  → varias opciones de una lista (checkbox), con tope opcional
 *               (`maxSelect`).
 *  - `ratings`→ varias valoraciones 1..5 (estrellas) en UNA misma pantalla,
 *               una por cada elemento de `items`.
 */
export type EvalQuestionType =
  'stars' | 'text' | 'yesno' | 'scale' | 'single' | 'multi' | 'ratings';

/** Opción de una pregunta `single`/`multi`. */
export interface EvalOption {
  /** Valor estable que se guarda en la respuesta. */
  value: string;
  /** Texto mostrado al usuario. */
  label: string;
}

/**
 * Valor de una respuesta guardada. `ratings` guarda un objeto
 * `{ [item.value]: 1..5 }`; el resto, un valor plano.
 */
export type EvalAnswerValue =
  number | string | boolean | string[] | Record<string, number>;

/** Respuestas de una evaluación: `question.id` → valor. */
export type EvalAnswers = Record<string, EvalAnswerValue>;

/** Condición para que una pregunta se enseñe según otra ya contestada. */
export interface EvalShowIf {
  /** `id` de una pregunta ANTERIOR (si va después, nunca se cumple). */
  questionId: string;
  /**
   * Valor (o valores) que activan la pregunta. Si la respuesta es un array
   * (`multi`), basta con que incluya alguno.
   */
  equals: string | string[];
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
  /** Rótulo de bloque que se enseña junto al contador («Aspectos prácticos»). */
  section?: string;
  /**
   * Si viene, la pregunta solo se enseña (y solo se guarda) cuando se cumple
   * la condición. Permite rutas distintas según una pregunta de arranque.
   */
  showIf?: EvalShowIf;
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
  // ── solo `multi` ──
  /** Máximo de opciones que se pueden marcar (sin tope si falta). */
  maxSelect?: number;
  // ── solo `ratings` ──
  /** Elementos a valorar (1..5 estrellas cada uno): `value` es la clave. */
  items?: EvalOption[];
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

// ─── Preguntas condicionales y validación (puro, testeable) ──────────

const answerMatches = (answer: unknown, equals: string | string[]): boolean => {
  const wanted = Array.isArray(equals) ? equals : [equals];
  if (Array.isArray(answer)) return answer.some((a) => wanted.includes(a));
  return typeof answer === 'string' && wanted.includes(answer);
};

/**
 * Preguntas que toca enseñar con las respuestas actuales, en su orden. Una
 * pregunta con `showIf` solo cuenta si la pregunta de la que depende está a su
 * vez visible y contestada con el valor pedido (así una ruta oculta no arrastra
 * a las que cuelgan de ella).
 */
export function visibleQuestions(
  questions: EvalQuestion[],
  answers: EvalAnswers,
): EvalQuestion[] {
  const shown = new Set<string>();
  const out: EvalQuestion[] = [];
  for (const q of questions) {
    if (q.showIf) {
      const { questionId, equals } = q.showIf;
      if (!shown.has(questionId)) continue;
      if (!answerMatches(answers[questionId], equals)) continue;
    }
    shown.add(q.id);
    out.push(q);
  }
  return out;
}

/** ¿Está contestada la pregunta (para dejar continuar si es obligatoria)? */
export function isQuestionAnswered(
  q: EvalQuestion,
  value: EvalAnswerValue | undefined,
): boolean {
  switch (q.type) {
    case 'stars':
      return typeof value === 'number' && value > 0;
    case 'scale':
      return typeof value === 'number'; // 0 es respuesta válida (p. ej. NPS)
    case 'text':
      return !!String(value ?? '').trim();
    case 'multi':
      return Array.isArray(value) && value.length > 0;
    case 'ratings': {
      const items = q.items ?? [];
      if (items.length === 0 || !value || typeof value !== 'object')
        return false;
      const rated = value as Record<string, number>;
      return items.every((it) => (rated[it.value] ?? 0) > 0);
    }
    default:
      return value !== undefined;
  }
}

/**
 * Respuestas listas para guardar: solo las de preguntas visibles, sin textos
 * vacíos, sin `multi` sin marcar y sin valoraciones a 0.
 */
export function cleanAnswers(
  questions: EvalQuestion[],
  answers: EvalAnswers,
): EvalAnswers {
  const cleaned: EvalAnswers = {};
  for (const q of visibleQuestions(questions, answers)) {
    const v = answers[q.id];
    if (q.type === 'text') {
      const t = String(v ?? '').trim();
      if (t) cleaned[q.id] = t;
    } else if (q.type === 'multi') {
      if (Array.isArray(v) && v.length > 0) cleaned[q.id] = v;
    } else if (q.type === 'ratings') {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const kept: Record<string, number> = {};
        for (const [k, n] of Object.entries(v)) {
          if (typeof n === 'number' && n > 0) kept[k] = n;
        }
        if (Object.keys(kept).length > 0) cleaned[q.id] = kept;
      }
    } else if (v !== undefined) {
      cleaned[q.id] = v;
    }
  }
  return cleaned;
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
// Genérica: la usa cualquier evento que no tenga la suya en
// `EVENT_EVALUATION_DEFAULTS`. `evaluationOpen` enciende el CTA "Evalúa la
// actividad" en la Home (config en código, no en Firebase). Pon `false` para
// ocultarlo.
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

/**
 * Evaluación del Congreso M+C (27-29 nov 2026), con dos rutas según lo que se
 * haya hecho: Formación de Pre-monitores o Curso Despierta. Las dos comparten
 * los aspectos prácticos y el cierre.
 *
 * Programada: abre el domingo 29-nov a las 10:00 y deja de salir el martes
 * 1-dic a las 00:00 (hora de Madrid). El panel/consola puede moverlo sin OTA
 * con `status`/`opensAt`/`closesAt` en `activities/congresomc26/evaluacion/data`.
 *
 * Los `id` son estables (no reciclar). El contrato para el panel, con la forma
 * de cada respuesta, está en `docs/contratos/ENCUESTAS_CONTRATO.md` y la copia
 * importable en `firebase-seed/eventos/congresomc26-evaluacion.json` (un test
 * comprueba que las dos coinciden).
 */
export const CONGRESO_MC_EVALUATION: EvaluationConfig = {
  status: 'scheduled',
  opensAt: 1795942800000, // dom 2026-11-29 10:00 Europe/Madrid
  closesAt: 1796079600000, // mar 2026-12-01 00:00 Europe/Madrid
  title: 'Evalúa el Congreso M+C',
  intro:
    'Cuéntanos qué tal ha ido el Congreso. Tu opinión nos ayuda a preparar los próximos. Te llevará un par de minutos 🙏',
  thanksTitle: '¡Gracias!',
  thanksBody: 'Tu opinión nos ayuda a seguir despertando evangelizadores 🧡',
  closedTitle: 'La evaluación ya está cerrada',
  closedBody: 'Gracias por haber vivido el Congreso con nosotros.',
  questions: [
    // ── 1 · Ruta ──
    {
      id: 'curso',
      type: 'single',
      label: '¿En qué parte del Congreso has participado?',
      options: [
        { value: 'premonitores', label: 'Formación de Pre-monitores' },
        { value: 'despierta', label: 'Curso Despierta' },
      ],
    },

    // ── 2a · Pre-monitores ──
    {
      id: 'pm_valoracion',
      type: 'scale',
      section: 'Pre-monitores',
      showIf: { questionId: 'curso', equals: 'premonitores' },
      label: '¿Qué valoración le das al curso?',
      min: 1,
      max: 8,
      minLabel: 'Muy baja',
      maxLabel: 'Muy alta',
    },
    {
      id: 'pm_quedas',
      type: 'text',
      section: 'Pre-monitores',
      showIf: { questionId: 'curso', equals: 'premonitores' },
      label:
        '¿Con qué te quedas? ¿Qué formaciones te han resultado más útiles y por qué? ¿Qué es lo que más te ha gustado?',
      placeholder: 'Cuéntanos con calma…',
    },
    {
      id: 'pm_falta',
      type: 'text',
      section: 'Pre-monitores',
      showIf: { questionId: 'curso', equals: 'premonitores' },
      label: 'Respecto a la formación, ¿qué te ha faltado?',
      placeholder: 'Temas, tiempo, materiales…',
    },
    {
      id: 'pm_formato',
      type: 'single',
      section: 'Pre-monitores',
      showIf: { questionId: 'curso', equals: 'premonitores' },
      label: 'Para las próximas formaciones, ¿qué prefieres?',
      options: [
        {
          value: 'cortas',
          label:
            'Formaciones cortas, de una hora como máximo y variadas: pequeñas pinceladas y profundizar en el futuro',
        },
        {
          value: 'profundas',
          label:
            'Centrarnos solo en algunos temas y profundizar mucho más en ellos',
        },
        {
          value: 'mixtas',
          label:
            'Mezclar formaciones más largas, de más de una hora, con otras cortas',
        },
        {
          value: 'asi',
          label: 'Los tiempos de las formaciones han estado bien: dejarlo así',
        },
      ],
    },
    {
      id: 'pm_mat',
      type: 'single',
      section: 'Pre-monitores',
      showIf: { questionId: 'curso', equals: 'premonitores' },
      label:
        '¿Tienes intención de hacer el MAT Consolación en el verano de 2027?',
      options: [
        {
          value: 'si',
          label:
            'Sí, me gustaría hacer el curso oficial de Monitor de Actividades de Tiempo Libre Consolación',
        },
        { value: 'pensarlo', label: 'Me lo tengo que pensar mucho' },
        { value: 'no', label: 'No, no me interesa' },
        { value: 'nosequees', label: 'MAT… ¿de qué me hablas? No sé qué es' },
      ],
    },

    // ── 2b · Curso Despierta ──
    {
      id: 'dp_expectativas',
      type: 'scale',
      section: 'Curso Despierta',
      showIf: { questionId: 'curso', equals: 'despierta' },
      label:
        'Antes de empezar el curso, ¿qué expectativas traías? ¿Con cuánta motivación llegaste?',
      min: 1,
      max: 8,
      minLabel: 'Muy poca motivación',
      maxLabel: 'Muchas ganas',
    },
    {
      id: 'dp_valio',
      type: 'yesno',
      section: 'Curso Despierta',
      showIf: { questionId: 'curso', equals: 'despierta' },
      label:
        '¿Consideras que ha valido la pena hacer un Curso Despierta como parte de la formación de monitores, dentro de un congreso de monitores?',
    },
    {
      id: 'dp_momentos',
      type: 'multi',
      section: 'Curso Despierta',
      showIf: { questionId: 'curso', equals: 'despierta' },
      label: '¿Qué momentos del curso te han gustado más? (hasta 3)',
      maxSelect: 3,
      options: [
        {
          value: 'te_invito_a_despertar',
          label: 'Viernes · Te invito a despertar',
        },
        {
          value: 'cambiar_la_mentalidad',
          label: 'Viernes · Cambiar la mentalidad',
        },
        { value: 'el_estilo_de_jesus', label: 'Sábado · El estilo de Jesús' },
        { value: 'proyecto_despierta', label: 'Sábado · Proyecto #Despierta' },
        {
          value: 'el_anuncio_del_kerigma',
          label: 'Sábado · El anuncio del Kerigma',
        },
        {
          value: 'jovenes_destinatarios',
          label: 'Sábado · Jóvenes: destinatarios/as de la evangelización',
        },
        {
          value: 'la_finalidad_de_la_evangelizacion',
          label: 'Sábado · La finalidad de la evangelización',
        },
        {
          value: 'adoracion_y_alabanza',
          label: 'Sábado · Adoración y alabanza',
        },
        {
          value: 'iglesia_tema_candente',
          label: 'Domingo · Iglesia: tema candente',
        },
        {
          value: 'evangelizacion_conjunta',
          label: 'Domingo · Evangelización conjunta… ¿y ahora qué?',
        },
        {
          value: 'comparte_tu_despierta',
          label: 'Domingo · Comparte tu despierta',
        },
      ],
    },

    // ── 3 · Aspectos prácticos (común) ──
    {
      id: 'practicos',
      type: 'ratings',
      section: 'Aspectos prácticos',
      label: 'Valora los aspectos prácticos',
      items: [
        { value: 'lugar', label: 'El lugar: Benicàssim, zona La Plana' },
        { value: 'albergue', label: 'El albergue Argentina' },
        { value: 'almuerzos_meriendas', label: 'Almuerzos y meriendas' },
        { value: 'comidas_albergue', label: 'Comidas del albergue' },
        { value: 'ambiente_grupo', label: 'Ambiente en el grupo' },
      ],
    },

    // ── 4 · Cierre (opcional) ──
    {
      id: 'pm_mejora',
      type: 'text',
      optional: true,
      section: 'Para terminar',
      showIf: { questionId: 'curso', equals: 'premonitores' },
      label: '¿Tienes alguna propuesta de mejora para el curso en general?',
      placeholder: 'Tus ideas, con cariño…',
    },
    {
      id: 'dp_participacion',
      type: 'text',
      optional: true,
      section: 'Para terminar',
      showIf: { questionId: 'curso', equals: 'despierta' },
      label:
        '¿Qué crees que podríamos hacer para incrementar la participación en este tipo de encuentros?',
      placeholder: 'Tus ideas…',
    },
    {
      id: 'dp_mejora',
      type: 'text',
      optional: true,
      section: 'Para terminar',
      showIf: { questionId: 'curso', equals: 'despierta' },
      label: 'Sugerencias de mejora en general',
      placeholder: 'Tus sugerencias, con cariño…',
    },
    {
      id: 'dp_otra',
      type: 'text',
      optional: true,
      section: 'Para terminar',
      showIf: { questionId: 'curso', equals: 'despierta' },
      label: '¿Algo más que quieras decirnos?',
      placeholder: 'Cualquier otra cosa que quieras contarnos…',
    },
  ],
};

/** Evaluación propia por evento (`event.id` → config). Sin entrada, la genérica. */
export const EVENT_EVALUATION_DEFAULTS: Record<string, EvaluationConfig> = {
  congresomc26: CONGRESO_MC_EVALUATION,
};

export const getEventEvaluationDefault = (eventId: string): EvaluationConfig =>
  EVENT_EVALUATION_DEFAULTS[eventId] ?? DEFAULT_EVENT_EVALUATION;

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
