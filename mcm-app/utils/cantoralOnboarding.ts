/**
 * Onboarding del cantoral: la parte pura (pasos, cuándo se abre solo y qué
 * canción se enseña de muestra). La pantalla está en
 * `components/song-onboarding/CantoralOnboarding.tsx`.
 *
 * Todo lo que se elige son ajustes normales de `SettingsContext`, que se
 * aplican al momento sobre una canción de verdad y se pueden volver a cambiar
 * cuando se quiera (Aa → «Letra y vista» en cada canción, o el «?» del
 * cantoral). Ver `docs/funcionalidades/HOJA_CANCION.md`.
 */

/**
 * Sube este número si el onboarding cambia tanto que merece la pena que todo
 * el mundo lo vuelva a ver una vez.
 */
export const CANTORAL_ONBOARDING_VERSION = 1;

export type OnboardingStepId = 'role' | 'repeats' | 'chorus' | 'text' | 'tags';

/** Los pasos, en orden. El de etiquetas solo si hay etiquetas que elegir. */
export function onboardingSteps(opts: {
  hasTags: boolean;
}): OnboardingStepId[] {
  const steps: OnboardingStepId[] = ['role', 'repeats', 'chorus', 'text'];
  if (opts.hasTags) steps.push('tags');
  return steps;
}

/** ¿Se abre solo? Una vez por versión, y nunca mientras cargan los ajustes. */
export function shouldAutoOpenOnboarding(
  seenVersion: number | undefined,
  isLoadingSettings: boolean,
): boolean {
  if (isLoadingSettings) return false;
  return (seenVersion ?? 0) < CANTORAL_ONBOARDING_VERSION;
}

export interface PreviewSong {
  content: string;
  title?: string;
  author?: string;
  key?: string;
  capo?: number;
}

type SongsData = Record<
  string,
  {
    songs?: {
      filename?: string;
      title?: string;
      author?: string;
      key?: string;
      capo?: string | number;
      content?: string;
    }[];
  }
> | null;

/**
 * Canciones que se enseñan primero si están: conocidas, cortas, con
 * estrofas, estribillo que se repite y acordes. Si ninguna está, se busca una
 * parecida (ver `previewScore`).
 */
export const PREFERRED_PREVIEW_SONGS = [
  '17.seas_quien_seas.cho',
  '01.ven_a_celebrar.cho',
];

const CHORD_RE = /\[[^\]]+\]/g;

/**
 * Lo buena que es una canción para enseñar lo que hace cada opción: tiene
 * que tener estribillo repetido (si no, «compacta» no cambia nada), acordes
 * y al menos dos estrofas, y caber más o menos en media pantalla. 0 = no vale.
 */
export function previewScore(content: string): number {
  if (!hasRepeatedChorus(content)) return 0;
  const chords = (content.match(CHORD_RE) ?? []).length;
  if (chords < 8) return 0;
  const lyricLines = content
    .split('\n')
    .filter((l) => l.trim() && !/^\s*\{/.test(l)).length;
  if (lyricLines < 8 || lyricLines > 30) return 0;
  if (/revisar|pendiente/i.test(content)) return 0;
  // Cuanto más cerca de ~16 líneas, mejor.
  return 100 - Math.abs(lyricLines - 16);
}

/** Un `{chorus}`, o dos estribillos `{soc}` con la misma letra. */
export function hasRepeatedChorus(content: string): boolean {
  if (/\{\s*chorus\s*(:[^}]*)?\}/i.test(content)) return true;
  const blocks =
    content.match(
      /\{\s*(?:soc|start_of_chorus)\s*\}([\s\S]*?)\{\s*(?:eoc|end_of_chorus)\s*\}/gi,
    ) ?? [];
  const seen = new Set<string>();
  for (const b of blocks) {
    const text = b
      .replace(/\{[^}]*\}/g, '')
      .replace(CHORD_RE, '')
      .toLowerCase()
      .replace(/[^a-záéíóúüñ]+/g, ' ')
      .trim();
    if (!text) continue;
    if (seen.has(text)) return true;
    seen.add(text);
  }
  return false;
}

export function pickPreviewSong(data: SongsData): PreviewSong | null {
  if (!data) return null;
  const all = Object.values(data).flatMap((c) => c?.songs ?? []);
  const toPreview = (s: (typeof all)[number]): PreviewSong => ({
    content: s.content ?? '',
    title: s.title?.replace(/^\d+\.\s*/, ''),
    author: s.author || undefined,
    key: s.key || undefined,
    capo: Number(s.capo) || 0,
  });
  for (const name of PREFERRED_PREVIEW_SONGS) {
    const s = all.find((x) => x.filename === name && x.content);
    if (s && hasRepeatedChorus(s.content!)) return toPreview(s);
  }
  let best: (typeof all)[number] | null = null;
  let bestScore = 0;
  for (const s of all) {
    if (!s.content) continue;
    const score = previewScore(s.content);
    if (score > bestScore) {
      best = s;
      bestScore = score;
    }
  }
  if (best) return toPreview(best);
  return { content: FALLBACK_PREVIEW, title: 'Canción de muestra' };
}

/**
 * Por si no hay cantoral descargado: una canción inventada con lo justo para
 * ver cada opción (dos estrofas, estribillo repetido, acordes).
 */
export const FALLBACK_PREVIEW = `[G]Aquí va la primera es[D]trofa,
con su [Em]letra y sus a[C]cordes.
[G]Cada línea es una [D]frase
que se [C]canta de un ti[D]rón.

{soc}
[C]Este es el es[G]tribillo,
el que [D]canta todo el [Em]mundo,
[C]el que vuelve una y [G]otra
[D]vez al terminar.
{eoc}

[G]Esta es la segunda es[D]trofa,
con su [Em]número a la iz[C]quierda.
[G]Mira arriba cómo [D]cambia
cuando [C]tocas cada op[D]ción.

{soc}
[C]Este es el es[G]tribillo,
el que [D]canta todo el [Em]mundo,
[C]el que vuelve una y [G]otra
[D]vez al terminar.
{eoc}
`;
