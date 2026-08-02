/**
 * Tests del hook useSongProcessor (núcleo del cantoral, antes sin cobertura —
 * PLAN_CALIDAD §5.1).
 *
 * El hook transforma ChordPro → HTML que luego pinta el WebView. Aquí no
 * renderizamos el WebView: comprobamos el *string* HTML resultante (badges de
 * tono/cejilla/transpose, notación ES/EN, clases de <body> para acordes y
 * tema, y la cabecera de modo presentación).
 */
import { renderHook } from '@testing-library/react-native';
import {
  useSongProcessor,
  type UseSongProcessorParams,
} from '@/hooks/useSongProcessor';

const baseParams: UseSongProcessorParams = {
  originalChordPro: '{title: Canción Test}\n[C]Hola [G]mundo',
  currentTranspose: 0,
  chordsVisible: true,
  currentFontSizeEm: 1,
  currentFontFamily: 'system',
  notation: 'EN',
  title: 'Canción Test',
  author: 'Autor Test',
  key: 'C',
  capo: 0,
};

// RNTL 14 hizo `renderHook` asíncrono (envuelve el render en `act`), así que
// el helper devuelve una promesa y cada test la espera.
const renderSong = (overrides: Partial<UseSongProcessorParams> = {}) =>
  renderHook(() => useSongProcessor({ ...baseParams, ...overrides }));

// Muchos nombres de clase (chords-hidden, song-meta-author…) aparecen SIEMPRE
// en el <style> y en el script del HTML. Para comprobar el estado real hay que
// mirar la clase del <body>, no el documento entero.
const bodyClass = (html: string): string =>
  html.match(/<body class="([^"]*)"/)?.[1] ?? '';

describe('useSongProcessor — básico', () => {
  it('devuelve songHtml, isLoadingSong y styleState', async () => {
    const { result } = await renderSong();
    expect(typeof result.current.songHtml).toBe('string');
    expect(result.current.isLoadingSong).toBe(false);
    expect(result.current.styleState).toBeDefined();
  });

  it('genera HTML con la letra de la canción', async () => {
    const { result } = await renderSong();
    expect(result.current.songHtml).toContain('<body');
    expect(result.current.songHtml).toContain('Hola');
  });

  it('sin ChordPro no genera la canción y deja de cargar', async () => {
    const { result } = await renderSong({ originalChordPro: '' });
    expect(result.current.isLoadingSong).toBe(false);
    // songHtml se queda en el placeholder inicial.
    expect(result.current.songHtml).toBe('Cargando…');
  });

  it('ante ChordPro inválido (no string) marca error sin romper', async () => {
    const { result } = await renderSong({
      originalChordPro: undefined as unknown as string,
    });
    expect(result.current.isLoadingSong).toBe(false);
  });
});

describe('useSongProcessor — acordes y tema (clases de body)', () => {
  it('oculta acordes con chords-hidden en el body cuando chordsVisible es false', async () => {
    const { result } = await renderSong({ chordsVisible: false });
    expect(bodyClass(result.current.songHtml)).toContain('chords-hidden');
  });

  it('no añade chords-hidden al body cuando los acordes son visibles', async () => {
    const { result } = await renderSong({ chordsVisible: true });
    expect(bodyClass(result.current.songHtml)).not.toContain('chords-hidden');
  });

  it('aplica theme-dark al body en modo oscuro', async () => {
    const { result } = await renderSong({ isDark: true });
    expect(bodyClass(result.current.songHtml)).toContain('theme-dark');
  });

  it('no aplica theme-dark al body en modo claro', async () => {
    const { result } = await renderSong({ isDark: false });
    expect(bodyClass(result.current.songHtml)).not.toContain('theme-dark');
  });
});

describe('useSongProcessor — badges de tono / cejilla / transpose', () => {
  it('muestra el tono en notación inglesa (C)', async () => {
    const { result } = await renderSong({ notation: 'EN', key: 'C' });
    expect(result.current.songHtml).toContain('meta-badge">C<');
  });

  it('muestra el tono en notación española (DO)', async () => {
    const { result } = await renderSong({ notation: 'ES', key: 'C' });
    expect(result.current.songHtml).toContain('meta-badge">DO<');
  });

  it('transpone el tono mostrado (+2 sobre C → D)', async () => {
    const { result } = await renderSong({
      notation: 'EN',
      key: 'C',
      currentTranspose: 2,
    });
    expect(result.current.songHtml).toContain('meta-badge">D<');
    expect(result.current.songHtml).toContain('+2 semitonos');
  });

  it('muestra semitonos negativos con signo', async () => {
    const { result } = await renderSong({ currentTranspose: -3 });
    expect(result.current.songHtml).toContain('-3 semitonos');
  });

  it('muestra la cejilla cuando capo > 0', async () => {
    const { result } = await renderSong({ capo: 2 });
    expect(result.current.songHtml).toContain('Cejilla 2');
  });

  it('no muestra cejilla cuando capo es 0', async () => {
    const { result } = await renderSong({ capo: 0 });
    expect(result.current.songHtml).not.toContain('Cejilla');
  });

  it('muestra el autor fuera de pantalla completa', async () => {
    const { result } = await renderSong({ isFullscreen: false });
    expect(result.current.songHtml).toContain('<div class="song-meta-author">');
    expect(result.current.songHtml).toContain('Autor Test');
  });
});

