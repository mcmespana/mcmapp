// utils/comunica/personDetailsSpec.ts
//
// «Mis datos» (plan 12) declarado: las siete secciones, en el orden y con los
// textos de `pages/single_stic_comunica_perfil.php` del plugin, palabra por
// palabra (los `<br>` son párrafos y los `<strong>`, `**negrita**`). El
// servidor da los valores, las opciones y qué secciones tiene cada persona;
// las etiquetas, ayudas y notas viven aquí. Un test compara el orden y las
// etiquetas con una lista copiada del plugin.

import type { PersonDetails } from '@/services/comunica/contract';
import type { FieldSpec, FormValues, SectionSpec } from './forms';
import { INVALID_DOCUMENT, isValidDocument } from './documentId';
import { humanDate } from './personDetails';

export const REFERENCE_EMAIL = 'comunica@movimientoconsolacion.com';

export const LEGAL_URLS = {
  dataProtection: 'https://comunica.movimientoconsolacion.com/legal-rgpd',
  healthData: 'https://comunica.movimientoconsolacion.com/legal-salud',
  photos: 'https://comunica.movimientoconsolacion.com/legal-imagenes',
} as const;

/** El pañuelo (lo que se puede escribir: «Desconocido» solo se lee). */
export const SCARF_OPTIONS = [
  { value: 'none', label: 'No' },
  { value: 'red', label: 'Rojo' },
  { value: 'green', label: 'Verde' },
  { value: 'blue', label: 'Azul' },
  { value: 'yellow', label: 'Amarillo' },
  { value: 'cross', label: 'Cruz' },
];

export const DETAILS_COPY = {
  saved: 'Los datos se han guardado correctamente.',
  saveError: 'Error al guardar los datos.',
  save: 'Guardar',
  saving: 'Guardando…',
  offlineSave:
    'Sin conexión: tus cambios siguen aquí. Guárdalos al volver la cobertura',
  forbidden: 'No tienes acceso a esto',
  needConnection: 'Necesitas conexión para ver tus datos',
  leave: {
    title: '¿Salir sin guardar?',
    message: 'Los cambios que no has guardado se perderán.',
    action: 'Salir',
  },
  pay: {
    title: 'Te faltan datos para poder pagar',
    body: 'Necesitamos tu nombre, apellidos, correo y documento de identidad. Complétalos en tus datos y vuelve al pago.',
    back: 'Volver al pago',
  },
  photo: {
    change: 'Cambiar foto de perfil',
    add: 'Sube una foto para conocernos mejor ✨',
    hint: 'Formatos: jpg, png o heic · Tamaño máximo: 15 MB',
  },
  unanswered: 'Sin contestar',
  seeConditions: 'Ver condiciones',
} as const;

const SUPPORT_HINT = 'Ya lo tenemos. Puedes corregirlo si cambia.';
const EMPTY_HEALTH_TAIL = 'Si no tienes, déjalo en blanco.';

export interface DetailsSpecContext {
  /** Las secciones que da el servidor para esta persona. */
  sections: PersonDetails['sections'];
  /** Se ve a un hijo (no a uno mismo). */
  viewingChild: boolean;
  /** El nombre de pila de quien se ve. */
  firstName: string;
  emailNote: PersonDetails['emailNote'];
  /** `completar=pago`: qué datos de identidad vacíos se pueden escribir. */
  fill?: Partial<
    Record<
      'firstName' | 'lastName' | 'documentType' | 'documentNumber',
      boolean
    >
  >;
  /** Las opciones (para enseñar el tipo de documento bloqueado). */
  options?: PersonDetails['options'];
}

const label = (
  options: { value: string; label: string }[] | undefined,
  v: unknown,
) =>
  typeof v === 'string'
    ? (options?.find((o) => o.value === v)?.label ?? v)
    : '';

/** El documento que se completa: con la letra buena (regla 9). */
const validFillDocument = (v: unknown, values: FormValues) => {
  if (typeof v !== 'string') return null;
  const type =
    values['identityFill.documentType'] ?? values['identity.documentType'];
  if (typeof type !== 'string' || !type) return 'Indica el tipo de documento';
  return isValidDocument(type, v) ? null : INVALID_DOCUMENT;
};

