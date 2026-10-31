// utils/comunica/profiles.ts
//
// Las reglas de los perfiles de familia (plan 11), puras y sin React: a quién
// se ve al entrar, la audiencia, cuándo hay que elegir antes de un enlace, a
// dónde se va al cambiar de persona y los nombres. Origen:
// `inc/stic-family.php` (`sticpa_viewing_context`, `sticpa_bootstrap_family`,
// `sticpa_landing_page`, `sticpa_family_must_choose_first`,
// `sticpa_family_switch_destination`, `sticpa_visible_sections`) y `menu.php`
// (`sticpa_short_name`, `sticpa_name_initial`, `sticpa_guess_self_label`).

import {
  type ProfileRef,
  type Role,
  TEAM_ROLES,
} from '@/services/comunica/contract';
import { PLUGIN_PAGES } from '@/services/comunica/links';

/**
 * A quién habla la pantalla (`sticpa_viewing_context`):
 *   · `child` — un familiar viendo a un hijo (el plugin: `participante`).
 *   · `guardian` — familiar y nada más, viéndose a sí mismo (`familiar`).
 *   · `member` — cualquier otro caso: miembro del MCM, tenga hijos o no.
 */
export type Audience = 'member' | 'guardian' | 'child';

/** La elección guardada en el móvil (por persona; se borra al salir). */
export interface ProfileChoice {
  activeId: string;
  /** Se eligió a propósito (o se eligió solo, con un único hijo). */
  chosen: boolean;
}

/** Quién ha entrado y sus hijos (`GET /v1/me/profiles`). */
export interface ProfilesData {
  self: ProfileRef;
  children: ProfileRef[];
}

/**
 * Miembro del MCM: el papel `member` o uno de equipo (ser monitor es ser
 * miembro; `sticpa_es_miembro_por_tipo_de_relacion`).
 */
export const isMemberRoles = (roles: readonly Role[]): boolean =>
  roles.includes('member') || roles.some((r) => TEAM_ROLES.includes(r));

/** `sticpa_viewing_context()['audiencia']`. */
export function audienceFor(
  who: { member: boolean; hasChildren: boolean },
  viewingSelf: boolean,
): Audience {
  if (who.hasChildren && !viewingSelf) return 'child';
  if (who.hasChildren && !who.member) return 'guardian';
  return 'member';
}

/** ¿Sigue valiendo lo elegido? (Un hijo con la relación terminada, no.) */
const isValidChoice = (saved: ProfileChoice | null, p: ProfilesData) =>
  !!saved &&
  (saved.activeId === p.self.id ||
    p.children.some((c) => c.id === saved.activeId));

/**
 * A quién se ve al entrar (`sticpa_bootstrap_family` + `sticpa_landing_page`):
 *
 * | Quién                       | Al abrir                                   |
 * | No es familiar              | Él mismo                                   |
 * | Familiar y miembro          | Él mismo (a los hijos, con el selector)    |
 * | Solo familiar, un hijo      | Ese hijo, elegido solo (cuenta como tal)   |
 * | Solo familiar, varios       | Hay que elegir («¿A quién quieres ver?»)   |
 * | Solo familiar, ninguno      | Él mismo                                   |
 *
 * Lo elegido antes manda mientras siga valiendo; si el hijo recordado ya no
 * viene (relación terminada), se vuelve a aplicar la tabla.
 */
export function initialProfile({
  member,
  profiles,
  saved,
}: {
  member: boolean;
  profiles: ProfilesData;
  saved: ProfileChoice | null;
}): ProfileChoice & { mustChoose: boolean } {
  const { self, children } = profiles;
  if (isValidChoice(saved, profiles)) return { ...saved!, mustChoose: false };
  if (children.length === 0 || member) {
    return { activeId: self.id, chosen: false, mustChoose: false };
  }
  if (children.length === 1) {
    return { activeId: children[0].id, chosen: true, mustChoose: false };
  }
  return { activeId: self.id, chosen: false, mustChoose: true };
}

// ── Secciones ───────────────────────────────────────────────────────────────

/** Las secciones de familia (bloques del menú del plugin). */
export type FamilySection =
  | 'events'
  | 'registrations'
  | 'calendar'
  | 'payments'
  | 'documents'
  | 'profile';

/** Cada página del plugin de familias, con su sección. */
const SECTION_OF_PAGE: Record<string, FamilySection> = {
  list_stic_events: 'events',
  single_stic_events: 'events',
  list_stic_registrations: 'registrations',
  single_stic_registrations: 'registrations',
  single_stic_activities_calendar: 'calendar',
  single_stic_sessions: 'calendar',
  list_stic_sessions: 'calendar',
  list_stic_attendances: 'calendar',
  list_stic_payments: 'payments',
  single_stic_payments: 'payments',
  single_stic_payment_form: 'payments',
  single_stic_payment_error: 'payments',
  list_stic_payment_commitments: 'payments',
  single_stic_payment_commitments: 'payments',
  list_stic_documents: 'documents',
  single_stic_documents: 'documents',
  single_stic_comunica_perfil: 'profile',
  single_stic_profile: 'profile',
  single_stic_comunica_laico: 'profile',
  single_stic_tutor_profile: 'profile',
};

/** La sección de familia de una página del plugin, o `null` si no es de familia. */
export const sectionOfPage = (page: string): FamilySection | null =>
  SECTION_OF_PAGE[page] ?? null;

/** Las páginas del plugin de los planes de familias (12-16). */
export const isFamilyPage = (page: string): boolean =>
  ['12', '13', '14', '15', '16'].includes(
    (PLUGIN_PAGES as Record<string, string>)[page] ?? '',
  );

