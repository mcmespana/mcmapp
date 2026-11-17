/**
 * Cantos que encajan con las lecturas del domingo. Sin IA y sin servidor: se
 * comparan las palabras con peso de las lecturas con la letra de cada canción.
 *
 * - Se quitan tildes, palabras vacías y las muy cortas; se recorta el plural.
 * - Una palabra vale más cuanto más RARA es en el cantoral («viña» dice mucho,
 *   «señor» nada: sale en casi todas).
 * - El salmo y el evangelio pesan más que las lecturas.
 * Es una pista, no un veredicto: por eso se enseñan las palabras que coinciden.
 */

export interface MatchSource {
  text: string;
  /** Peso de esta lectura. */
  weight: number;
}

export interface MatchSong {
  filename: string;
  title: string;
  /** ChordPro o letra. */
  content: string;
}

export interface SongMatch {
  filename: string;
  score: number;
  /** Palabras en común, las más significativas primero (como en la lectura). */
  words: string[];
}

const STOP = new Set(
  `a al algo algun alguna algunas alguno algunos alli ante antes aquel aquella aquellas aquellos aqui asi aun aunque bien cada casi como con contra cual cuales cuando cuanto de del desde donde dos durante el ella ellas ellos en entonces entre era eran eres es esa esas ese eso esos esta estaba estaban estan estar estas este esto estos fue fueron ha habia habian han hasta hay he hizo hoy la las le les lo los mas me mi mia mientras mis mucho muy nada ni no nos nosotros nuestra nuestras nuestro nuestros o os otra otras otro otros para pero poco por porque pues que quien quienes se sea sean segun ser si sido siempre sin sino sobre sois somos son soy su sus tal tambien tan tanto te teneis tenemos tener tengo ti tiene tienen toda todas todavia todo todos tras tu tus un una unas uno unos vosotros vuestra vuestro y ya yo
dijo dice decia dijeron diciendo respondio contesto aquel tiempo lectura palabra libro carta santo evangelio segun gloria amen aleluya hermanos vez dia dias hombre hombres cosa cosas hacer hace hecho ver visto ir va van vino venir viene dar dio da puede pueden tenia estaba ahora luego despues
senor dios jesus cristo padre`.split(/\s+/),
);

export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Raíz tosca: quita el plural. Suficiente para «ovejas» ↔ «oveja». */
export function stem(word: string): string {
  if (word.length > 5 && word.endsWith('es')) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/** Palabras con peso de un texto: raíz → cómo se escribió la primera vez. */
export function keywords(text: string): Map<string, string> {
  const out = new Map<string, string>();
  const clean = text
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/<[^>]*>/g, ' ');
  for (const raw of clean.split(/[^\p{L}]+/u)) {
    if (raw.length < 4) continue;
    const folded = fold(raw);
    if (STOP.has(folded)) continue;
    const root = stem(folded);
    if (STOP.has(root) || root.length < 4) continue;
    if (!out.has(root)) out.set(root, raw.toLowerCase());
  }
  return out;
}

/**
 * Afinidad de CADA canción con las lecturas: filename → puntos y palabras en
 * común. Solo entran las que comparten al menos dos palabras con peso (una
 * sola es casi siempre casualidad). Base de `matchSongs` y de la misa que
 * propone «Cantos para el domingo» (`utils/sundaySongs.ts`).
 */
export function readingsAffinity(
  sources: MatchSource[],
  songs: MatchSong[],
): Map<string, SongMatch> {
  const out = new Map<string, SongMatch>();
  // Palabras de las lecturas con su peso (el mayor de donde salgan).
  const wanted = new Map<string, { weight: number; shown: string }>();
  for (const src of sources) {
    if (!src.text) continue;
    for (const [root, shown] of keywords(src.text)) {
      const prev = wanted.get(root);
      if (!prev || src.weight > prev.weight)
        wanted.set(root, { weight: src.weight, shown: prev?.shown ?? shown });
    }
  }
  if (!wanted.size || !songs.length) return out;

  const songWords = songs.map(
    (s) => new Set(keywords(`${s.title}\n${s.content}`).keys()),
  );
  // En cuántas canciones sale cada palabra buscada.
  const df = new Map<string, number>();
  for (const set of songWords)
    for (const root of wanted.keys())
      if (set.has(root)) df.set(root, (df.get(root) ?? 0) + 1);

  const n = songs.length;
  songs.forEach((song, i) => {
    const hits: { shown: string; value: number }[] = [];
    for (const [root, w] of wanted) {
      if (!songWords[i].has(root)) continue;
      const idf = Math.log(1 + n / (df.get(root) ?? 1));
      hits.push({ shown: w.shown, value: idf * w.weight });
    }
    if (hits.length < 2) return;
    hits.sort((a, b) => b.value - a.value);
    const score = hits.reduce((sum, h) => sum + h.value, 0);
    out.set(song.filename, {
      filename: song.filename,
      score,
      words: hits.slice(0, 4).map((h) => h.shown),
    });
  });
  return out;
}

export function matchSongs(
  sources: MatchSource[],
  songs: MatchSong[],
  limit = 12,
): SongMatch[] {
  return [...readingsAffinity(sources, songs).values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** El próximo domingo (hoy, si es domingo), como `YYYY-MM-DD` local. */
export function nextSundayIso(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