function identitySection(ctx: DetailsSpecContext): SectionSpec {
  const fill = ctx.fill ?? {};
  const name = ctx.firstName;
  const fields: FieldSpec[] = [
    {
      key: 'greeting',
      kind: 'note',
      label: ctx.viewingChild
        ? `Estos son los datos que tenemos de **${name}**.`
        : `Hola **${name}** 👋, estos son los datos que tenemos.`,
    },
    fill.firstName
      ? {
          key: 'identityFill.firstName',
          kind: 'text',
          label: 'Nombre',
          autoComplete: 'given-name',
          maxLength: 100,
        }
      : { key: 'identity.firstName', kind: 'locked', label: 'Nombre' },
    fill.lastName
      ? {
          key: 'identityFill.lastName',
          kind: 'text',
          label: 'Apellidos',
          autoComplete: 'family-name',
          maxLength: 100,
        }
      : { key: 'identity.lastName', kind: 'locked', label: 'Apellidos' },
    fill.documentType
      ? {
          key: 'identityFill.documentType',
          kind: 'select',
          label: 'Tipo de identificación',
          optionsKey: 'documentType',
        }
      : {
          key: 'identity.documentType',
          kind: 'locked',
          label: 'Tipo de identificación',
          format: (v) => label(ctx.options?.documentType, v),
        },
    fill.documentNumber
      ? {
          key: 'identityFill.documentNumber',
          kind: 'text',
          label: 'Número de identificación',
          maxLength: 30,
          validate: validFillDocument,
        }
      : {
          key: 'identity.documentNumber',
          kind: 'locked',
          label: 'Número de identificación',
        },
    {
      key: 'identity.birthDate',
      kind: 'locked',
      label: 'Fecha de nacimiento',
      format: humanDate,
    },
    { key: 'gender', kind: 'select', label: 'Género', optionsKey: 'gender' },
    {
      key: 'documentSupportNumber',
      kind: 'text',
      label: 'Número de soporte del DNI',
      hint: SUPPORT_HINT,
      onlyIfPresent: true,
      maxLength: 20,
    },
    {
      key: 'documentIssueDate',
      kind: 'date',
      label: 'Fecha de expedición del DNI',
      hint: SUPPORT_HINT,
      onlyIfPresent: true,
    },
    {
      key: 'lockedNote',
      kind: 'note',
      label:
        'Los campos con candado no se pueden editar desde el área privada. Si necesitas modificarlos, escribe a tu referente en',
      url: `mailto:${REFERENCE_EMAIL}`,
      urlLabel: REFERENCE_EMAIL,
    },
  ];
  return { id: 'identity', title: 'Datos personales', fields };
}

function contactSection(ctx: DetailsSpecContext): SectionSpec {
  const notes: FieldSpec[] =
    ctx.emailNote === 'mcm_email_warning'
      ? [
          {
            key: 'emailNote',
            kind: 'note',
            tone: 'warning',
            label:
              'Mejor utiliza tu correo **@movimientoconsolacion.com**: es el que usamos para todas las comunicaciones de monitores.',
          },
        ]
      : ctx.emailNote === 'mcm_email_soft'
        ? [
            {
              key: 'emailNote',
              kind: 'note',
              label: 'Si tienes, usa el correo **@movimientoconsolacion.com**.',
            },
          ]
        : [];
  return {
    id: 'contact',
    title: 'Datos de contacto',
    fields: [
      ...notes,
      {
        key: 'contact.email',
        kind: 'email',
        label: 'Correo electrónico',
        autoComplete: 'email',
        maxLength: 254,
      },
      {
        key: 'contact.mobile',
        kind: 'phone',
        label: 'Móvil',
        autoComplete: 'tel',
        maxLength: 30,
      },
      {
        key: 'contact.emergencyPhone',
        kind: 'phone',
        label: 'Contacto de emergencia',
        help: 'Guardaremos el teléfono de un familiar con el que contactar en el (poco probable) caso de que pase algo grave.',
        maxLength: 30,
      },
    ],
  };
}

const ADDRESS: SectionSpec = {
  id: 'address',
  title: 'Dirección',
  fields: [
    {
      key: 'address.street',
      kind: 'text',
      label: 'Calle y número',
      autoComplete: 'street-address',
      maxLength: 255,
    },
    {
      key: 'address.city',
      kind: 'text',
      label: 'Población',
      autoComplete: 'address-level2',
      maxLength: 100,
    },
    {
      key: 'address.province',
      kind: 'text',
      label: 'Provincia',
      maxLength: 100,
    },
    {
      key: 'address.postalCode',
      kind: 'postalCode',
      label: 'Código postal',
      autoComplete: 'postal-code',
      maxLength: 5,
    },
    {
      key: 'address.region',
      kind: 'select',
      label: 'Comunidad Autónoma',
      optionsKey: 'region',
    },
  ],
};

/** La foto la pinta la pantalla (`PhotoBlock`): aquí solo su sitio. */
const PHOTO: SectionSpec = { id: 'photo', title: 'Foto', fields: [] };

