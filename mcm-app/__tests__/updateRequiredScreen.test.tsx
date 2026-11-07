/**
 * `UpdateRequiredScreen`: la pantalla de versión mínima. Lo que importa es la
 * lógica de qué ofrece (estricta vs. con «Ahora no» y el aviso de cuántas
 * veces quedan) y que el CTA abra la tienda; la animación es decorativa.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HeroUINativeProvider } from 'heroui-native';
import UpdateRequiredScreen from '@/components/UpdateRequiredScreen';
import { openAppStore } from '@/utils/storeLinks';

jest.mock('@/utils/storeLinks', () => ({ openAppStore: jest.fn() }));

const base = { currentVersion: '2.1.0', minVersion: '2.5.0' };

const INITIAL_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

// El CTA es un `PressableFeedback` de heroui: sin su provider, su hook de
// animación lee un global que no existe.
const wrap = (ui: React.ReactElement) => (
  <SafeAreaProvider initialMetrics={INITIAL_METRICS}>
    <HeroUINativeProvider>{ui}</HeroUINativeProvider>
  </SafeAreaProvider>
);

beforeEach(() => jest.clearAllMocks());

describe('UpdateRequiredScreen', () => {
  it('el CTA abre la tienda', async () => {
    const screen = await render(
      wrap(
        <UpdateRequiredScreen {...base} skipsLeft={null} onSkip={jest.fn()} />,
      ),
    );
    await fireEvent.press(screen.getByText('Actualizar en la tienda'));
    expect(openAppStore).toHaveBeenCalledTimes(1);
  });

  it('sin límite: ofrece «Ahora no» y no cuenta nada', async () => {
    const onSkip = jest.fn();
    const screen = await render(
      wrap(<UpdateRequiredScreen {...base} skipsLeft={null} onSkip={onSkip} />),
    );
    await fireEvent.press(screen.getByText('Ahora no'));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/veces más/)).toBeNull();
    expect(screen.queryByText(/última vez/)).toBeNull();
  });

  it('con N saltos: dice cuántos quedan; con 1, que es la última', async () => {
    const screen = await render(
      wrap(<UpdateRequiredScreen {...base} skipsLeft={2} onSkip={jest.fn()} />),
    );
    expect(screen.getByText('Puedes dejarlo pasar 2 veces más')).toBeTruthy();
    await screen.rerender(
      wrap(<UpdateRequiredScreen {...base} skipsLeft={1} onSkip={jest.fn()} />),
    );
    expect(
      screen.getByText('Es la última vez que puedes dejarlo pasar'),
    ).toBeTruthy();
  });

  it('estricta (sin onSkip o 0 saltos): no hay botón de saltar y el texto no promete nada', async () => {
    const strict = await render(
      wrap(<UpdateRequiredScreen {...base} skipsLeft={0} onSkip={jest.fn()} />),
    );
    expect(strict.queryByText('Ahora no')).toBeNull();
    expect(strict.getByText(/hace falta la versión nueva/)).toBeTruthy();

    const noHandler = await render(
      wrap(<UpdateRequiredScreen {...base} skipsLeft={null} />),
    );
    expect(noHandler.queryByText('Ahora no')).toBeNull();
  });

  it('enseña las versiones para soporte', async () => {
    const screen = await render(
      wrap(<UpdateRequiredScreen {...base} skipsLeft={null} />),
    );
    expect(screen.getByText('Tienes la 2.1.0 · mínima 2.5.0')).toBeTruthy();
  });
});
