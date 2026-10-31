// utils/comunica/home.ts
//
// La portada de familias y miembros (plan 11), pura: qué bloques y filas se
// enseñan a cada audiencia, con las palabras del plugin, y el saludo. Origen:
// `pages/single_stic_home.php`, `menu.php` (`getSticMenuElements`,
// `sticpa_datos_de_label`) y `sticpa_section_meta` (descripciones).
//
// La portada no conoce las rutas de otros planes: cada fila lleva su DESTINO
// del plugin, y quien la pinta lo abre con el plan 10 (`nativeHrefFor` o el
// legado con el perfil puesto).

import type { Destination } from '@/services/comunica/links';
import {
  type Audience,
  type FamilySection,
  isSectionVisible,
} from './profiles';

/** Una fila de la portada. `monitor` = «Mis datos de monitor» (plan 09). */
export type HomeRowKey = FamilySection | 'monitor';

export interface HomeRow {
  key: HomeRowKey;
  title: string;
  /** La de `sticpa_section_meta`. */
  description: string;
  destination: Destination;
}

export interface HomeBlock {
  key: 'activities' | 'profile';
  title: string;
  rows: HomeRow[];
}

/** `sticpa_section_meta`: la descripción de cada sección. */
export const SECTION_DESCRIPTION: Record<HomeRowKey, string> = {
  events: 'Las actividades a las que te puedes apuntar.',
  registrations: 'A qué estás apuntado y en qué estado está.',
  calendar: 'Tus actividades, día a día.',
  payments: 'Tus pagos y recibos, con su estado.',
  documents: 'Tus documentos, para verlos y descargarlos.',
  profile: 'Tus datos personales, de contacto, MCM, salud y RGPD.',
  monitor: 'Tu trayectoria, formación y certificado de delitos sexuales.',
};

/** La página del plugin de cada fila (su destino). */
export const SECTION_PAGE: Record<HomeRowKey, string> = {
  events: 'list_stic_events',
  registrations: 'list_stic_registrations',
  calendar: 'single_stic_activities_calendar',
  payments: 'list_stic_payments',
  documents: 'list_stic_documents',
  profile: 'single_stic_comunica_perfil',
  monitor: 'single_stic_comunica_monitor',
};

/** «Datos de Lucía» (`sticpa_datos_de_label`); sin nombre, «Sus datos». */
export const datosDeLabel = (childFirstName: string) =>
  childFirstName ? `Datos de ${childFirstName}` : 'Sus datos';

/** El título de cada fila, según a quién se ve (`getSticMenuElements`). */
export function sectionTitle(
  key: HomeRowKey,
  audience: Audience,
  childFirstName = '',
): string {
  switch (key) {
    case 'events':
      return 'Eventos';
    case 'registrations':
      // «Mis inscripciones» (10/10/2026); viendo a un hijo no son «mías».
      return audience === 'child' ? 'Inscripciones' : 'Mis inscripciones';
    case 'calendar':
      return 'Calendario';
    case 'payments':
      return 'Pagos';
    case 'documents':
      return 'Documentos';
    case 'profile':
      return audience === 'child' ? datosDeLabel(childFirstName) : 'Mis datos';
    case 'monitor':
      return 'Mis datos de monitor';
  }
}

const ACTIVITY_ORDER: FamilySection[] = [
  'events',
  'registrations',
  'calendar',
  'payments',
  'documents',
];

/**
 * Los bloques de la portada, en el orden del plugin:
 *   · «Actividades» (`member` y `child`): Eventos, Inscripciones, Calendario,
 *     Pagos y Documentos. Al familiar a secas solo le queda Pagos, y el
 *     bloque se llama «Tus pagos»: el dinero sale de su cuenta (FAM-a11).
 *   · «Tu perfil»: «Mis datos» o «Datos de Lucía» y, a un monitor que se ve a
 *     sí mismo, «Mis datos de monitor».
 */
export function homeSections({
  audience,
  childFirstName = '',
  isMonitor = false,
}: {
  audience: Audience;
  childFirstName?: string;
  isMonitor?: boolean;
}): HomeBlock[] {
  const row = (key: HomeRowKey): HomeRow => ({
    key,
    title: sectionTitle(key, audience, childFirstName),
    description: SECTION_DESCRIPTION[key],
    destination: { internalpage: SECTION_PAGE[key] },
  });
  const activities = ACTIVITY_ORDER.filter((s) =>
    isSectionVisible(s, audience),
  ).map(row);
  const profile: HomeRow[] = [row('profile')];
  if (isMonitor && audience !== 'child') profile.push(row('monitor'));
  const onlyPayments =
    activities.length === 1 && activities[0].key === 'payments';
  return [
    {
      key: 'activities',
      title: onlyPayments ? 'Tus pagos' : 'Actividades',
      rows: activities,
    },
    { key: 'profile', title: 'Tu perfil', rows: profile },
  ];
}

/** «Hola, Marta 👋»; sin nombre, «¡Te damos la bienvenida! 👋». */
export const greetingTitle = (firstName: string) =>
  firstName ? `Hola, ${firstName} 👋` : '¡Te damos la bienvenida! 👋';

/**
 * La entradilla del saludo, en trozos para poner en negrita el nombre del
 * hijo: viendo a un hijo, «Aquí ves los datos de **Lucía** y le inscribes a
 * las actividades.»; al familiar a secas, lo suyo; si no, «Tu espacio
 * personal…».
 */
export function greetingLead(
  audience: Audience,
  childFirstName: string,
): { text: string; strong?: boolean }[] {
  if (audience === 'child' && childFirstName) {
    return [
      { text: 'Aquí ves los datos de ' },
      { text: childFirstName, strong: true },
      { text: ' y le inscribes a las actividades.' },
    ];
  }
  if (audience === 'guardian') {
    return [
      {
        text: 'Aquí están tus datos y lo que se cobra de tu cuenta. Las inscripciones y los documentos de quienes tienes a tu cargo están en su ficha.',
      },
    ];
  }
  return [{ text: 'Tu espacio personal. Elige una sección para empezar.' }];
}

/** El saludo cerrado vuelve al mes (`js/stic-ui.js::bindHeroClose`). */
export const GREETING_HIDDEN_DAYS = 30;

export function isGreetingHidden(
  hiddenAt: string | null | undefined,
  now: Date,
): boolean {
  if (!hiddenAt) return false;
  const t = new Date(hiddenAt).getTime();
  if (Number.isNaN(t)) return false;
  return now.getTime() - t < GREETING_HIDDEN_DAYS * 24 * 60 * 60_000;
}
