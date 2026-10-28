/**
 * Las piezas de formulario del área (plan 09, tarea 3): cada una con su
 * etiqueta para el lector, su papel (radio, casilla, botón) y 44 pt de toque.
 */
/* eslint-disable react/display-name, @typescript-eslint/no-require-imports, import/first */
import React, { useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Platform, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HeroUINativeProvider } from 'heroui-native';

jest.mock('@expo/vector-icons', () => {
  const stub = () => null;
  return { MaterialIcons: stub, Ionicons: stub };
});
jest.mock('@expo/vector-icons/MaterialIcons', () => () => null);
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
// La hoja: pinta su título y su contenido solo mientras está abierta.
jest.mock('@/components/BottomSheet', () => {
  const { Text: T, View: V } = require('react-native');
  return ({
    visible,
    title,
    children,
  }: {
    visible: boolean;
    title: string;
    children: React.ReactNode;
  }) =>
    visible ? (
      <V testID="sheet">
        <T>{title}</T>
        {children}
      </V>
    ) : null;
});

import FormSection, {
  FormNote,
} from '@/components/comunica/comun/form/FormSection';
import { TextFormField } from '@/components/comunica/comun/form/FormField';
import SelectField, {
  UNSET_LABEL,
} from '@/components/comunica/comun/form/SelectField';
import SwitchField from '@/components/comunica/comun/form/SwitchField';
import CheckListField from '@/components/comunica/comun/form/CheckListField';
import OptionCards from '@/components/comunica/comun/form/OptionCards';
import FileField, {
  FILE_HINT_EMPTY,
  FILE_HINT_REPLACE,
  PAPER_HINT,
} from '@/components/comunica/comun/form/FileField';
import LockedRow from '@/components/comunica/comun/form/LockedRow';

const METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function mount(node: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <HeroUINativeProvider>{node}</HeroUINativeProvider>
      </SafeAreaProvider>,
    );
  });
  return tree;
}

const texts = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(Text)
    .map((t) => [t.props.children].flat().join(''))
    .join(' | ');

/** Lo que se toca con esa etiqueta (lo más externo, con su estilo). */
const touchable = (tree: ReactTestRenderer, label: string) => {
  const b = tree.root
    .findAll(
      (n) =>
        typeof n.props.onPress === 'function' &&
        n.props.accessibilityLabel === label,
    )
    .at(0);
  if (!b) throw new Error(`No hay nada que tocar con «${label}»`);
  return b;
};
const height = (node: { props: { style?: unknown } }) => {
  const s = StyleSheet.flatten(node.props.style as never) as {
    minHeight?: number;
    height?: number;
  };
  return s?.minHeight ?? s?.height ?? 0;
};
const press = (tree: ReactTestRenderer, label: string) =>
  act(() => {
    touchable(tree, label).props.onPress();
  });

describe('FormSection y FormNote', () => {
  it('título de sección, una superficie y la nota como fila', () => {
    const tree = mount(
      <FormSection title="Voluntariado" footer="Pie de la sección">
        <FormNote icon="clock">
          Acuerdo de voluntariado: en tramitación.
        </FormNote>
      </FormSection>,
    );
    expect(texts(tree)).toContain('Voluntariado');
    expect(texts(tree)).toContain('Acuerdo de voluntariado');
    expect(texts(tree)).toContain('Pie de la sección');
    const header = tree.root.findAll(
      (n) => n.props.accessibilityRole === 'header',
    );
    expect(header.length).toBeGreaterThan(0);
  });
});

