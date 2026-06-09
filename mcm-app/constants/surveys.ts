/**
 * Encuestas genéricas (`/surveys/<id>`).
 *
 * Además de las dos evaluaciones "fijas" (la del evento en
 * `activities/<evento>/evaluacion` y la de la app en `app/evaluations`), el
 * panel puede crear encuestas arbitrarias bajo `/surveys/<id>`. Cada encuesta
 * reutiliza el mismo modelo de preguntas (`EvalQuestion`) y el mismo wizard.
 *
 * La CONFIG (preguntas, estado, ventana, destino, audiencia) la escribe el
 * panel en `surveys/<id>/data`. Las RESPUESTAS las escribe la app en
 * `surveys/<id>/respuestas/<deviceId>` (una por dispositivo).
 *
 *   surveys/
 *   ├── updatedAt: <ms>
 *   └── <id>/
 *       ├── updatedAt: <ms>
 *       ├── data: SurveyConfig
 *       └── respuestas/<deviceId>: SurveyResponse
 */
import type { EvalQuestion, EvaluationConfig } from '@/constants/evaluation';

/** Dónde se ofrece la encuesta al usuario. */
export type SurveyPlacementType =
  | 'home-banner' // banner destacado en la Home
  | 'event-banner' // banner dentro del hub del evento
  | 'app-settings' // botón en Ajustes
  | 'link-only'; // solo accesible por deep link / notificación push

export interface SurveyPlacement {
  type: SurveyPlacementType;
  /** Solo `event-banner`: id del evento al que se asocia. */
  eventId?: string;
  /** Texto del CTA del banner (por defecto usa el título). */
  ctaLabel?: string;
}

/**
 * Segmentación opcional. La app la evalúa contra el perfil del usuario. Si un
 * array está vacío o ausente, no filtra por ese criterio (todos pasan).
 */
export interface SurveyAudience {
  /** Topics (los mismos de notificaciones, p. ej. `general`, `monitores`). */
  topics?: string[];
  /** Tipos de perfil (`familia`, `monitor`, `miembro`). */
  profileTypes?: string[];
  /** Delegaciones (`mcm-madrid`, …). */
  delegationIds?: string[];
}

/** Config de una encuesta genérica (superset de EvaluationConfig). */
export interface SurveyConfig extends EvaluationConfig {
  /** Id estable (== clave en `/surveys`). */
  id?: string;
  /** Emoji/iconito opcional para banners. */
  emoji?: string;
  /** Dónde aparece. Por defecto `link-only`. */
  placement?: SurveyPlacement;
  /** A quién se le ofrece. Por defecto: a todos. */
  audience?: SurveyAudience;
  /** Si true, no se guardan datos de perfil con la respuesta (anónima). */
  anonymous?: boolean;
}

/** Respuesta tal como la escribe la app. */
export interface SurveyResponse {
  answers: Record<string, number | string | boolean | string[]>;
  deviceId: string;
  surveyId: string;
  timestamp: number;
  reportedAt: string;
  platform: string;
  userName?: string;
  userProfileType?: string;
  userDelegation?: string;
}

export const SURVEYS_PATH = 'surveys';

/** Path del nodo de una encuesta. */
export const surveyPath = (id: string): string => `${SURVEYS_PATH}/${id}`;

/** Path donde la app escribe la respuesta de este dispositivo. */
export const surveyAnswerPath = (id: string, deviceId: string): string =>
  `${SURVEYS_PATH}/${id}/respuestas/${deviceId}`;

/** Clave de AsyncStorage anti-reenvío para una encuesta genérica. */
export const surveyDoneKey = (id: string): string => `survey_done_${id}`;

/** Clave de caché para `useFirebaseData` de la config de una encuesta. */
export const surveyCacheKey = (id: string): string => `survey_${id}`;

/**
 * ¿El usuario (perfil) entra en la audiencia de la encuesta? Si no hay
 * `audience`, pasa todo el mundo. Se evalúa con OR dentro de cada criterio y
 * AND entre criterios definidos.
 */
export function matchesAudience(
  audience: SurveyAudience | undefined,
  user: {
    topics?: string[];
    profileType?: string | null;
    delegationId?: string | null;
  },
): boolean {
  if (!audience) return true;
  const { topics, profileTypes, delegationIds } = audience;
  if (topics?.length) {
    const ut = user.topics ?? [];
    if (!topics.some((t) => ut.includes(t))) return false;
  }
  if (profileTypes?.length) {
    if (!user.profileType || !profileTypes.includes(user.profileType))
      return false;
  }
  if (delegationIds?.length) {
    if (!user.delegationId || !delegationIds.includes(user.delegationId))
      return false;
  }
  return true;
}

export type { EvalQuestion };
