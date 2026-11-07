/**
 * Datos de prueba de Firebase para DESARROLLO (simulador y capturas).
 *
 * Solo se usan si el build se lanza con `EXPO_PUBLIC_FIREBASE_FIXTURES=1`
 * (ver `hooks/useFirebaseData.ts`). Las builds de tienda y la web publicada no
 * llevan la variable: ahí este fichero no se lee y todo sigue yendo a Firebase.
 *
 * Es contenido inventado a propósito (no son canciones ni álbumes reales): sirve
 * para ver las pantallas con datos sin tocar la base de verdad. Las portadas de
 * los álbumes sí son las de `portadas-albumes/`, servidas por jsDelivr.
 */

const cover = (file: string) =>
  `https://cdn.jsdelivr.net/gh/mcmespana/mcmapp@main/portadas-albumes/${encodeURIComponent(file)}`;

const ALBUMS = [
  {
    id: '2025-jubileo-2',
    title: 'Jubileo de los jóvenes · Roma',
    location: 'Roma',
    date: 'Agosto 2025',
    imageUrl: cover('2025-jubileo2.png'),
    albumUrl: 'https://photos.google.com/',
  },
  {
    id: '2025-jubileo-1',
    title: 'Jubileo · el camino',
    location: 'Roma',
    date: 'Agosto 2025',
    imageUrl: cover('2025-jubileo1.png'),
    albumUrl: 'https://photos.google.com/',
  },
  {
    id: '2025-pascua-joven',
    title: 'Pascua Joven',
    location: 'Villaclara',
    date: 'Abril 2025',
    imageUrl: cover('25 Pascua Joven.jpg'),
    albumUrl: 'https://photos.google.com/',
  },
  {
    id: '2025-congreso-mc',
    title: 'Congreso MC',
    location: 'Madrid',
    date: 'Marzo 2025',
    imageUrl: cover('25 Congreso MC.jpeg'),
    albumUrl: 'https://photos.google.com/',
  },
  {
    id: '2024-pascua-encuentro',
    title: 'Pascua · Encuentro',
    location: 'Valencia',
    date: 'Abril 2024',
    imageUrl: cover('24 Pascua Encuentro.jpg'),
    albumUrl: 'https://photos.google.com/',
  },
  {
    id: '2024-mat',
    title: 'MAT',
    location: 'Cantabria',
    date: 'Julio 2024',
    imageUrl: cover('24 MAT.jpg'),
    albumUrl: 'https://photos.google.com/',
  },
];

const SONGS = {
  ordinario: {
    categoryTitle: 'Ordinario de la misa',
    songs: [
      {
        title: '01. Señor, ten piedad',
        filename: '01.senor_ten_piedad.cho',
        author: 'Letra de prueba',
        key: 'Am',
        content:
          '{title: Señor, ten piedad}\n{key: Am}\n\n{start_of_verse}\n[Am]Señor, ten pie[G]dad,\n[F]Cristo, ten pie[E]dad,\n[Am]Señor, ten pie[G]dad[Am]\n{end_of_verse}',
      },
      {
        title: '02. Gloria a Dios',
        filename: '02.gloria_a_dios.cho',
        author: 'Letra de prueba',
        key: 'D',
        content:
          '{title: Gloria a Dios}\n{key: D}\n\n{start_of_chorus}\n[D]Gloria a Dios en el [A]cielo,\ny en la [Bm]tierra paz a los [G]hombres\n{end_of_chorus}\n\n{start_of_verse}\n[D]Te alabamos, te ben[A]decimos,\n[Bm]te adoramos, te glori[G]ficamos[D]\n{end_of_verse}',
      },
    ],
  },
  entrada: {
    categoryTitle: 'Entrada',
    songs: [
      {
        title: 'Venid y cantemos',
        filename: 'venid_y_cantemos.cho',
        author: 'Letra de prueba',
        key: 'G',
        capo: 2,
        content:
          '{title: Venid y cantemos}\n{key: G}\n\n{start_of_chorus}\n[G]Venid y can[D]temos al [Em]Señor,\n[C]aclamemos a la [D]Roca de nuestra sal[G]vación\n{end_of_chorus}\n\n{start_of_verse}\n[G]Entremos en su pre[D]sencia con ac[Em]ción de gracias,\n[C]con cantos de ale[D]gría ale[G]mos\n{end_of_verse}',
      },
      {
        title: 'Un pueblo en camino',
        filename: 'un_pueblo_en_camino.cho',
        author: 'Letra de prueba',
        key: 'C',
        content:
          '{title: Un pueblo en camino}\n{key: C}\n\n{start_of_verse}\n[C]Caminamos jun[F]tos hacia la ca[G]sa del [C]Padre,\n[Am]con la mochila [F]llena de espe[G]ranza[C]\n{end_of_verse}',
      },
    ],
  },
  comunion: {
    categoryTitle: 'Comunión',
    songs: [
      {
        title: 'Pan de vida',
        filename: 'pan_de_vida.cho',
        author: 'Letra de prueba',
        key: 'E',
        content:
          '{title: Pan de vida}\n{key: E}\n\n{start_of_chorus}\n[E]Pan de vi[B]da, pan com[C#m]partido,\n[A]alimento del cami[B]nante[E]\n{end_of_chorus}',
      },
    ],
  },
};