const MCM: SectionSpec = {
  id: 'mcm',
  title: 'MCM',
  fields: [
    { key: 'mcm.stage', kind: 'select', label: 'Etapa', optionsKey: 'stage' },
    { key: 'mcm.scarf', kind: 'select', label: 'Pañuelo', optionsKey: 'scarf' },
    {
      key: 'mcm.comLevel',
      kind: 'select',
      label: 'Nivel COM',
      optionsKey: 'comLevel',
      visibleWhen: (v) => v['mcm.stage'] === 'com',
    },
    {
      key: 'mcm.lcIncorporationYear',
      kind: 'year',
      label: 'Año incorporación LC',
      help: 'Indica el año en el que hiciste la incorporación / compromiso como Laico/a Consolación Incorporado. Si no lo sabes, aproxímalo.',
      placeholder: 'AAAA',
      maxLength: 4,
      visibleWhen: (v) => v['mcm.stage'] === 'lc_incorporated',
    },
    {
      key: 'mcm.shirtSize',
      kind: 'select',
      label: 'Talla de camiseta',
      optionsKey: 'shirtSize',
    },
    {
      key: 'mcm.groupName',
      kind: 'text',
      label: 'Grupo MCM',
      help: "Indica el nombre de tu grupo del COM o de Laicos Consolación.\nSi no tiene nombre, indica algunos datos que nos permitan identificarlo, por ejemplo 'Grupo de Laicos creado recientemente'.\n\nSi no tienes grupo indica 'Sin grupo'.\n**NO es el nombre del grupo del que eres monitor/a, es el de tu grupo de referencia.**",
      maxLength: 255,
    },
    {
      key: 'mcm.localMcm',
      kind: 'select',
      label: 'MCM Local',
      optionsKey: 'localMcm',
    },
    {
      key: 'mcm.memberSince',
      kind: 'year',
      label: 'Pertenezco al MCM desde…',
      help: '¡Más o menos! 😄 Escribe el año en el que comenzaste a participar en los grupos, tanto del MIC, como del COM como LC.\n\nSi no lo recuerdas porque hace muuucho tiempo, una fecha aproximada 😉',
      placeholder: 'AAAA',
      maxLength: 4,
    },
  ],
};

const HEALTH: SectionSpec = {
  id: 'health',
  title: 'Información sanitaria',
  fields: [
    {
      key: 'healthNote',
      kind: 'note',
      label:
        'Te solicitamos algunos datos de salud que nos pueden ser útiles en las actividades presenciales. Trataremos estos datos con especial cuidado.',
    },
    {
      key: 'health.foodIntolerances',
      kind: 'textarea',
      label: 'Intolerancias alimentarias',
      help: `Alergias, intolerancias alimentarias u otros datos relacionados con la alimentación, para poder transmitirlos, por ejemplo, a un albergue que gestione las comidas de una actividad.\n${EMPTY_HEALTH_TAIL}`,
      maxLength: 2000,
    },
    {
      key: 'health.allergies',
      kind: 'textarea',
      label: 'Alergias',
      help: `Alergias conocidas que no sean alimentarias.\n${EMPTY_HEALTH_TAIL}`,
      maxLength: 2000,
    },
    {
      key: 'health.illnesses',
      kind: 'textarea',
      label: 'Enfermedades',
      help: `Si existen enfermedades crónicas o relevantes que pueda ser importante conocer en el desarrollo de las actividades.\n${EMPTY_HEALTH_TAIL}`,
      maxLength: 2000,
    },
    {
      key: 'health.treatments',
      kind: 'textarea',
      label: 'Tratamientos habituales',
      help: 'Si habitualmente se toma algún tipo de medicación, puedes indicarlo aquí.\nSi no hay nada concreto o crónico, déjalo en blanco.',
      maxLength: 2000,
    },
    {
      key: 'health.other',
      kind: 'textarea',
      label: 'Otros datos de salud',
      help: `Cualquier otro dato de salud que no hayas reflejado anteriormente y consideres necesario compartir.\n${EMPTY_HEALTH_TAIL}`,
      maxLength: 2000,
    },
  ],
};

const CONSENTS: SectionSpec = {
  id: 'consents',
  title: 'Autorizaciones legales',
  fields: [
    {
      key: 'consents.dataProtection',
      kind: 'consent',
      label: 'Acepto las condiciones sobre protección de datos',
      url: LEGAL_URLS.dataProtection,
    },
    {
      key: 'consents.healthData',
      kind: 'consent',
      label: 'Acepto las condiciones sobre el uso de mis datos de salud',
      url: LEGAL_URLS.healthData,
    },
    {
      key: 'consents.photos',
      kind: 'consent',
      label: 'Acepto las condiciones sobre la cesión de imágenes',
      url: LEGAL_URLS.photos,
    },
  ],
};

/** El formulario entero para una persona: solo las secciones que le tocan. */
export function personDetailsSpec(ctx: DetailsSpecContext): SectionSpec[] {
  const all: SectionSpec[] = [
    identitySection(ctx),
    contactSection(ctx),
    ADDRESS,
    PHOTO,
    MCM,
    HEALTH,
    CONSENTS,
  ];
  return all.filter((s) => (ctx.sections as readonly string[]).includes(s.id));
}

/** Solo las secciones de salud o solo las demás (van por rutas distintas). */
export const isHealthKey = (key: string) => key.startsWith('health.');
