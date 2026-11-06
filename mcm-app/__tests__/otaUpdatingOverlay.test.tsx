/**
 * `OTAUpdatingOverlay`: la pantalla de «un momentín». Lo que importa es la
 * salida: no hay botón de «cerrar y hacer más tarde» hasta `LATER_AFTER_MS`
 * (la recarga suele ir en un par de segundos) y, pasado ese rato, tanto el
 * botón como «atrás» de Android lo cierran. La animación es decorativa.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import OTAUpdatingOverlay, {
  LATER_AFTER_MS,
} from '@/components/OTAUpdatingOverlay';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const advance = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });

describe('OTAUpdatingOverlay', () => {
  it('enseña el «un momentín» con una frase', async () => {
    const screen = await render(
      <OTAUpdatingOverlay visible onDismiss={jest.fn()} />,
    );
    expect(screen.getByText('Un momentín…')).toBeTruthy();
  });

  it('antes de los 5 s el botón no se puede tocar', async () => {
    const onDismiss = jest.fn();
    const screen = await render(
      <OTAUpdatingOverlay visible onDismiss={onDismiss} />,
    );
    await advance(LATER_AFTER_MS - 100);

    await fireEvent.press(
      screen.getByText('Cerrar y hacer más tarde', {
        includeHiddenElements: true,
      }),
    );
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('pasados los 5 s, el botón cierra la pantalla', async () => {
    const onDismiss = jest.fn();
    const screen = await render(
      <OTAUpdatingOverlay visible onDismiss={onDismiss} />,
    );
    await advance(LATER_AFTER_MS + 100);

    await fireEvent.press(
      screen.getByText('Cerrar y hacer más tarde', {
        includeHiddenElements: true,
      }),
    );
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('«atrás» de Android solo cierra pasados los 5 s', async () => {
    const onDismiss = jest.fn();
    const screen = await render(
      <OTAUpdatingOverlay visible onDismiss={onDismiss} />,
    );
    const modal = screen.getByTestId('ota-updating-overlay', {
      includeHiddenElements: true,
    });

    await act(async () => modal.props.onRequestClose());
    expect(onDismiss).not.toHaveBeenCalled();

    await advance(LATER_AFTER_MS + 100);
    await act(async () => modal.props.onRequestClose());
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('al volver a aparecer, el contador de 5 s empieza de nuevo', async () => {
    const onDismiss = jest.fn();
    const screen = await render(
      <OTAUpdatingOverlay visible onDismiss={onDismiss} />,
    );
    await advance(LATER_AFTER_MS + 100);
    await screen.rerender(
      <OTAUpdatingOverlay visible={false} onDismiss={onDismiss} />,
    );
    await screen.rerender(<OTAUpdatingOverlay visible onDismiss={onDismiss} />);
    await advance(1000);

    await fireEvent.press(
      screen.getByText('Cerrar y hacer más tarde', {
        includeHiddenElements: true,
      }),
    );
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
