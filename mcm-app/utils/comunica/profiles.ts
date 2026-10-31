// utils/comunica/profiles.ts
//
// «A QUIÉN SE VE» (plan 11, familias): lógica pura, sin React ni red. La persona que se está viendo es quien ha entrado o uno de sus hijos; de ella
// salen la audiencia, qué secciones hay y qué se enseña. Porta `inc/stic-family.php` y `menu.php` del plugin (la función de origen, al lado).
//
// El servidor es quien decide quién es hijo de quién y qué es `guardian` o `member` (`GET /v1/me/profiles` y `Me.roles`); esto solo decide qué
// pantalla toca con lo que el servidor ya dijo. Nada de lo que hay aquí concede acceso.

import {
  TEAM_ROLES,
  type Me,
  type ProfileRef,
  type Role,
} from '@/services/comunica/contract';

/** `child`: viendo a un hijo; `guardian`: familiar a secas; `member`: del MCM (con o sin hijos). */
export type Audience = 'member' | 'guardian' | 'child';

/** Lo que de `Me` hace falta aquí (así se prueba sin montar un `Me` entero). */
export type MeLike = Pick<Me, 'personId' | 'roles'>;

/** `member` ⇔ papel `member` o de equipo (el servidor ya devuelve `member` también a un monitor; el falso antiguo, no). */
export function isMember(me: MeLike): boolean {
  return me.roles.some((r) => r === 'member' || TEAM_ROLES.includes(r as Role));
}

/** Familiar a secas: con hijos a cargo y sin ser del MCM (`sticpa_viewing_context`: `solo_familiar`). */
export function isGuardianOnly(me: MeLike): boolean {
  return me.roles.includes('guardian') && !isMember(me);
}

/**
 * `audienceFor` (`stic-family.php` l. 388-421): viendo a un hijo, `child`; viéndose, `guardian` si es familiar y no miembro; si no, `member`.
 */
export function audienceFor(me: MeLike, activeId: string): Audience {
  if (activeId !== me.personId) return 'child';
  return isGuardianOnly(me) ? 'guardian' : 'member';
}

// ── Elegir a quién se ve ────────────────────────────────────────────────────

/** Lo que se recuerda por persona (el almacén por persona del plan 01): a quién se veía y si lo eligió ella. */
export interface ActiveChoice {
  activeId: string;
  chosen: boolean;
}

export interface InitialProfile extends ActiveChoice {
  /** Solo familiar con varios hijos que no ha elegido nunca: antes de nada, «¿A quién quieres ver?». */
  mustPick: boolean;
}

/**
 * A quién se ve al abrir (`sticpa_bootstrap_family`, `sticpa_landing_page`, l. 536-590 y 719-736). La elección recordada se respeta si sigue siendo
 * válida (uno mismo o un hijo que sigue en la lista: una relación terminada ya no está); si no, se vuelve a aplicar la tabla:
 *
 *   no es familiar ......................... él mismo
 *   familiar y miembro ..................... él mismo (a los hijos, con el selector)
 *   solo familiar, un hijo ................. ese hijo, elegido solo (cuenta como elegido)
 *   solo familiar, varios .................. «¿A quién quieres ver?»
 *   solo familiar, ninguno ................. él mismo
 */
export function initialProfile(
  me: MeLike,
  children: readonly ProfileRef[],
  remembered?: ActiveChoice | null,
): InitialProfile {
  if (
    remembered &&
    (remembered.activeId === me.personId ||
      children.some((c) => c.id === remembered.activeId))
  ) {
    return { ...remembered, mustPick: false };
  }
  if (isGuardianOnly(me) && children.length === 1)
    return { activeId: children[0]!.id, chosen: true, mustPick: false };
  if (isGuardianOnly(me) && children.length > 1)
    return { activeId: me.personId, chosen: false, mustPick: true };
  return { activeId: me.personId, chosen: false, mustPick: false };
}

/** Las secciones de familia: lo que cuelga de la persona que se ve (planes 12-16). */
export type FamilySection =
  | 'profile'
  | 'events'
  | 'registrations'
  | 'calendar'
  | 'payments'
  | 'documents';

/** A qué sección va cada destino del plugin que llega por un enlace (plan 10). */
const DESTINATION_SECTION: Record<string, FamilySection> = {
  single_stic_comunica_perfil: 'profile',
  single_stic_profile: 'profile',
  list_stic_events: 'events',
  single_stic_events: 'events',
  list_stic_registrations: 'registrations',
  single_stic_registrations: 'registrations',
  list_stic_calendar: 'calendar',
  single_stic_calendar: 'calendar',
  list_stic_payments: 'payments',
  single_stic_payments: 'payments',
  single_stic_payment_form: 'payments',
  list_stic_documents: 'documents',
  single_stic_documents: 'documents',
};

