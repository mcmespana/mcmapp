/**
 * @jest-environment jsdom
 */
/**
 * `swapBodyScript` ejecutado en un DOM de verdad (jsdom) con el HTML real de
 * una canción: cambia el contenido sin recargar, deja los scripts que ya
 * corren, conserva los estribillos desplegados, vuelve a maquetar y no
 * mueve el scroll.
 */
import { swapBodyScript } from '@/utils/songDisplayBridge';
import { renderSongDocument, type SongStyleState } from '@/utils/songDocument';

const style: SongStyleState = {
  fontSize: 1,
  fontFamily: 'system-ui',
  isDark: false,
  chordsVisible: true,
  arrangementsVisible: true,
  compact: true,
  verseNumbers: true,
  chorusStyle: 'negrita',
  chorusLabel: true,
  airy: false,
  paged: false,
  topPadding: 16,
  bottomPadding: 40,
};
// Estribillo repetido → en vista compacta la repetición sale plegada en un
// <details>.
const cho = [
  '{title: Prueba}',
  '{soc}',
  '[C]Estribillo de [G]prueba',
  '{eoc}',
  '',
  '[Am]Primera [F]estrofa',
  '',
  '{soc}',
  '[C]Estribillo de [G]prueba',
  '{eoc}',
].join('\n');
const html = (transpose: number) =>
  renderSongDocument(cho, {
    style,
    currentTranspose: transpose,
    notation: 'EN',
    key: 'C',
  }).html;

/** Carga el documento como lo dejaría el WebView (sin ejecutar scripts). */
function load(source: string) {
  const parsed = new DOMParser().parseFromString(source, 'text/html');
  document.documentElement.replaceWith(
    document.importNode(parsed.documentElement, true),
  );
}

const run = (js: string) => {
  (0, eval)(js);
};

beforeEach(() => {
  jest.useFakeTimers();
  (window as unknown as { __SONG_LAYOUT__?: unknown }).__SONG_LAYOUT__ = {
    refit: jest.fn(),
  };
  // Sin rAF, el script cae a setTimeout: así se controla con los timers.
  (
    window as unknown as { requestAnimationFrame?: unknown }
  ).requestAnimationFrame = undefined;
});

afterEach(() => {
  jest.useRealTimers();
});

it('cambia los acordes sin tocar los scripts ni el body', () => {
  load(html(0));
  const body = document.body;
  const scripts = Array.from(document.querySelectorAll('script'));
  expect(scripts.length).toBeGreaterThan(0);
  expect(document.body.textContent).toContain('Am');

  run(swapBodyScript(html(2)));

  expect(document.body).toBe(body);
  expect(Array.from(document.querySelectorAll('script'))).toEqual(scripts);
  // C+2 = D, Am+2 = Bm, en la cabecera aparece el aviso de transporte.
  expect(document.body.textContent).toContain('Bm');
  expect(document.body.textContent).not.toContain('Am');
  expect(document.body.textContent).toContain('+2 semitonos');
  // Los scripts siguen al final, detrás del contenido nuevo.
  expect(document.body.lastElementChild?.tagName).toBe('SCRIPT');
  const layout = (
    window as unknown as { __SONG_LAYOUT__: { refit: jest.Mock } }
  ).__SONG_LAYOUT__;
  expect(layout.refit).toHaveBeenCalledTimes(1);
});

it('conserva los estribillos desplegados y suelta el alto mínimo', () => {
  load(html(0));
  const before = document.querySelectorAll('details');
  expect(before.length).toBeGreaterThan(0);
  before[0].open = true;

  run(swapBodyScript(html(1)));
  const after = document.querySelectorAll('details');
  expect(after).toHaveLength(before.length);
  expect(after[0].open).toBe(true);

  // Mientras se cambia, el body no encoge; un frame después se suelta.
  expect(document.body.style.minHeight).not.toBe('');
  jest.runAllTimers();
  expect(document.body.style.minHeight).toBe('');
});

it('no mueve el scroll si no se ha movido', () => {
  load(html(0));
  const scrollTo = jest.fn();
  window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
  run(swapBodyScript(html(3)));
  jest.runAllTimers();
  expect(scrollTo).not.toHaveBeenCalled();
});
