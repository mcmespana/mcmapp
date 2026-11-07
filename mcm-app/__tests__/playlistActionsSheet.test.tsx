/**
 * Menú "..." del cantoral (`PlaylistActionsBottomSheet`).
 *
 * Cada opción de este menú es "cierra la hoja y abre otra cosa" (un diálogo de
 * código, el escáner, el selector de archivos…), porque iOS no presenta dos
 * modales a la vez. Eso significa que la acción viaja diferida hasta que la
 * hoja está DEL TODO cerrada: si ese eslabón se rompe, el menú entero parece
 * muerto —que es justo lo que pasaba— sin un solo error en consola.
 */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import PlaylistActionsBottomSheet, {
  type PlaylistActionSection,
} from '@/components/playlist/PlaylistActionsBottomSheet';

const INITIAL_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Hoja controlada, como la usa la pantalla: `onClose` baja `visible`. */
function Harness({
  sections,
  onClosed,
}: {
  sections: PlaylistActionSection[];
  onClosed?: () => void;
}) {
  const [visible, setVisible] = React.useState(true);
  return (
    <SafeAreaProvider initialMetrics={INITIAL_METRICS}>
      <PlaylistActionsBottomSheet
        visible={visible}
        sections={sections}
        onClose={() => {
          setVisible(false);
          onClosed?.();
        }}
      />
    </SafeAreaProvider>
  );
}

/** Pulsa la fila que muestra esa etiqueta. */
function pressAction(tree: ReactTestRenderer, label: string) {
  const row = tree.root
    .findAllByType(TouchableOpacity)
    .find((n) =>
      n
        .findAllByType(Text)
        .some((t) => String(t.props.children ?? '').includes(label)),
    );
  if (!row) throw new Error(`No hay fila con la etiqueta "${label}"`);
  act(() => {
    row.props.onPress();
  });
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe('PlaylistActionsBottomSheet', () => {
  it('ejecuta la acción DESPUÉS de cerrar la hoja, no antes', () => {
    const orden: string[] = [];
    const onPress = jest.fn(() => orden.push('accion'));
    const sections: PlaylistActionSection[] = [
      {
        title: 'Archivo',
        actions: [
          {
            id: 'import-file',
            icon: 'file-download',
            label: 'Importar',
            onPress,
          },
        ],
      },
    ];

    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <Harness sections={sections} onClosed={() => orden.push('cierre')} />,
      );
    });

    pressAction(tree, 'Importar');
    // Al pulsar solo se pide el cierre: la acción todavía NO se ha ejecutado
    // (iOS no puede presentar el modal siguiente con este aún montado).
    expect(onPress).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(orden).toEqual(['cierre', 'accion']);
  });

  it('la acción llega aunque el Modal no avise de su desmontaje', () => {
    // En iOS la señal buena es `onDismiss` del Modal; si no llegara, la red de
    // seguridad de `BottomSheet` tiene que ejecutar la acción igualmente. Este
    // test pasa por el mismo camino que la app: pulsar y dejar correr el reloj.
    const onPress = jest.fn();
    const sections: PlaylistActionSection[] = [
      {
        title: 'Nube',
        actions: [
          {
            id: 'download-cloud',
            icon: 'cloud-download',
            label: 'Importar con código',
            onPress,
          },
        ],
      },
    ];

    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<Harness sections={sections} />);
    });

    pressAction(tree, 'Importar con código');
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('una opción deshabilitada ni cierra ni ejecuta', () => {
    const onPress = jest.fn();
    const sections: PlaylistActionSection[] = [
      {
        title: 'Exportar',
        actions: [
          {
            id: 'export-pdf',
            icon: 'picture-as-pdf',
            label: 'PDF',
            onPress,
            disabled: true,
          },
        ],
      },
    ];

    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<Harness sections={sections} />);
    });

    pressAction(tree, 'PDF');
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(onPress).not.toHaveBeenCalled();
  });

  it('las secciones vacías no pintan ni su título', () => {
    const sections: PlaylistActionSection[] = [
      { title: 'Exportar y compartir', actions: [] },
      {
        title: 'Archivo',
        actions: [
          {
            id: 'import-file',
            icon: 'file-download',
            label: 'Importar',
            onPress: () => {},
          },
        ],
      },
    ];

    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<Harness sections={sections} />);
    });

    const textos = tree.root
      .findAllByType(Text)
      .map((t) => t.props.children)
      .flat();
    expect(textos).not.toContain('Exportar y compartir');
    expect(textos).toContain('Archivo');
  });
});