/** Los destinos que, al elegir, preguntan «¿A quién quieres APUNTAR?» en vez de «ver» (un evento o una inscripción). */
const SIGNUP_DESTINATIONS = new Set([
  'single_stic_events',
  'single_stic_registrations',
]);

export function sectionOfDestination(
  internalpage: string | null | undefined,
): FamilySection | null {
  return (internalpage && DESTINATION_SECTION[internalpage]) || null;
}

/**
 * `sticpa_visible_sections`: el familiar a secas (`guardian`), viéndose a sí mismo, solo tiene lo suyo y lo que se cobra de su cuenta (datos y pagos).
 * `member` y `child` tienen todo.
 */
export function sectionVisible(
  audience: Audience,
  section: FamilySection,
): boolean {
  return (
    audience !== 'guardian' || section === 'profile' || section === 'payments'
  );
}

export interface PickerNeeded {
  /** `first`: nunca ha elegido (FAM-a1); `section`: la sección no es de quien se ve ahora. */
  why: 'first' | 'section';
  /** Para el texto: apuntar (evento o inscripción) o ver. */
  purpose: 'signup' | 'view';
}

/**
 * «Hay que elegir» (`sticpa_family_must_choose_first`, l. 611-623): un enlace a una pantalla de familia, y quien entra es solo familiar con dos o más
 * hijos y no ha elegido NUNCA → primero «¿A quién quieres ver?» con el destino; al elegir se va al destino, no a la portada. Una vez elegido, los
 * enlaces pasan sin preguntar, SALVO que el destino sea de una sección que la audiencia activa no tiene (un familiar viéndose a sí mismo y un enlace a
 * un evento: el plugin le abre el evento a ella y «Inscribirme» la apuntaría a ella, el mismo fallo por otra puerta).
 */
export function mustChooseFirst(
  me: MeLike,
  children: readonly ProfileRef[],
  active: ActiveChoice,
  internalpage: string | null | undefined,
): PickerNeeded | null {
  const section = sectionOfDestination(internalpage);
  if (!section || !isGuardianOnly(me)) return null;
  const purpose =
    internalpage && SIGNUP_DESTINATIONS.has(internalpage) ? 'signup' : 'view';
  if (children.length >= 2 && !active.chosen) return { why: 'first', purpose };
  if (
    children.length >= 1 &&
    !sectionVisible(audienceFor(me, active.activeId), section)
  )
    return { why: 'section', purpose };
  return null;
}

/** Los textos de «¿A quién ves?» según para qué se elige (`single_stic_profile_selection.php`). */
export function pickerTexts(purpose: PickerNeeded['purpose']): {
  title: string;
  body: string;
} {
  return purpose === 'signup'
    ? {
        title: '¿A quién quieres apuntar?',
        body: 'Elige a quién y te llevamos directo a la actividad.',
      }
    : {
        title: '¿A quién quieres ver?',
        body: 'Elige a quién quieres ver. Puedes cambiar desde arriba cuando quieras.',
      };
}

/** Cada pantalla de familia dice si es de nadie (`shared`: lista de eventos, ficha de un evento, calendario) o de la persona (`personal`: una inscripción, un pago, unos datos). */
export type ProfileScope = 'shared' | 'personal';

/**
 * Qué hacer al cambiar de persona sin volver a la portada (FAM-a8, `sticpa_family_switch_destination`, l. 677-713): en una compartida, quedarse y
 * recargar con el `pid` nuevo SI esa sección se le enseña a la nueva audiencia; en una personal, o si no se le enseña, a la portada.
 */
export function switchDestination(
  scope: ProfileScope,
  section: FamilySection | null,
  nextAudience: Audience,
): 'stay' | 'home' {
  return scope === 'shared' &&
    section !== null &&
    sectionVisible(nextAudience, section)
    ? 'stay'
    : 'home';
}

// ── La portada ──────────────────────────────────────────────────────────────

export interface HomeRow {
  section: FamilySection;
  title: string;
  description: string;
}

/**
 * Los bloques de «Actividades» (`homeSections`, `sticpa_visible_sections` l. 468-510 y `sticpa_section_meta`): `member` y `child`, Eventos,
 * «Mis inscripciones» («Inscripciones» viendo a un hijo), Calendario, Pagos y Documentos; `guardian`, solo Pagos y el bloque se llama «Tus pagos»
 * (el dinero sale de su cuenta). Sin bloque «Tu perfil»: «Tus secciones».
 */
