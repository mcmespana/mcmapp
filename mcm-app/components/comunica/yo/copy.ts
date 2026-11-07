// Los textos de «Mis datos de monitor», palabra por palabra los del plugin
// (`pages/single_stic_comunica_monitor.php`, l. 34-207). Las ayudas ⓘ, igual.
// Sin los emoji que marcan (💨 📥 📙 ⏳): van como icono o no van; el 💡 de
// «Si no puedes completar esta parte…» es de tono y se queda (plan 09).

export const MONITOR_COPY = {
  title: 'Mis datos de monitor',
  intro: 'Nada es obligatorio: rellena lo que sepas y guarda.',
  sections: {
    path: 'Trayectoria',
    training: 'Formación',
    preMonitors: 'Premonitores',
    courses: 'Cursos oficiales',
    moreTraining: 'Otra formación',
    volunteering: 'Voluntariado',
    certificate: 'Certificado de Delitos Sexuales',
    files: 'Archivos',
  },
  monitorSince: {
    label: 'Monitor/a desde…',
    help: 'Año (aproximado) en el que empezaste como monitor/a Consolación.',
    placeholder: 'AAAA',
  },
  monitorOf: {
    label: 'Monitor/a de…',
    help: 'Si estás en varias etapas, marca aquella que te parece más relevante.',
  },
  preMonitors1: {
    label: 'Premonitores Año I',
    help: 'Primer año del curso interno de Premonitores/as Consolación.',
  },
  preMonitors2: {
    label: 'Premonitores Año II',
    help: 'Segundo año del curso interno de Premonitores/as Consolación.',
  },
  preMonitorsYear: { label: 'Año premonitores', placeholder: 'AAAA' },
  mat: {
    label: 'MAT',
    help: 'MAT = Curso oficial de Monitor/a de Actividades de Tiempo Libre infantil y juvenil. No es el curso de premonitores.',
  },
  matCourse: { label: 'Año MAT' },
  dat: {
    label: 'DAT',
    help: 'DAT = El siguiente paso al MAT, el curso oficial de Director/a de Actividades de Tiempo Libre infantil y juvenil.',
  },
  datYearAndSchool: { label: 'DAT · Año y escuela' },
  fa: {
    label: 'FA',
    help: 'FA es el curso oficial reconocido por la administración pública de Formador/a de Animadores/as, para impartir cursos MAT o DAT entre otros.',
  },
  faYearAndSchool: { label: 'FA · Año y escuela' },
  foodHandling: { label: 'Manipulación de alimentos' },
  congresses: {
    label: 'Congresos M+C',
    help: 'Congresos de Monitores Consolación realizados en los últimos años. Indica solo en los que hayas estado.',
  },
  academicBackground: { label: 'Formación académica' },
  volunteeringNote: {
    strong: 'Acuerdo de voluntariado:',
    rest: ' en tramitación, te lo enviaremos y lo firmarás en breve.',
  },
  volunteeringDescription: {
    label: 'Voluntariado: descripción de la actividad',
  },
  volunteeringPrograms: { label: 'Voluntariado: programas' },
  certificate: {
    // La nota de la sección, entera, en trozos para pintarla con sus enlaces.
    lead1: 'La ',
    leadStrong: 'legislación de voluntariado y protección a menores',
    lead2: ' nos exige mantener archivado cada año el ',
    aepdLink: 'certificado negativo de delitos de naturaleza sexual',
    lead3: '.',
    secure1: 'Con el sistema ',
    secureStrong: 'COMUNICA',
    secure2: ' gestionamos estos archivos de forma segura y digital. ',
    secure3: 'Tienes dos opciones para presentarlo cada curso:',
    autoStrong: 'AUTOMÁTICO',
    auto1:
      ': autoriza al MCM a solicitar el certificado cada año por ti. Solo tienes que seguir una vez el ',
    guideLink: 'paso a paso de la guía',
    auto2:
      ' para dar permiso usando la app móvil «Mi Carpeta Ciudadana». Son dos minutos y no tendrás que volverlo a hacer.',
    manualStrong: 'MANUAL',
    manual:
      ': descarga el certificado en PDF y súbelo tú mismo/a desde aquí. Tendrás que hacerlo cada mes de septiembre manualmente.',
    choiceLabel: 'Cómo presentas el certificado',
    automatic: {
      title: 'Automático',
      description: "Autorizaré al MCM en la app 'Mi Carpeta Ciudadana'.",
    },
    manualCard: {
      title: 'Manual',
      description: 'Envío aquí el certificado y lo renovaré cada septiembre.',
    },
    choose: 'Debes elegir Automático o Manual.',
    tutorial: "Ver tutorial para autorizarnos en 'Mi Carpeta Ciudadana'",
    upload: 'Subir Certificado de Delitos Sexuales',
    ministry: 'Ir al trámite del Ministerio de Justicia',
  },
  files: {
    note: '💡 Si no puedes completar esta parte en este momento, puedes volver y subir los archivos más adelante.',
    mat: 'Título MAT',
    dat: 'Título DAT',
    other: 'Otros certificados de formación',
    otherNote:
      'Puedes subir otros certificados para archivarlos: manipulador/a de alimentos, formador/a de animadores/as… (opcional).',
  },
  personal: {
    title: 'Tus datos personales',
    subtitle: 'Contacto, dirección, salud y permisos',
  },
  save: 'Guardar',
  saved: 'Los datos se han guardado correctamente.',
  saveError: 'Error al guardar los datos.',
  leave: {
    title: '¿Salir sin guardar?',
    message: 'Los cambios que no has guardado se perderán.',
    action: 'Salir sin guardar',
  },
  forbidden: {
    title: 'Esta sección es para monitores',
    subtitle: 'Solo la ven quienes tienen papel de monitor/a en Comunica.',
    action: 'Volver',
  },
} as const;

export const LINKS = {
  aepd: 'https://www.aepd.es/preguntas-frecuentes/10-menores-y-educacion/FAQ-1053-sobre-certificado-negativo-de-delitos-de-naturaleza-sexual',
  guide: 'https://comunica.movimientoconsolacion.com/monitoresDS',
  ministry:
    'https://sede.mjusticia.gob.es/es/tramites/certificado-registro-central',
} as const;
