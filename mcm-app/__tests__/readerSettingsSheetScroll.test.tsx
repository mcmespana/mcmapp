/**
 * Guardarraíl del `ReaderSettingsSheet` (Ajustes de lectura de Contigo).
 *
 * El `BottomSheet` compartido recorta lo que sobra (`overflow: hidden`) y tiene
 * un tope de altura: cualquier contenido que crezca más que eso deja de verse
 * Y de poder tocarse. Con la letra al máximo, la vista previa —que se pinta al
 * tamaño elegido— se comía la hoja entera: la barra de tamaño quedaba fuera de
 * pantalla y ya no había forma de volver a bajar la letra.
 *
 * De ahí los dos topes que se comprueban aquí: el contenido entero va en un
 * ScrollView acotado, y la vista previa scrollea por dentro de su propia caja
 * acotada (para que los controles NUNCA se salgan de la vista). Si alguien
 * vuelve a poner un `View` a pelo, esto se pone rojo.
 */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Dimensions, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ReaderSettingsSheet from '@/components/contigo/ReaderSettingsSheet';
import { AppSettingsProvider } from '@/contexts/AppSettingsContext';

// Los iconos cargan su fuente en asíncrono y siguen resolviendo después de que
// Jest desmonte el entorno: ruido puro para lo que se comprueba aquí.
jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: () => null,
}));

const INITIAL_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Una lectura larga de verdad, como el evangelio del día. */
const LONG_PREVIEW =
  'En aquel tiempo empezó Jesús a explicar a sus discípulos que tenía que ir ' +
  'a Jerusalén y padecer allí mucho por parte de los ancianos, sumos ' +
  'sacerdotes y escribas, y que tenía que ser ejecutado y resucitar al tercer día.';

const trees: ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    trees.splice(0).forEach((t) => t.unmount());
  });
});

async function renderSheet() {
  let tree!: ReactTestRenderer;
  // `act` asíncrono: el provider de ajustes carga de AsyncStorage y hace su
  // setState al resolver la promesa; sin esperarlo, React avisa de un update
  // fuera de `act` en mitad de las aserciones.
  await act(async () => {
    tree = create(
      <SafeAreaProvider initialMetrics={INITIAL_METRICS}>
        <AppSettingsProvider>
          <ReaderSettingsSheet
            visible
            onClose={() => {}}
            sectionKey="contigo"
            previewText={LONG_PREVIEW}
          />
        </AppSettingsProvider>
      </SafeAreaProvider>,
    );
  });
  trees.push(tree);
  return tree;
}

/** Alturas máximas declaradas por los ScrollView de la hoja, de fuera a dentro. */
function scrollMaxHeights(tree: ReactTestRenderer): number[] {
  return tree.root
    .findAllByType(ScrollView)
    .map((s) => StyleSheet.flatten(s.props.style)?.maxHeight)
    .filter((h): h is number => typeof h === 'number');
}

describe('ReaderSettingsSheet — el contenido tiene que poder scrollear', () => {
  it('mete el contenido y la vista previa en ScrollView acotados', async () => {
    const tree = await renderSheet();
    const maxHeights = scrollMaxHeights(tree);

    // Dos topes: el del contenido entero y el de la vista previa.
    expect(maxHeights).toHaveLength(2);
    // Ninguno puede pasarse de la pantalla: un tope tan alto como la ventana no
    // acota nada y volvemos al recorte.
    const windowHeight = Dimensions.get('window').height;
    for (const h of maxHeights) {
      expect(h).toBeGreaterThan(0);
      expect(h).toBeLessThan(windowHeight);
    }
    // La vista previa no puede quedarse con toda la altura disponible: los
    // controles de tamaño van debajo y tienen que seguir viéndose.
    const [contentMax, previewMax] = maxHeights;
    expect(previewMax).toBeLessThan(contentMax / 2);
  });

  it('mantiene los controles de tamaño de letra montados', async () => {
    const tree = await renderSheet();
    // Solo nodos host (`type` string): los compuestos repiten las mismas props.
    const byLabel = (label: string) =>
      tree.root.findAll(
        (n) =>
          typeof n.type === 'string' && n.props?.accessibilityLabel === label,
      );
    expect(byLabel('Aumentar tamaño de letra').length).toBeGreaterThan(0);
    expect(byLabel('Reducir tamaño de letra').length).toBeGreaterThan(0);
  });
});
