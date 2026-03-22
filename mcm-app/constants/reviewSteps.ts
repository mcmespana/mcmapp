// constants/reviewSteps.ts — Los 5 pasos de la Revisión del Día (Consolación)

export interface ReviewStepConfig {
  number: number;
  title: string;
  quote: string; // Frase de María Rosa Molas
  description: string;
  icon: string; // MaterialIcons name
  /** Whether this step has selectable tags */
  hasTags?: boolean;
  tags?: string[];
  /** Whether this step has a free-text input */
  hasTextInput?: boolean;
  textPlaceholder?: string;
}

export const REVIEW_STEPS: ReviewStepConfig[] = [
  {
    number: 1,
    title: 'Vivamos en la Presencia de Dios',
    quote: '«Vivamos en la Presencia de Dios»',
    description:
      'Ahora y aquí, ¡paro! Me tomo unos minutos para respirar profundamente y ser consciente de la Presencia de Dios en mí, en mi día, en mi quehacer cotidiano… repito pausadamente: ¡Tú estás conmigo Jesús!',
    icon: 'self-improvement',
    hasTextInput: true,
    textPlaceholder: 'Escribe lo que sientes en este momento...',
  },
  {
    number: 2,
    title: 'Doy gracias',
    quote: '«Demos gracias a Dios que nos favorece con…»',
    description:
      'Recorro este día y traigo a la memoria los encuentros, sentimientos y experiencias vividas. Doy gracias a Dios por las personas con que me he encontrado y por lo que he aprendido.',
    icon: 'favorite',
    hasTags: true,
    tags: [
      'la vida',
      'la salud',
      'la familia',
      'el trabajo',
      'la fe',
      'los Sacramentos',
      'la Iglesia',
      'los amigos',
      'la naturaleza',
      'los pequeños placeres',
      'creatividad',
      'ejercicio',
    ],
    hasTextInput: true,
    textPlaceholder: 'Doy gracias a Dios por los bienes recibidos...',
  },
  {
    number: 3,
    title: 'Pido perdón',
    quote: '«Sea la primera en pedir perdón y en perdonar»',
    description:
      'Miro dónde mis respuestas a Dios y a los demás han sido poco generosas. Pido perdón por mis faltas, omisiones, actitudes incoherentes y por aquellas personas que ofendí. Me dispongo a perdonar a quienes me han ofendido.',
    icon: 'healing',
    hasTags: true,
    tags: [
      'estrés',
      'frustración',
      'error',
      'impaciencia',
      'desánimo',
      'orgullo',
      'pereza',
      'desconfianza',
    ],
    hasTextInput: true,
    textPlaceholder: 'Repaso mis sentimientos y reconozco mis faltas...',
  },
  {
    number: 4,
    title: 'Conocimiento propio',
    quote:
      '«Ha de ir adelante en conocimiento propio, quitando todo obstáculo que le ofenda»',
    description:
      'Le pido a Dios que me ayude a reconocer en qué he de seguir creciendo para ser mejor instrumento de su Consolación.',
    icon: 'psychology',
    hasTextInput: true,
    textPlaceholder:
      '¿En qué quiero seguir creciendo? ¿Qué obstáculos necesito quitar?',
  },
  {
    number: 5,
    title: 'Y mañana, ¿qué?',
    quote: '«Hacía de sus días, días llenos»',
    description:
      '¿Cómo puedo hacer que mañana sea un "día lleno"? ¿Con qué actitud lo quiero vivir? Me dispongo para el día de mañana con la confianza que el Dios de toda consolación me acompañará.',
    icon: 'wb-sunny',
    hasTextInput: true,
    textPlaceholder: '¿Con qué actitud quiero vivir mañana?',
  },
];

export const CLOSING_TEXT =
  'Concluyo mi oración rezando un Padre Nuestro.';

export const INTRO_TEXT =
  'El Examen del día es una práctica con mucha tradición en la Iglesia. San Ignacio lo incorpora en su libro de los Ejercicios. Se trata de ver al final del día todo lo vivido como una película, pero desde el amor de Dios.';