/**
 * Historial de notificaciones de prueba (nodo `/notifications` de Firebase).
 *
 * Pensado para ver TODOS los casos de la bandeja de una vez: sin leer y leídas,
 * con y sin icono, imagen grande, texto largo, uno/dos/tres botones, destino
 * interno, deep link a un evento, cada categoría, un título larguísimo, una de
 * hace más de 60 días (se da por leída sola) y dos dirigidas a una audiencia
 * (monitores: se ve con el perfil «Monitor/a»; familias: NO se ve).
 *
 * Las fechas son relativas a «ahora» para que los grupos Hoy / Ayer / Esta
 * semana / Anteriores salgan siempre. En el primer uso la app deja SIN LEER las
 * 3 más recientes (`initializeNewUserReadStatus`); para volver a ese estado
 * basta con borrar los datos de la app o reinstalarla en el simulador.
 */
export function devNotificationsFixture(now: number = Date.now()) {
  const ago = (minutes: number) =>
    new Date(now - minutes * 60 * 1000).toISOString();
  const HOUR = 60;
  const DAY = 24 * HOUR;
  const base = (id: string, minutesAgo: number) => ({
    id,
    createdAt: ago(minutesAgo),
    sentAt: ago(minutesAgo),
  });
  const icon = cover('2025-jubileo1.png');

  return [
    {
      ...base('fx-urgente', 12),
      title: 'Cambio de sala para la reunión de hoy',
      body: 'La reunión de coordinación es en el aula 3, no en la capilla.',
      category: 'urgente',
      priority: 'high',
    },
    {
      ...base('fx-rica', 3 * HOUR),
      title: 'Ya están las fotos del Jubileo',
      body: 'Hemos subido las primeras fotos del camino a Roma. ¡Mirad qué caras!',
      bodyLong:
        'Hemos subido las primeras fotos del camino a Roma.\n\nSon más de 300 y todavía faltan las de la vigilia, que llegarán esta semana. Si salís en alguna y preferís que no esté, escribidnos y la quitamos.\n\n¡Gracias a todos los que habéis compartido las vuestras!',
      icon,
      imageUrl: cover('25 Pascua Joven.jpg'),
      category: 'fotos',
      internalRoute: '/(tabs)/fotos',
      actionButtons: [
        {
          text: 'Ver el álbum',
          url: 'https://photos.google.com/',
          isInternal: false,
        },
        { text: 'Ir a Fotos', url: '/(tabs)/fotos', isInternal: true },
        {
          text: 'Compartir tus fotos',
          url: 'https://example.org/fotos',
          isInternal: false,
        },
      ],
    },
    {
      ...base('fx-evento', 5 * HOUR),
      title: 'Jubileo: cambio en el horario del sábado',
      body: 'La acogida pasa a las 10:00. El resto del programa no cambia.',
      category: 'eventos',
      eventId: 'jubileo',
    },
    {
      ...base('fx-calendario', 26 * HOUR),
      title: 'Nuevo evento en el calendario',
      body: 'Encuentro de monitores el 14 de diciembre en Madrid.',
      category: 'eventos',
      icon,
      internalRoute: '/(tabs)/calendario',
      actionButton: {
        text: 'Ver calendario',
        url: '/(tabs)/calendario',
        isInternal: true,
      },
    },
    {
      ...base('fx-cantoral', 2 * DAY),
      title: 'Canciones nuevas en el cantoral',
      body: 'Hemos añadido 4 canciones de Adviento.',
      category: 'cancionero',
      internalRoute: '/(tabs)/cancionero',
    },
    {
      ...base('fx-monitores', 3 * DAY),
      title: 'Solo monitores: material para la próxima reunión',
      body: 'Este aviso llega solo al perfil Monitor/a (prueba del filtro de audiencia).',
      category: 'general',
      audience: {
        match: 'all',
        todos: false,
        perfiles: ['monitor'],
        delegaciones: [],
        eventId: null,
      },
    },
    {
      ...base('fx-familias', 3 * DAY + HOUR),
      title: 'Solo familias: reunión de padres',
      body: 'Este aviso NO debe verse con el perfil Monitor/a (prueba del filtro de audiencia).',
      category: 'general',
      audience: {
        match: 'all',
        todos: false,
        perfiles: ['familia'],
        delegaciones: [],
        eventId: null,
      },
    },
    {
      ...base('fx-celebracion', 5 * DAY),
      title: '¡Feliz cumpleaños, Consolación!',
      body: 'Hoy celebramos un año más de camino juntos.',
      category: 'celebraciones',
      icon,
    },
    {
      ...base('fx-mantenimiento', 9 * DAY),
      title: 'Mantenimiento programado de la app',
      body: 'El jueves de 3:00 a 4:00 la app puede ir más lenta.',
      category: 'mantenimiento',
    },
    {
      ...base('fx-titulo-largo', 12 * DAY),
      title:
        'Un título extraordinariamente largo para comprobar que la fila lo recorta en una sola línea sin romper nada',
      body: 'Y un cuerpo también largo: lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua, ut enim ad minim veniam.',
      category: 'general',
      icon,
    },
    {
      ...base('fx-general', 20 * DAY),
      title: 'Bienvenida a la nueva versión',
      body: 'Gracias por usar la app. Cuéntanos qué te parece desde Ajustes.',
      category: 'general',
    },
    {
      ...base('fx-antigua', 75 * DAY),
      title: 'Aviso antiguo (más de 60 días)',
      body: 'Se da por leída automáticamente por su antigüedad.',
      category: 'general',
    },
  ];
}

