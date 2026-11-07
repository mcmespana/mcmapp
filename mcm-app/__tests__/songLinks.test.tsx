/**
 * Enlaces de una canción que NO son audio embebido: Spotify, partituras de
 * Drive y otras webs.
 *
 * Lo que se protege aquí es la ÚNICA distinción que importa y la que es fácil
 * romper sin darse cuenta: Spotify sale de la app (no hay embed posible) y
 * Drive/otros se ven a pantalla completa dentro. Si algún día alguien manda un
 * Spotify al visor interno, sale un iframe que Spotify rechaza y el usuario ve
 * una pantalla en blanco; este test lo caza.
 *
 * Contrato de los campos: `docs/CAMPOS_CANCIONES.md` §3.1 del repo
 * `mcmapp-cantoral`.
 */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { Linking, TouchableOpacity } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('react-native-webview', () => {
  const ReactLocal = require('react');
  return {
    WebView: (props: Record<string, unknown>) =>
      ReactLocal.createElement('MockWebView', props),
  };
});

import SongMediaSheet from '@/components/song-media/SongMediaSheet';
import SongLinkViewer, {
  toViewerUrl,
} from '@/components/song-media/SongLinkViewer';
import {
  extractSongMedia,
  mediaKinds,
  songExtraLinks,
  type SongMedia,
} from '@/types/songMedia';

const INITIAL_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const SPOTIFY_URL = 'https://open.spotify.com/track/1a2b3c4d5e';
const DRIVE_DOC_URL =
  'https://drive.google.com/file/d/1AbCdEfGhIjK/view?usp=drive_link';
const OTHER_URL = 'https://doceacordes.es/partituras/ven-a-celebrar.pdf';

const MEDIA: SongMedia = {
  spotifyLinks: [{ label: 'Alborada', url: SPOTIFY_URL }],
  driveLinks: [{ label: 'Partitura', url: DRIVE_DOC_URL }],
  otherLinks: [{ label: '', url: OTHER_URL }],
};

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={INITIAL_METRICS}>
      {children}
    </SafeAreaProvider>
  );
}

function renderSheet(onOpenLink: jest.Mock) {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(
      <Wrap>
        <SongMediaSheet
          visible
          onClose={() => {}}
          media={MEDIA}
          songTitle="Canción"
          onPlayMedia={jest.fn()}
          onOpenLink={onOpenLink}
        />
      </Wrap>,
    );
  });
  return tree;
}

function pressableRows(tree: ReturnType<typeof create>) {
  return tree.root
    .findAllByType(TouchableOpacity)
    .filter((node) => typeof node.props.onPress === 'function');
}

describe('modelo de datos', () => {
  it('lee los tres campos nuevos del objeto de canción', () => {
    const media = extractSongMedia({
      title: 'Ven a Celebrar',
      spotifyLinks: [{ label: 'Alborada', url: SPOTIFY_URL }],
      driveLinks: [{ label: 'Partitura', url: DRIVE_DOC_URL }],
      otherLinks: [{ label: '', url: OTHER_URL }],
    });

    expect(media?.spotifyLinks).toEqual([
      { label: 'Alborada', url: SPOTIFY_URL },
    ]);
    expect(media?.driveLinks).toEqual([
      { label: 'Partitura', url: DRIVE_DOC_URL },
    ]);
    expect(media?.otherLinks).toEqual([{ label: '', url: OTHER_URL }]);
  });

  it('una canción que SOLO tiene un enlace de Spotify cuenta como que tiene ficha', () => {
    // Si no, el botón de multimedia no aparece y el enlace es invisible.
    const media = extractSongMedia({ spotifyLinks: [{ url: SPOTIFY_URL }] });
    expect(media).not.toBeNull();
    expect(mediaKinds(media).links).toBe(true);
    expect(mediaKinds(media).audio).toBe(false);
  });

  it('marca como externo solo Spotify', () => {
    expect(songExtraLinks(MEDIA).map((e) => [e.kind, e.external])).toEqual([
      ['spotify', true],
      ['drive', false],
      ['otro', false],
    ]);
  });

  it('no inventa enlaces cuando la canción no trae ninguno', () => {
    expect(songExtraLinks(extractSongMedia({ album: 'X' }))).toEqual([]);
    expect(songExtraLinks(null)).toEqual([]);
  });
});