export function homeSections(audience: Audience): {
  title: string;
  rows: HomeRow[];
} {
  if (audience === 'guardian') {
    return {
      title: 'Tus pagos',
      rows: [
        {
          section: 'payments',
          title: 'Pagos',
          description: 'Tus pagos y recibos, con su estado.',
        },
      ],
    };
  }
  return {
    title: 'Actividades',
    rows: [
      {
        section: 'events',
        title: 'Eventos',
        description: 'Las actividades a las que te puedes apuntar.',
      },
      {
        section: 'registrations',
        title: audience === 'child' ? 'Inscripciones' : 'Mis inscripciones',
        description: 'A qué estás apuntado y en qué estado está.',
      },
      {
        section: 'calendar',
        title: 'Calendario',
        description: 'Tus actividades, día a día.',
      },
      {
        section: 'payments',
        title: 'Pagos',
        description: 'Tus pagos y recibos, con su estado.',
      },
      {
        section: 'documents',
        title: 'Documentos',
        description: 'Tus documentos, para verlos y descargarlos.',
      },
    ],
  };
}

/** El saludo de la portada (`single_stic_home.php`): con el nombre de pila de quien ha entrado, o la bienvenida sin nombre. */
export function greeting(me: { name: string }): string {
  const first = firstNameOfFull(me.name);
  return first ? `Hola, ${first} 👋` : '¡Te damos la bienvenida! 👋';
}

/** La entradilla del saludo según a quién se ve. */
export function greetingIntro(
  audience: Audience,
  activeFirstName: string,
): string {
  if (audience === 'child')
    return `Aquí ves los datos de ${activeFirstName || 'tu participante'} y le inscribes a las actividades.`;
  if (audience === 'guardian') {
    return 'Aquí están tus datos y lo que se cobra de tu cuenta. Las inscripciones y los documentos de quienes tienes a tu cargo están en su ficha.';
  }
  return 'Tu espacio personal. Elige una sección para empezar.';
}

// ── Nombres ─────────────────────────────────────────────────────────────────

/** La primera palabra del nombre de pila («María José» → «María», `sticpa_nombre_de_pila`). */
export const firstNameOf = (ref: Pick<ProfileRef, 'firstName'>): string =>
  (ref.firstName ?? '').trim().split(/\s+/)[0] ?? '';

/** Del nombre completo que da `Me.name` («Marta Villarroya Pons»): el nombre de pila. */
export const firstNameOfFull = (name: string): string =>
  name.trim().split(/\s+/)[0] ?? '';

/** «Lucía Messeguer»: nombre y primer apellido (FAM-a11). Sin nombre ni apellidos, «Participante». */
export function shortName(
  ref: Pick<ProfileRef, 'firstName' | 'lastName'>,
): string {
  const first = (ref.firstName ?? '').trim();
  const lastFirst = (ref.lastName ?? '').trim().split(/\s+/)[0] ?? '';
  return [first, lastFirst].filter(Boolean).join(' ') || 'Participante';
}

/** La inicial de la tarjeta; «·» sin nombre. */
export function initialOf(
  ref: Pick<ProfileRef, 'firstName' | 'lastName'>,
): string {
  const c = (
    (ref.firstName ?? '').trim() || (ref.lastName ?? '').trim()
  ).charAt(0);
  return c ? c.toLocaleUpperCase('es') : '·';
}

/** Los nombres frecuentes que acaban en consonante y son femeninos (`sticpa_guess_self_label`, menu.php l. 287-312). */
const FEMININE_EXCEPTIONS = new Set([
  'carmen',
  'pilar',
  'soledad',
  'isabel',
  'belén',
  'inés',
  'mercedes',
  'lourdes',
  'dolores',
  'ángeles',
  'montserrat',
  'rocío',
  'raquel',
  'miriam',
  'ruth',
  'noelia',
  'yolanda',
  'esther',
  'marta',
  'ester',
  'itziar',
  'nagore',
  'yasmin',
  'nur',
]);

/** «Yo mismo» / «Yo misma»: el género si se sabe; si no, la heurística del plugin; sin nombre, «Yo mismo/a». */
export function selfLabel(
  ref: Pick<ProfileRef, 'firstName' | 'gender'>,
): string {
  if (ref.gender === 'female') return 'Yo misma';
  if (ref.gender === 'male') return 'Yo mismo';
  const first = firstNameOf(ref).toLocaleLowerCase('es');
  if (first === '') return 'Yo mismo/a';
  return FEMININE_EXCEPTIONS.has(first) || first.endsWith('a')
    ? 'Yo misma'
    : 'Yo mismo';
}

/** «Mis datos», o «Datos de Lucía» viendo a un hijo (sin nombre, «Datos del participante»). */
export function dataTitle(
  active: Pick<ProfileRef, 'firstName'>,
  isSelf: boolean,
): string {
  if (isSelf) return 'Mis datos';
  const first = firstNameOf(active);
  return first ? `Datos de ${first}` : 'Datos del participante';
}
