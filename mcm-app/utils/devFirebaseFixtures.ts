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

const FIXTURES: Record<string, unknown> = {
  albums: ALBUMS,
  songs: SONGS,
};

/** `undefined` = no hay dato de prueba para ese nodo (se va a Firebase). */
export function devFixtureFor(path: string): unknown {
  return FIXTURES[path];
}
