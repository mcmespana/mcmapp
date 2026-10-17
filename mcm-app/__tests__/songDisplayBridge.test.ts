/**
 * `utils/songDisplayBridge.ts`: transponer o cambiar la notación pinta la
 * canción DENTRO de la página ya cargada (sin recargar el WebView, sin
 * parpadeo y sin volver arriba), y solo cuando es seguro; y el teclado del
 * iframe llega a la ventana de la app.
 */
import {
  canSwapInPlace,
  documentShell,
  makeKeydownForwarder,
  nextSongView,
  type SongView,
} from '@/utils/songDisplayBridge';
import { renderSongDocument, type SongStyleState } from '@/utils/songDocument';

const style: SongStyleState = {
  fontSize: 1,
  fontFamily: 'system-ui',
  isDark: false,
  chordsVisible: true,
  arrangementsVisible: true,
  compact: false,
  verseNumbers: true,
  chorusStyle: 'negrita',
  chorusLabel: true,
  airy: false,
  paged: false,
  topPadding: 16,
  bottomPadding: 40,
};
const cho =
  '{title: Prueba}\n{key: C}\n[C]Letra de [G]prueba\n[Am]Otra [F]línea';
const doc = (
  opts: Partial<{
    transpose: number;
    notation: 'ES' | 'EN';
    adminMode: boolean;
    style: SongStyleState;
    chordPro: string;
  }> = {},
) =>
  renderSongDocument(opts.chordPro ?? cho, {
    style: opts.style ?? style,
    currentTranspose: opts.transpose ?? 0,
    notation: opts.notation ?? 'ES',
    key: 'C',
    adminMode: opts.adminMode ?? false,
  }).html;

describe('documentShell / canSwapInPlace', () => {
  it('transponer y cambiar la notación no cambian la carcasa', () => {
    const base = doc();
    expect(documentShell(base)).not.toBeNull();
    expect(canSwapInPlace(base, doc({ transpose: 2 }), true)).toBe(true);
    expect(canSwapInPlace(base, doc({ notation: 'EN' }), true)).toBe(true);
    // El contenido sí cambia (si no, no habría nada que pintar).
    expect(doc({ transpose: 2 })).not.toBe(base);
  });

  it('volver al HTML con el que se cargó también vale', () => {
    expect(canSwapInPlace(doc(), doc(), true)).toBe(true);
  });

  it('otra canción, aunque la carcasa coincida, recarga', () => {
    const other = doc({ chordPro: '{title: Otra}\n[D]Distinta' });
    expect(documentShell(other)).toBe(documentShell(doc()));
    expect(canSwapInPlace(doc(), other, false)).toBe(false);
  });

  it('si cambian los scripts (modo admin) recarga', () => {
    expect(canSwapInPlace(doc(), doc({ adminMode: true }), true)).toBe(false);
  });

  it('si cambia el CSS horneado (otro tema) recarga', () => {
    const dark = doc({ style: { ...style, isDark: true } });
    expect(canSwapInPlace(doc(), dark, true)).toBe(false);
  });

  it('un HTML sin body (el «Cargando…» inicial) nunca se intercambia', () => {
    expect(documentShell('Cargando…')).toBeNull();
    expect(canSwapInPlace('Cargando…', doc(), true)).toBe(false);
  });
});

describe('nextSongView', () => {
  const A = doc();
  const B = doc({ transpose: 1 });
  const loadedA: SongView = { loaded: A, key: 'a.cho', shown: A, swaps: 0 };
  const same = { docKey: 'a.cho', isLoading: false };

  it('sin cambios devuelve los mismos objetos (no repinta)', () => {
    const r = nextSongView(loadedA, true, { ...same, html: A });
    expect(r.view).toBe(loadedA);
    expect(r.ready).toBe(true);
  });

  it('con la página lista, transponer se pinta dentro sin recargar', () => {
    const r = nextSongView(loadedA, true, { ...same, html: B });
    expect(r.view).toEqual({ loaded: A, key: 'a.cho', shown: B, swaps: 1 });
    expect(r.ready).toBe(true);
  });

  it('subir y volver a bajar el tono vuelve a pintar el original', () => {
    const up = nextSongView(loadedA, true, { ...same, html: B }).view;
    const back = nextSongView(up, true, { ...same, html: A });
    expect(back.view).toEqual({ loaded: A, key: 'a.cho', shown: A, swaps: 2 });
  });

  it('si la página aún no ha cargado, recarga', () => {
    const r = nextSongView(loadedA, false, { ...same, html: B });
    expect(r.view).toEqual({ loaded: B, key: 'a.cho', shown: B, swaps: 0 });
    expect(r.ready).toBe(false);
  });

  it('otra canción recarga y marca la página como no lista', () => {
    const C = doc({ chordPro: '{title: Otra}\n[D]Distinta' });
    const r = nextSongView(loadedA, true, {
      html: C,
      docKey: 'c.cho',
      isLoading: false,
    });
    expect(r.view).toEqual({ loaded: C, key: 'c.cho', shown: C, swaps: 0 });
    expect(r.ready).toBe(false);
  });

  it('sin docKey (otras pantallas) se comporta como siempre: recarga', () => {
    const v: SongView = { ...loadedA, key: undefined };
    const r = nextSongView(v, true, {
      html: B,
      docKey: undefined,
      isLoading: false,
    });
    expect(r.view.loaded).toBe(B);
    expect(r.view.swaps).toBe(0);
  });

  it('con el spinner, la próxima página carga lo último que se enseñaba', () => {
    const swapped: SongView = { loaded: A, key: 'a.cho', shown: B, swaps: 1 };
    const r = nextSongView(swapped, true, {
      ...same,
      html: B,
      isLoading: true,
    });
    expect(r.view).toEqual({ loaded: B, key: 'a.cho', shown: B, swaps: 0 });
    expect(r.ready).toBe(false);
  });
});

describe('makeKeydownForwarder', () => {
  class FakeKeyboardEvent {
    constructor(
      public type: string,
      public init: Record<string, unknown>,
    ) {}
  }
  const makeTarget = (cancel: boolean) => {
    const dispatched: FakeKeyboardEvent[] = [];
    const target = {
      KeyboardEvent: FakeKeyboardEvent,
      dispatchEvent: (e: FakeKeyboardEvent) => {
        dispatched.push(e);
        return !cancel;
      },
    } as unknown as Window;
    return { target, dispatched };
  };
  const key = (k: string, extra: Partial<KeyboardEvent> = {}) =>
    ({
      key: k,
      code: `Key${k.toUpperCase()}`,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      repeat: false,
      preventDefault: jest.fn(),
      ...extra,
    }) as unknown as KeyboardEvent;

  it('reenvía la tecla con sus modificadores a la ventana de la app', () => {
    const { target, dispatched } = makeTarget(false);
    const e = key('k', { metaKey: true });
    makeKeydownForwarder(target)(e);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].type).toBe('keydown');
    expect(dispatched[0].init).toMatchObject({
      key: 'k',
      metaKey: true,
      cancelable: true,
    });
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('si un atajo la consume, cancela también la original', () => {
    const { target } = makeTarget(true);
    const e = key('k', { metaKey: true });
    makeKeydownForwarder(target)(e);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('Tab se queda en el iframe', () => {
    const { target, dispatched } = makeTarget(false);
    makeKeydownForwarder(target)(key('Tab'));
    expect(dispatched).toHaveLength(0);
  });
});