/**
 * Las secciones que se enseñan a cada audiencia (`sticpa_visible_sections`):
 * a un familiar que solo es familiar, viéndose a sí mismo, solo lo SUYO —sus
 * datos y el dinero que sale de su cuenta—; apuntarse es de sus hijos.
 */
export function visibleSections(audience: Audience): FamilySection[] {
  return audience === 'guardian'
    ? ['payments', 'profile']
    : [
        'events',
        'registrations',
        'calendar',
        'payments',
        'documents',
        'profile',
      ];
}

export const isSectionVisible = (
  section: FamilySection,
  audience: Audience,
): boolean => visibleSections(audience).includes(section);

/**
 * ¿Hay que elegir a quién antes de abrir este destino? (FAM-a1,
 * `sticpa_family_must_choose_first`, y el arreglo del plan 13):
 *   · Solo con una página de familia, y nunca la propia de elegir.
 *   · Nunca a un miembro, ni a quien no tiene hijos.
 *   · Solo familiar con dos o más hijos que nunca ha elegido: sí.
 *   · Ya elegido, solo si la audiencia activa no tiene esa sección: un
 *     familiar viéndose a sí mismo y un enlace a un evento («Inscribirme» le
 *     apuntaría a él).
 */
export function mustChooseFirst({
  page,
  member,
  childrenCount,
  chosen,
  audience,
}: {
  page: string;
  member: boolean;
  childrenCount: number;
  chosen: boolean;
  audience: Audience;
}): boolean {
  if (page === 'single_stic_profile_selection' || !isFamilyPage(page)) {
    return false;
  }
  if (member || childrenCount === 0) return false;
  if (!chosen && childrenCount >= 2) return true;
  const section = sectionOfPage(page);
  return !!section && !isSectionVisible(section, audience);
}

/**
 * Cómo se porta una pantalla al cambiar de persona (FAM-a8):
 *   · `shared` — no es de nadie (la lista de eventos, la ficha de un evento,
 *     el calendario): se queda y recarga con el `pid` nuevo.
 *   · `personal` — es de quien se veía (una inscripción, un pago, unos
 *     datos): a la portada.
 */
export type ProfileScope = 'shared' | 'personal';

/**
 * A dónde se va al cambiar de persona (`sticpa_family_switch_destination`):
 * en una compartida, se queda SI esa sección se le enseña a la nueva
 * audiencia; si no (un familiar que se elige a sí mismo desde Eventos), y en
 * toda pantalla personal, a la portada.
 */
export function switchDestination(
  scope: ProfileScope,
  section: FamilySection | null,
  next: Audience,
): 'stay' | 'home' {
  if (scope !== 'shared') return 'home';
  return !section || isSectionVisible(section, next) ? 'stay' : 'home';
}

// ── Nombres ─────────────────────────────────────────────────────────────────

const words = (s: string | null | undefined) =>
  (s ?? '').trim().split(/\s+/).filter(Boolean);

/** El nombre de pila: la primera palabra («María José» → «María»). */
export const firstNameOf = (name: string | null | undefined): string =>
  words(name)[0] ?? '';

/** Partículas que no son un apellido por sí solas («de la Fuente»). */
const PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'san', 'da']);

/** El primer apellido, con sus partículas («de la Fuente», no «de»). */
export function firstSurnameOf(lastName: string | null | undefined): string {
  const w = words(lastName);
  const out: string[] = [];
  for (const part of w) {
    out.push(part);
    if (!PARTICLES.has(part.toLowerCase())) break;
  }
  return out.join(' ');
}

/** Nombre completo, o «Participante» si el CRM no lo dio. */
export function fullName(p: Pick<ProfileRef, 'firstName' | 'lastName'>) {
  const s = [p.firstName, p.lastName].filter(Boolean).join(' ').trim();
  return s || 'Participante';
}

/**
 * El nombre CORTO (FAM-a11): nombre y primer apellido («Lucía Messeguer»),
 * nunca cortado a media palabra. Sin nombre, «Participante».
 */
export function shortName(p: Pick<ProfileRef, 'firstName' | 'lastName'>) {
  const s = [p.firstName?.trim(), firstSurnameOf(p.lastName)]
    .filter(Boolean)
    .join(' ');
  return s || 'Participante';
}

/** La inicial del avatar (`sticpa_name_initial`): «·» sin nombre. */
export function initialOf(p: Pick<ProfileRef, 'firstName' | 'lastName'>) {
  const n = firstNameOf(p.firstName) || firstNameOf(p.lastName);
  return n ? n.charAt(0).toLocaleUpperCase('es') : '·';
}

/** Nombres que acaban en consonante y son femeninos (lista del plugin). */
const FEMININE = new Set([
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

/**
 * «Yo mismo» / «Yo misma» para la tarjeta propia y el selector. El género de
 * la ficha primero; si no viene, la heurística del plugin
 * (`sticpa_guess_self_label`): una lista de excepciones y, si no, «-a» es
 * femenino. Sin nombre, «Yo mismo/a».
 */
export function selfLabel(p: Pick<ProfileRef, 'firstName' | 'gender'>) {
  if (p.gender === 'female') return 'Yo misma';
  if (p.gender === 'male') return 'Yo mismo';
  const first = firstNameOf(p.firstName).toLocaleLowerCase('es');
  if (!first) return 'Yo mismo/a';
  if (FEMININE.has(first)) return 'Yo misma';
  return first.endsWith('a') ? 'Yo misma' : 'Yo mismo';
}
