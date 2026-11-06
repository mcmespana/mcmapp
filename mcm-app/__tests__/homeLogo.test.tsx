/**
 * Tests de `components/home/HomeLogo.tsx` — la «M» de la cabecera de Inicio.
 *
 * Es una silueta teñida en ejecución, así que lo que puede fallar sin dar
 * error es el COLOR: que con el modo Carismochito puesto siga en celeste, o que
 * el verde de modo oscuro se use en claro (ilegible sobre blanco).
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HeroUINativeProvider } from 'heroui-native';
import HomeLogo from '@/components/home/HomeLogo';
import colors, { CarismoColors } from '@/constants/colors';

jest.mock('expo-image', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return { Image: (props: object) => <View testID="logo" {...props} /> };
});

function renderLogo(ui: React.ReactElement) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <HeroUINativeProvider>{ui}</HeroUINativeProvider>
    </SafeAreaProvider>,
  );
}

function tintOf(el: { props: { tintColor?: string } }) {
  return el.props.tintColor;
}

describe('HomeLogo', () => {
  it('normal: celeste de marca y sin botón', async () => {
    const onPress = jest.fn();
    const { getByTestId, queryByRole } = await renderLogo(
      <HomeLogo
        carismoActive={false}
        isDark={false}
        onCarismoPress={onPress}
      />,
    );
    expect(tintOf(getByTestId('logo'))).toBe(colors.info);
    expect(queryByRole('button')).toBeNull();
  });

  it('con Carismochito: verde (el de claro en claro, el de oscuro en oscuro)', async () => {
    const light = await renderLogo(
      <HomeLogo carismoActive isDark={false} onCarismoPress={jest.fn()} />,
    );
    expect(tintOf(light.getByTestId('logo'))).toBe(CarismoColors.light);
    await light.unmount();

    const dark = await renderLogo(
      <HomeLogo carismoActive isDark onCarismoPress={jest.fn()} />,
    );
    expect(tintOf(dark.getByTestId('logo'))).toBe(CarismoColors.dark);
  });

  it('con Carismochito es un botón que reabre la explicación', async () => {
    const onPress = jest.fn();
    const { getByRole } = await renderLogo(
      <HomeLogo carismoActive isDark={false} onCarismoPress={onPress} />,
    );
    await fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