describe('TextFormField', () => {
  it('lleva etiqueta, ⓘ con su hoja y el error en vez de la pista', () => {
    const tree = mount(
      <TextFormField
        label="Monitor/a desde…"
        help="Año (aproximado) en el que empezaste."
        hint="AAAA"
        error="Escribe el año con cuatro cifras (AAAA)."
        value="19"
        onChangeText={() => {}}
      />,
    );
    const input = tree.root.find(
      (n) =>
        n.props.accessibilityLabel === 'Monitor/a desde…' &&
        n.props.onChangeText,
    );
    expect(input.props.value).toBe('19');
    expect(texts(tree)).toContain('Escribe el año con cuatro cifras');
    expect(texts(tree)).not.toContain('AAAA |');
    const info = touchable(tree, 'Qué es «Monitor/a desde…»');
    expect(height(info)).toBeGreaterThanOrEqual(44);
    press(tree, 'Qué es «Monitor/a desde…»');
    expect(texts(tree)).toContain('Año (aproximado) en el que empezaste.');
  });
});

describe('SelectField', () => {
  function Harness() {
    const [v, setV] = useState<'no' | 'yes' | null>('no');
    return (
      <SelectField
        label="MAT"
        value={v}
        options={[
          { value: 'no', label: 'No' },
          { value: 'yes', label: 'Titulado' },
        ]}
        onChange={setV}
      />
    );
  }
  it('enseña el valor, abre las opciones con «Sin indicar» y vuelve a null', () => {
    const tree = mount(<Harness />);
    const row = touchable(tree, 'MAT: No');
    expect(height(row)).toBeGreaterThanOrEqual(44);
    press(tree, 'MAT: No');
    const radios = tree.root.findAll(
      (n) =>
        n.props.accessibilityRole === 'radio' &&
        typeof n.props.onPress === 'function',
      { deep: false },
    );
    expect(radios.map((r) => r.props.accessibilityLabel)).toEqual([
      UNSET_LABEL,
      'No',
      'Titulado',
    ]);
    expect(
      radios.find((r) => r.props.accessibilityLabel === 'No')!.props
        .accessibilityState,
    ).toEqual({ checked: true });
    for (const r of radios) expect(height(r)).toBeGreaterThanOrEqual(44);
    act(() => radios[0].props.onPress());
    expect(touchable(tree, `MAT: ${UNSET_LABEL}`)).toBeTruthy();
  });
});

