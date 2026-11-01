// Los textos de «Mis datos» (plan 12), palabra por palabra los del plugin (`single_stic_comunica_perfil.php`). Las ayudas ⓘ llevan `\n` donde el plugin
// tiene `<br>`; `**…**` es negrita (`<strong>`).

export const DATOS_COPY = {
  mine: 'Mis datos',
  saved: 'Los datos se han guardado correctamente.',
  saveError: 'Error al guardar los datos.',
  forbidden: {
    title: 'No tienes acceso a esto',
    subtitle: 'Estos datos no son de una persona a la que puedas ver.',
    action: 'Volver',
  },
  offlineEmpty: {
    title: 'Necesitas conexión para ver tus datos',
    subtitle: 'Por seguridad, estos datos no se guardan en el móvil.',
    action: 'Reintentar',
  },
  save: 'Guardar',
  saving: 'Guardando…',
  offlineSave:
    'Sin conexión: tus cambios siguen aquí. Guárdalos al volver la cobertura.',
  leave: {
    title: '¿Salir sin guardar?',
    message: 'Has cambiado datos y todavía no los has guardado.',
    action: 'Salir sin guardar',
  },
  sections: {
    identity: 'Datos personales',
    contact: 'Datos de contacto',
    address: 'Dirección',
    photo: 'Foto',
    mcm: 'MCM',
    health: 'Información sanitaria',
    consents: 'Autorizaciones legales',
  },
  greetingOwn: (first: string) =>
    `Hola ${first} 👋, estos son los datos que tenemos.`,
  greetingChild: (first: string) =>
    `Estos son los datos que tenemos de ${first}.`,
  greetingNoName: 'Estos son los datos que tenemos.',
  identity: {
    firstName: 'Nombre',
    lastName: 'Apellidos',
    documentType: 'Tipo de identificación',
    documentNumber: 'Número de identificación',
    birthDate: 'Fecha de nacimiento',
    gender: 'Género',
    support: 'Número de soporte del DNI',
    issueDate: 'Fecha de expedición del DNI',
    have: 'Ya lo tenemos. Puedes corregirlo si cambia.',
    locked:
      'Los campos con candado no se pueden editar desde el área privada. Si necesitas modificarlos, escribe a tu referente en ',
    referent: 'comunica@movimientoconsolacion.com',
    unset: 'Sin indicar',
  },
  contact: {
    warning: {
      strong: '@movimientoconsolacion.com',
      before: 'Mejor utiliza tu correo ',
      after: ': es el que usamos para todas las comunicaciones de monitores.',
    },
    soft: {
      before: 'Si tienes, usa el correo ',
      strong: '@movimientoconsolacion.com',
      after: '.',
    },
    email: 'Correo electrónico',
    mobile: 'Móvil',
    emergency: 'Contacto de emergencia',
    emergencyHelp:
      'Guardaremos el teléfono de un familiar con el que contactar en el (poco probable) caso de que pase algo grave.',
  },
  address: {
    street: 'Calle y número',
    city: 'Población',
    province: 'Provincia',
    postalCode: 'Código postal',
    region: 'Comunidad Autónoma',
  },
  photo: {
    change: 'Cambiar foto de perfil',
    add: 'Sube una foto para conocernos mejor ✨',
    buttonChange: 'Cambiar foto',
    buttonAdd: 'Elegir foto',
    hint: 'Formatos: jpg o png · Tamaño máximo: 4 MB',
    offline: 'Necesitas conexión para cambiar la foto.',
    sheetTitle: 'Foto de perfil',
    camera: 'Hacer una foto',
    library: 'Elegir de la galería',
    sheetHint: 'Se recorta en cuadrado. JPG o PNG de hasta 4 MB.',
    sheetHintWeb: 'JPG o PNG de hasta 4 MB.',
  },
  mcm: {
    stage: 'Etapa',
    scarf: 'Pañuelo',
    comLevel: 'Nivel COM',
    lcYear: 'Año incorporación LC',
    lcYearHelp:
      'Indica el año en el que hiciste la incorporación / compromiso como Laico/a Consolación Incorporado. Si no lo sabes, aproxímalo.',
    year: 'AAAA',
    shirtSize: 'Talla de camiseta',
    groupName: 'Grupo MCM',
    groupHelp:
      "Indica el nombre de tu grupo del COM o de Laicos Consolación.\nSi no tiene nombre, indica algunos datos que nos permitan identificarlo, por ejemplo 'Grupo de Laicos creado recientemente'.\n\nSi no tienes grupo indica 'Sin grupo'.\n**NO es el nombre del grupo del que eres monitor/a, es el de tu grupo de referencia.**",
    localMcm: 'MCM Local',
    memberSince: 'Pertenezco al MCM desde…',
    memberSinceHelp:
      '¡Más o menos! 😄 Escribe el año en el que comenzaste a participar en los grupos, tanto del MIC, como del COM como LC.\n\nSi no lo recuerdas porque hace muuucho tiempo, una fecha aproximada 😉',
  },
  health: {
    note: 'Te solicitamos algunos datos de salud que nos pueden ser útiles en las actividades presenciales. Trataremos estos datos con especial cuidado.',
    foodIntolerances: {
      label: 'Intolerancias alimentarias',
      help: 'Alergias, intolerancias alimentarias u otros datos relacionados con la alimentación, para poder transmitirlos, por ejemplo, a un albergue que gestione las comidas de una actividad.\nSi no tienes, déjalo en blanco.',
    },
    allergies: {
      label: 'Alergias',
      help: 'Alergias conocidas que no sean alimentarias.\nSi no tienes, déjalo en blanco.',
    },
    illnesses: {
      label: 'Enfermedades',
      help: 'Si existen enfermedades crónicas o relevantes que pueda ser importante conocer en el desarrollo de las actividades.\nSi no tienes, déjalo en blanco.',
    },
    treatments: {
      label: 'Tratamientos habituales',
      help: 'Si habitualmente se toma algún tipo de medicación, puedes indicarlo aquí.\nSi no hay nada concreto o crónico, déjalo en blanco.',
    },
    other: {
      label: 'Otros datos de salud',
      help: 'Cualquier otro dato de salud que no hayas reflejado anteriormente y consideres necesario compartir.\nSi no tienes, déjalo en blanco.',
    },
    loading: 'Cargando la información sanitaria…',
    error: 'No se ha podido cargar la información sanitaria.',
    retry: 'Reintentar',
  },
  consents: {
    unanswered: 'Sin contestar',
    seeTerms: 'Ver condiciones',
    items: [
      {
        key: 'dataProtection',
        statement: 'Acepto las condiciones sobre protección de datos',
        url: 'https://comunica.movimientoconsolacion.com/legal-rgpd',
      },
      {
        key: 'healthData',
        statement: 'Acepto las condiciones sobre el uso de mis datos de salud',
        url: 'https://comunica.movimientoconsolacion.com/legal-salud',
      },
      {
        key: 'photos',
        statement: 'Acepto las condiciones sobre la cesión de imágenes',
        url: 'https://comunica.movimientoconsolacion.com/legal-imagenes',
      },
    ],
  },
  pay: {
    title: 'Te faltan datos para poder pagar',
    body: 'Necesitamos tu nombre, apellidos, correo y documento de identidad. Complétalos en tus datos y vuelve al pago.',
    back: 'Volver al pago',
  },
} as const;

export type ConsentKey = (typeof DATOS_COPY.consents.items)[number]['key'];

/** La salud sale como las demás ayudas: etiqueta y ayuda por clave. */
export const HEALTH_FIELDS = [
  'foodIntolerances',
  'allergies',
  'illnesses',
  'treatments',
  'other',
] as const;
