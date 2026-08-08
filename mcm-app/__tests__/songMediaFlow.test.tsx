/**
 * Cadena de multimedia del cantoral: hoja → reproductor flotante.
 *
 * Cubre lo que se rompió sin que ningún test se enterara: que los botones de
 * reproducir de la hoja avisen de verdad a quien abre el reproductor, y que el
 * reproductor monte el embed correcto (YouTube con `Referer`, Drive con la URL
 * de `preview`).
 */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { TouchableOpacity } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('react-native-webview', () => {
  const ReactLocal = require('react');
  return {
    WebView: (props: Record<string, unknown>) =>
      ReactLocal.createElement('MockWebView', props),
  };
});

import SongMediaSheet from '@/components/song-media/SongMediaSheet';
import FloatingMediaPlayer from '@/components/song-media/FloatingMediaPlayer';
import type { SongMedia } from '@/types/songMedia';

const INITIAL_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={INITIAL_METRICS}>
      {children}
    </SafeAreaProvider>
  );
}

const MEDIA: SongMedia = {
  videoEmbed: 'https://www.youtube.com/embed/aaaaaaaaaaa',
  youtubeLinks: [
    { label: 'Otra versión', url: 'https://www.youtube.com/embed/bbbbbbbbbbb' },
  ],
  audioLinks: [
    {
      label: 'Pista',
      url: 'https://drive.google.com/file/d/1234567890abcdef/view?usp=drive_link',
    },
  ],
};

/** Filas pulsables de la hoja, en orden de pantalla. */
function pressableRows(tree: ReturnType<typeof create>) {
  return tree.root
    .findAllByType(TouchableOpacity)
    .filter((node) => typeof node.props.onPress === 'function');
}

function renderSheet(onPlayMedia: jest.Mock) {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(
      <Wrap>
        <SongMediaSheet
          visible
          onClose={() => {}}
          media={MEDIA}
          songTitle="Canción"
          onPlayMedia={onPlayMedia}
        />
      </Wrap>,
    );
  });
  return tree;
}

describe('hoja de multimedia', () => {
  it('el vídeo principal abre el reproductor con su URL de embed', () => {
    const onPlayMedia = jest.fn();
    const tree = renderSheet(onPlayMedia);

    act(() => {
      pressableRows(tree)[0].props.onPress();
    });

    expect(onPlayMedia).toHaveBeenCalledWith({
      kind: 'youtube',
      url: 'https://www.youtube.com/embed/aaaaaaaaaaa',
      label: 'Canción',
    });
  });

  it('el audio de Drive abre el reproductor con la URL de preview', () => {
    const onPlayMedia = jest.fn();
    const tree = renderSheet(onPlayMedia);
    const rows = pressableRows(tree);

    // Vídeo principal, vídeo alternativo, fila de audio, y dentro de esa fila
    // el botón de "abrir fuera": la fila de audio es la tercera pulsable.
    act(() => {
      rows[2].props.onPress();
    });

    expect(onPlayMedia).toHaveBeenCalledWith({
      kind: 'drive',
      url: 'https://drive.google.com/file/d/1234567890abcdef/preview',
      label: 'Pista',
    });
  });
});

describe('reproductor flotante', () => {
  it('el vídeo se carga con la cabecera Referer que exige YouTube', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <Wrap>
          <FloatingMediaPlayer
            source={{
              kind: 'youtube',
              url: 'https://www.youtube.com/embed/aaaaaaaaaaa',
              label: 'Canción',
            }}
            onClose={() => {}}
          />
        </Wrap>,
      );
    });

    const webViews = tree.root.findAllByType('MockWebView' as never);
    expect(webViews).toHaveLength(1);
    expect(webViews[0].props.source).toEqual({
      uri: 'https://www.youtube.com/embed/aaaaaaaaaaa?playsinline=1&autoplay=1&rel=0',
      headers: { Referer: 'https://mcmespana.github.io/' },
    });
  });

  it('el audio de Drive se carga tal cual, sin parámetros de YouTube', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <Wrap>
          <FloatingMediaPlayer
            source={{
              kind: 'drive',
              url: 'https://drive.google.com/file/d/1234567890abcdef/preview',
              label: 'Pista',
            }}
            onClose={() => {}}
          />
        </Wrap>,
      );
    });

    const webViews = tree.root.findAllByType('MockWebView' as never);
    expect(webViews[0].props.source).toEqual({
      uri: 'https://drive.google.com/file/d/1234567890abcdef/preview',
    });
  });

  it('si el embed falla se ofrece abrirlo fuera', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <Wrap>
          <FloatingMediaPlayer
            source={{
              kind: 'drive',
              url: 'https://drive.google.com/file/d/1234567890abcdef/preview',
              label: 'Pista',
            }}
            onClose={() => {}}
          />
        </Wrap>,
      );
    });

    act(() => {
      tree.root.findByType('MockWebView' as never).props.onError();
    });

    // `findAll` también devuelve los nodos host que heredan la prop, así que
    // basta con que exista al menos uno.
    expect(
      tree.root.findAll(
        (node) =>
          typeof node.props?.accessibilityLabel === 'string' &&
          node.props.accessibilityLabel.includes('abrir en Drive'),
      ).length,
    ).toBeGreaterThan(0);
  });
});