describe('SwitchField', () => {
  it('null se pinta apagado y tocar manda true', () => {
    const onChange = jest.fn();
    const tree = mount(
      <SwitchField
        label="Manipulación de alimentos"
        value={null}
        onChange={onChange}
      />,
    );
    const sw = tree.root.find(
      (n) =>
        n.props.accessibilityLabel === 'Manipulación de alimentos' &&
        typeof n.props.onValueChange === 'function',
    );
    expect(sw.props.value).toBe(false);
    act(() => sw.props.onValueChange(true));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('CheckListField', () => {
  it('una casilla por opción, con su estado y 44 pt', () => {
    const onChange = jest.fn();
    const tree = mount(
      <CheckListField
        label="Congresos M+C"
        options={[
          { value: 'a', label: '2019 - Monteverde' },
          { value: 'b', label: '2022 - Puerto Alto' },
        ]}
        value={['a', 'z']}
        onChange={onChange}
      />,
    );
    const boxes = tree.root.findAll(
      (n) =>
        n.props.accessibilityRole === 'checkbox' &&
        typeof n.props.onPress === 'function',
      { deep: false },
    );
    expect(boxes.map((b) => b.props.accessibilityState)).toEqual([
      { checked: true },
      { checked: false },
    ]);
    for (const b of boxes) expect(height(b)).toBeGreaterThanOrEqual(44);
    act(() => boxes[1].props.onPress());
    // La clave que el servidor ya no ofrece («z») no se pierde.
    expect(onChange).toHaveBeenCalledWith(['a', 'z', 'b']);
    act(() => boxes[0].props.onPress());
    expect(onChange).toHaveBeenLastCalledWith(['z']);
  });
});

describe('OptionCards', () => {
  it('radios con título y descripción en la etiqueta', () => {
    const onChange = jest.fn();
    const tree = mount(
      <OptionCards
        label="Cómo presentas el certificado"
        value={null}
        onChange={onChange}
        options={[
          { value: 'automatic', title: 'Automático', description: 'Uno.' },
          { value: 'manual', title: 'Manual', description: 'Dos.' },
        ]}
      />,
    );
    expect(
      tree.root.findAll((n) => n.props.accessibilityRole === 'radiogroup')
        .length,
    ).toBeGreaterThan(0);
    const manual = touchable(tree, 'Manual. Dos.');
    expect(manual.props.accessibilityState).toEqual({ checked: false });
    expect(height(manual)).toBeGreaterThanOrEqual(44);
    act(() => manual.props.onPress());
    expect(onChange).toHaveBeenCalledWith('manual');
  });
});

describe('LockedRow', () => {
  it('es un dato con su enlace, no un control apagado', () => {
    const onPress = jest.fn();
    const tree = mount(
      <LockedRow
        value="Ya subido"
        action={{ label: 'Revisarlo en Documentos →', onPress }}
      />,
    );
    expect(
      tree.root.findAll(
        (n) => n.props.accessibilityLabel === 'Ya subido' && n.props.onPress,
      ),
    ).toEqual([]);
    const link = touchable(tree, 'Revisarlo en Documentos →');
    expect(link.props.accessibilityRole).toBe('link');
    expect(height(link)).toBeGreaterThanOrEqual(44);
  });
});

describe('FileField', () => {
  it('sin archivo: la pista del plugin y la hoja con las tres fuentes', () => {
    const onChoose = jest.fn();
    const tree = mount(
      <FileField label="Título MAT" hasFile={false} onChoose={onChoose} />,
    );
    expect(texts(tree)).toContain(FILE_HINT_EMPTY);
    expect(texts(tree)).not.toContain('Ya subido');
    const button = touchable(tree, 'Elegir: Título MAT');
    expect(height(button)).toBeGreaterThanOrEqual(44);
    press(tree, 'Elegir: Título MAT');
    expect(texts(tree)).toContain('Hacer una foto');
    expect(texts(tree)).toContain('Elegir de la galería');
    press(tree, 'Elegir un archivo');
    expect(onChoose).toHaveBeenCalledWith('file');
  });

  it('con archivo: «Ya subido», enlace a Documentos y pista de sustituir', () => {
    const tree = mount(
      <FileField
        label="Título DAT"
        hasFile
        onChoose={() => {}}
        onReview={() => {}}
      />,
    );
    expect(texts(tree)).toContain('Ya subido');
    expect(texts(tree)).toContain(FILE_HINT_REPLACE);
    expect(touchable(tree, 'Revisarlo en Documentos →')).toBeTruthy();
    expect(touchable(tree, 'Sustituir: Título DAT')).toBeTruthy();
  });

  it('subiendo o fallida, con su estado y el motivo; el problema, como error', () => {
    const onRetry = jest.fn();
    const tree = mount(
      <FileField
        label="Título MAT"
        hasFile={false}
        problem="Ese archivo pesa más de 6 MB."
        upload={{
          name: 'mat.pdf',
          sizeText: '1 MB',
          state: 'failed',
          message: 'Sin conexión.',
        }}
        onChoose={() => {}}
        onRetry={onRetry}
      />,
    );
    expect(texts(tree)).toContain('mat.pdf');
    expect(texts(tree)).toContain('No se ha podido subir');
    expect(texts(tree)).toContain('Sin conexión.');
    expect(texts(tree)).toContain('Ese archivo pesa más de 6 MB.');
    press(tree, 'Reintentar');
    expect(onRetry).toHaveBeenCalled();
  });

  it('en iOS, la pista de escanear el papel', () => {
    const os = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    try {
      const tree = mount(
        <FileField label="Título MAT" hasFile={false} onChoose={() => {}} />,
      );
      expect(texts(tree)).toContain(PAPER_HINT);
    } finally {
      Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
    }
  });
});