describe('hoja de multimedia · sección Enlaces', () => {
  it('Spotify NO va al visor interno: se abre fuera de la app', async () => {
    const openURL = jest
      .spyOn(Linking, 'openURL')
      .mockResolvedValue(undefined as never);
    const onOpenLink = jest.fn();
    const tree = renderSheet(onOpenLink);

    await act(async () => {
      pressableRows(tree)[0].props.onPress();
    });

    expect(onOpenLink).not.toHaveBeenCalled();
    expect(openURL).toHaveBeenCalledWith(SPOTIFY_URL);
    openURL.mockRestore();
  });

  it('la partitura de Drive se abre a pantalla completa dentro de la app', () => {
    const onOpenLink = jest.fn();
    const tree = renderSheet(onOpenLink);

    act(() => {
      pressableRows(tree)[1].props.onPress();
    });

    expect(onOpenLink).toHaveBeenCalledWith({
      kind: 'drive',
      url: DRIVE_DOC_URL,
      label: 'Partitura',
    });
  });

  it('un enlace sin etiqueta llega al visor con un nombre por defecto', () => {
    const onOpenLink = jest.fn();
    const tree = renderSheet(onOpenLink);

    act(() => {
      pressableRows(tree)[2].props.onPress();
    });

    expect(onOpenLink).toHaveBeenCalledWith({
      kind: 'otro',
      url: OTHER_URL,
      label: 'Ver enlace',
    });
  });
});

describe('visor a pantalla completa', () => {
  it('Drive se carga por /preview (el /view de compartir no se deja embeber)', () => {
    expect(toViewerUrl({ kind: 'drive', url: DRIVE_DOC_URL, label: '' })).toBe(
      'https://drive.google.com/file/d/1AbCdEfGhIjK/preview',
    );
  });

  it('el resto de enlaces se cargan tal cual', () => {
    expect(toViewerUrl({ kind: 'otro', url: OTHER_URL, label: '' })).toBe(
      OTHER_URL,
    );
  });

  it('monta el WebView con la URL del enlace', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <Wrap>
          <SongLinkViewer
            source={{ kind: 'drive', url: DRIVE_DOC_URL, label: 'Partitura' }}
            onClose={() => {}}
          />
        </Wrap>,
      );
    });

    const webViews = tree.root.findAllByType('MockWebView' as never);
    expect(webViews).toHaveLength(1);
    expect(webViews[0].props.source).toEqual({
      uri: 'https://drive.google.com/file/d/1AbCdEfGhIjK/preview',
    });
  });

  it('si no se puede embeber, ofrece abrirlo fuera con la URL original', async () => {
    const openURL = jest
      .spyOn(Linking, 'openURL')
      .mockResolvedValue(undefined as never);
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <Wrap>
          <SongLinkViewer
            source={{ kind: 'drive', url: DRIVE_DOC_URL, label: 'Partitura' }}
            onClose={() => {}}
          />
        </Wrap>,
      );
    });

    act(() => {
      tree.root.findByType('MockWebView' as never).props.onError();
    });

    const fallback = pressableRows(tree).find(
      (node) => node.props.accessibilityLabel === 'Abrir fuera de la app',
    );
    expect(fallback).toBeDefined();
    await act(async () => {
      fallback!.props.onPress();
    });
    // Fuera de la app va el enlace de compartir, que es el que captura la app
    // de Drive; el /preview no siempre resuelve fuera del iframe.
    expect(openURL).toHaveBeenCalledWith(DRIVE_DOC_URL);
    openURL.mockRestore();
  });

  it('sin enlace no pinta nada', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <Wrap>
          <SongLinkViewer source={null} onClose={() => {}} />
        </Wrap>,
      );
    });
    expect(tree.root.findAllByType('MockWebView' as never)).toHaveLength(0);
  });
});