describe('useSongProcessor — modo presentación (fullscreen)', () => {
  it('usa la cabecera fs-header con el título y oculta el bloque de autor normal', async () => {
    const { result } = await renderSong({
      isFullscreen: true,
      title: 'Mi Título',
    });
    expect(result.current.songHtml).toContain('fs-header');
    expect(result.current.songHtml).toContain('Mi Título');
    expect(result.current.songHtml).not.toContain(
      '<div class="song-meta-author">',
    );
  });
});

describe('useSongProcessor — sanitización de contenido no confiable (XSS)', () => {
  // `/songs/data` es escribible públicamente (panel secreto sin Firebase
  // Auth, ver docs/SEGURIDAD.md §3.1), así que título/autor/letra/tono deben
  // tratarse como HTML no confiable antes de entrar en el WebView.
  const SCRIPT = '<script>alert(1)</script>';

  it('escapa el autor (prop) en el bloque de metadatos', async () => {
    const { result } = await renderSong({
      author: SCRIPT,
      isFullscreen: false,
    });
    expect(result.current.songHtml).not.toContain(SCRIPT);
    expect(result.current.songHtml).toContain(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });

  it('escapa el autor (prop) en la cabecera de pantalla completa', async () => {
    const { result } = await renderSong({ author: SCRIPT, isFullscreen: true });
    expect(result.current.songHtml).not.toContain(SCRIPT);
  });

  it('escapa el título (prop) en la cabecera de pantalla completa', async () => {
    const { result } = await renderSong({ title: SCRIPT, isFullscreen: true });
    expect(result.current.songHtml).not.toContain(SCRIPT);
  });

  it('escapa el tono (prop key) en el badge', async () => {
    const { result } = await renderSong({ key: SCRIPT });
    expect(result.current.songHtml).not.toContain(SCRIPT);
  });

  it('escapa el título embebido en el propio ChordPro ({title: ...})', async () => {
    const { result } = await renderSong({
      originalChordPro: `{title: ${SCRIPT}}\n[C]Hola`,
    });
    expect(result.current.songHtml).not.toContain(SCRIPT);
    expect(result.current.songHtml).toContain('&lt;script&gt;');
  });

  it('escapa un comentario malicioso en el cuerpo del ChordPro', async () => {
    const { result } = await renderSong({
      originalChordPro: `{title: Test}\n{comment: ${SCRIPT}}\n[C]Hola`,
    });
    expect(result.current.songHtml).not.toContain(SCRIPT);
  });

  it('escapa HTML embebido en una línea de letra', async () => {
    const { result } = await renderSong({
      originalChordPro: `{title: Test}\n[C]Hola ${SCRIPT} mundo`,
    });
    expect(result.current.songHtml).not.toContain(SCRIPT);
    expect(result.current.songHtml).toContain('Hola');
    expect(result.current.songHtml).toContain('mundo');
  });

  it('no doble-escapa un "&" normal en la letra', async () => {
    const { result } = await renderSong({
      originalChordPro: '{title: Test}\n[C]Tú & Yo',
    });
    // ChordSheetJS trocea la letra por columna de acorde ("Tú " / "& Yo"), así
    // que solo comprobamos que el "&" está escapado una única vez.
    expect(result.current.songHtml).toContain('&amp; Yo');
    expect(result.current.songHtml).not.toContain('&amp;amp;');
  });
});

describe('useSongProcessor — styleState', () => {
  it('refleja los parámetros de estilo de entrada', async () => {
    const { result } = await renderSong({
      currentFontSizeEm: 1.5,
      isDark: true,
      chordsVisible: false,
    });
    expect(result.current.styleState.fontSize).toBe(1.5);
    expect(result.current.styleState.isDark).toBe(true);
    expect(result.current.styleState.chordsVisible).toBe(false);
  });
});
