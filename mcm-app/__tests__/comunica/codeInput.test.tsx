/**
 * El código del correo llega como «123 456» (con espacio, para leerlo bien).
 * Al pegarlo, el campo tiene que quedarse con las 6 cifras: un `maxLength={6}`
 * en el TextInput recortaba «123 456» a «123 45» ANTES de limpiar el espacio.
 */
/* eslint-disable @typescript-eslint/no-require-imports, import/first */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { TextInput } from 'react-native';

jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));

import CodeInput from '@/components/comunica/acceso/CodeInput';

function mount(onChange = jest.fn(), onComplete = jest.fn()) {
  let r!: ReturnType<typeof create>;
  act(() => {
    r = create(
      <CodeInput value="" onChange={onChange} onComplete={onComplete} />,
    );
  });
  return { input: r.root.findByType(TextInput), onChange, onComplete };
}

describe('CodeInput', () => {
  it('no limita la longitud en el sistema (si no, el espacio pegado se come una cifra)', () => {
    const { input } = mount();
    expect(input.props.maxLength).toBeUndefined();
  });

  it('pegar «123 456» deja 123456 y completa', () => {
    const { input, onChange, onComplete } = mount();
    act(() => input.props.onChangeText('123 456'));
    expect(onChange).toHaveBeenCalledWith('123456');
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('acepta espacios, guiones y saltos de línea, y corta a 6 cifras', () => {
    const { input, onChange } = mount();
    act(() => input.props.onChangeText(' 12-34\n56 78 '));
    expect(onChange).toHaveBeenLastCalledWith('123456');
  });

  it('con menos de 6 cifras no completa', () => {
    const { input, onComplete } = mount();
    act(() => input.props.onChangeText('123 45'));
    expect(onComplete).not.toHaveBeenCalled();
  });
});