/**
 * Calendarios de prueba (nodo `/calendars`): tres calendarios PÚBLICOS de
 * festivos de Google, para que la pantalla de Calendario tenga botones
 * (suscribirse, calendarios activos) y eventos de verdad. Hace falta red.
 */
const CALENDARS = [
  {
    id: 'fx-espana',
    name: 'Festivos de España',
    url: 'https://calendar.google.com/calendar/ical/es.spain%23holiday%40group.v.calendar.google.com/public/basic.ics',
    color: '#E15C62',
    defaultSelected: true,
  },
  {
    id: 'fx-cristianos',
    name: 'Fiestas cristianas',
    url: 'https://calendar.google.com/calendar/ical/en.christian%23holiday%40group.v.calendar.google.com/public/basic.ics',
    color: '#6C4B9E',
    defaultSelected: true,
  },
  {
    id: 'fx-usa',
    name: 'Festivos de EE. UU.',
    url: 'https://calendar.google.com/calendar/ical/en.usa%23holiday%40group.v.calendar.google.com/public/basic.ics',
    color: '#31AADF',
    defaultSelected: false,
  },
];

const FIXTURES: Record<string, unknown> = {
  albums: ALBUMS,
  songs: SONGS,
  calendars: CALENDARS,
};

/** `undefined` = no hay dato de prueba para ese nodo (se va a Firebase). */
export function devFixtureFor(path: string): unknown {
  return FIXTURES[path];
}
