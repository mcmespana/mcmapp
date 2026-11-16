/**
 * La hoja de los intercambios (`components/panuelo/PanueloTradeSheet.tsx`):
 * pinta lo que dice `usePanueloTrade` en cada paso. El hook se sustituye por
 * un valor a mano; la cámara, el QR, el login y la hoja base, por dobles.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { PanueloTradeSheet } from '@/components/panuelo/PanueloTradeSheet';
import {
  groupTradeCode,
  tradeLink,
} from '@/components/panuelo/PanueloTradeCode';
import type { PanueloTradeValue } from '@/hooks/usePanueloTrade';
import type { PanueloUserState } from '@/types/panuelo';
import { EMPTY_PANUELO, sanitizeCatalog } from '@/utils/panuelo';
import type { PanueloTrade } from '@/utils/panueloTrade';

jest.mock('heroui-native', () => {
  const Local = jest.requireActual<typeof React>('react');
  const { Pressable } =
    jest.requireActual<typeof import('react-native')>('react-native');
  const PressableFeedback = Object.assign(
    ({
      isDisabled,
      ...props
    }: React.ComponentProps<typeof Pressable> & { isDisabled?: boolean }) =>
      Local.createElement(Pressable, { ...props, disabled: isDisabled }),
    { Highlight: () => null, Scale: () => null },
  );
  return { PressableFeedback };
});
jest.mock('@/components/ui/icons', () => {
  const Local = jest.requireActual<typeof React>('react');
  return {
    MaterialIcons: (props: Record<string, unknown>) =>
      Local.createElement('MaterialIcons', props),
  };
});
jest.mock('@/components/BottomSheet', () => {
  const Local = jest.requireActual<typeof React>('react');
  return {
    __esModule: true,
    default: (props: {
      visible: boolean;
      title?: string;
      children: React.ReactNode;
    }) =>
      props.visible
        ? Local.createElement(
            'BottomSheet',
            { title: props.title },
            props.children,
          )
        : null,
  };
});
jest.mock('react-native-qrcode-svg', () => {
  const Local = jest.requireActual<typeof React>('react');
  const { View } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: (props: { value: string }) =>
      Local.createElement(View, { testID: 'qr', nativeID: props.value }),
  };
});
jest.mock('@/components/SocialLoginSection', () => {
  const Local = jest.requireActual<typeof React>('react');
  const { Text } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: () => Local.createElement(Text, null, 'Entrar con Google'),
  };
});
jest.mock('@/components/playlist/QrScannerModal', () => ({
  __esModule: true,
  default: () => null,
  isQrScanSupported: () => true,
}));
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));

const NOW = 1_800_000_000_000;
const catalog = sanitizeCatalog({
  roja: { kind: 'pulsera', name: 'Roja', look: { colors: ['#f00'] } },
  azul: { kind: 'pulsera', name: 'Azul', look: { colors: ['#00f'] } },
  verde: { kind: 'pulsera', name: 'Verde', look: { colors: ['#0f0'] } },
});
const owning = (...ids: string[]): PanueloUserState => ({
  ...EMPTY_PANUELO,
  items: Object.fromEntries(
    ids.map((id) => [id, { at: 1, via: 'manual' as const }]),
  ),
});

const open: PanueloTrade = {
  code: 'K7WQ4M',
  status: 'open',
  createdAt: NOW,
  expiresAt: NOW + 600_000,
  offer: { uid: 'ana', name: 'Ana', itemId: 'roja', have: ['verde'] },
};
const proposed: PanueloTrade = {
  ...open,
  status: 'proposed',
  answer: { uid: 'luis', name: 'Luis', itemId: 'azul' },
};

function value(over: Partial<PanueloTradeValue>): PanueloTradeValue {
  return {
    sheetOpen: true,
    phase: 'idle',
    role: null,
    trade: null,
    message: null,
    busy: false,
    offline: false,
    now: NOW,
    received: null,
    prefill: '',
    start: jest.fn(),
    offer: jest.fn(() => Promise.resolve()),
    join: jest.fn(() => Promise.resolve()),
    answer: jest.fn(() => Promise.resolve()),
    accept: jest.fn(() => Promise.resolve()),
    cancel: jest.fn(() => Promise.resolve()),
    close: jest.fn(),
    restart: jest.fn(),
    ...over,
  };
}

async function show(trade: PanueloTradeValue, state = owning('roja')) {
  return render(
    <PanueloTradeSheet
      visible
      isDark={false}
      catalog={catalog}
      state={state}
      trade={trade}
    />,
  );
}

describe('quien ofrece', () => {
  it('elige qué ofrece entre sus intercambiables y enseña el código', async () => {
    const trade = value({ phase: 'choosing' });
    await show(trade, owning('roja', 'azul'));
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    await fireEvent.press(screen.getByLabelText('Azul'));
    await fireEvent.press(screen.getByText('Enseñar el código'));
    expect(trade.offer).toHaveBeenCalledWith('azul');
  });

  it('sin intercambiables: el vacío, y aún puede escribir un código', async () => {
    const trade = value({ phase: 'choosing' });
    await show(trade, EMPTY_PANUELO);
    expect(screen.getByText('No tienes piezas para intercambiar')).toBeTruthy();
    await fireEvent.press(screen.getByText('Tengo un código'));
    expect(trade.start).toHaveBeenCalledWith({ mode: 'join' });
  });

  it('pinta el código en dos grupos, el QR y la cuenta atrás en minutos', async () => {
    await show(
      value({
        phase: 'offering',
        role: 'offer',
        trade: open,
        now: NOW + 61_000,
      }),
    );
    expect(screen.getByText(groupTradeCode('K7WQ4M'))).toBeTruthy();
    expect(screen.getByText('K7W Q4M')).toBeTruthy();
    expect(screen.getByLabelText('Código: K, 7, W, Q, 4, M')).toBeTruthy();
    expect(screen.getByTestId('qr').props.nativeID).toBe(tradeLink('K7WQ4M'));
    expect(screen.getByText('Caduca en 9 min')).toBeTruthy();
    expect(screen.getByText('Esperando a que lo escriba.')).toBeTruthy();
  });

  it('la propuesta con las dos piezas, y aceptar', async () => {
    const trade = value({ phase: 'reviewing', role: 'offer', trade: proposed });
    await show(trade);
    expect(screen.getByText('Luis te da «Azul» por tu «Roja».')).toBeTruthy();
    expect(screen.getByLabelText('Das Roja. Recibes Azul.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Aceptar el cambio'));
    expect(trade.accept).toHaveBeenCalled();
    await fireEvent.press(screen.getByText('No, gracias'));
    expect(trade.cancel).toHaveBeenCalled();
  });

  it('un regalo se dice', async () => {
    await show(
      value({
        phase: 'reviewing',
        role: 'offer',
        trade: { ...proposed, answer: { uid: 'luis', itemId: null } },
      }),
    );
    expect(
      screen.getByText('La otra persona no te da nada: es un regalo.'),
    ).toBeTruthy();
  });

  it('sin red, el botón de aceptar se deshabilita y se avisa', async () => {
    const trade = value({
      phase: 'reviewing',
      role: 'offer',
      trade: proposed,
      offline: true,
    });
    await show(trade);
    expect(
      screen.getByText(
        'Sin conexión. Intercambiar necesita internet en los dos móviles.',
      ),
    ).toBeTruthy();
    await fireEvent.press(screen.getByText('Aceptar el cambio'));
    expect(trade.accept).not.toHaveBeenCalled();
  });

  it('sin sesión enseña cómo entrar', async () => {
    await show(
      value({
        phase: 'signin',
        message:
          'Para intercambiar tenéis que haber entrado los dos con vuestra cuenta.',
      }),
    );
    expect(screen.getByText('Entrar con Google')).toBeTruthy();
    expect(
      screen.getByText(
        'Para intercambiar tenéis que haber entrado los dos con vuestra cuenta.',
      ),
    ).toBeTruthy();
  });
});

describe('quien contesta', () => {
  it('escribe el código (o lo escanea) y lo busca', async () => {
    const trade = value({ phase: 'joining', prefill: 'K7WQ4M' });
    await show(trade);
    expect(screen.getByDisplayValue('K7WQ4M')).toBeTruthy();
    expect(screen.getByLabelText('Escanear el QR con la cámara')).toBeTruthy();
    await fireEvent.press(screen.getByText('Ver qué me ofrece'));
    expect(trade.join).toHaveBeenCalledWith('K7WQ4M');
  });

  it('elige qué da: la que Ana ya tiene, deshabilitada; o un regalo', async () => {
    const trade = value({ phase: 'answering', role: 'answer', trade: open });
    await show(trade, owning('azul', 'verde'));
    expect(screen.getByText('Ana te ofrece «Roja».')).toBeTruthy();
    const verde = screen.getByLabelText('Verde. Ya la tiene');
    expect(verde.props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    // Sin elegir no se puede proponer.
    await fireEvent.press(screen.getByText('Proponer el cambio'));
    expect(trade.answer).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Nada: que sea un regalo'));
    expect(
      screen.getByLabelText('Nada: que sea un regalo').props.accessibilityState,
    ).toMatchObject({ checked: true });
    await fireEvent.press(screen.getByText('Proponer el cambio'));
    expect(trade.answer).toHaveBeenCalledWith(null);
  });

  it('esperando, con la salida de echarse atrás', async () => {
    const trade = value({ phase: 'waiting', role: 'answer', trade: proposed });
    await show(trade, owning('azul'));
    expect(screen.getByText('Esperando a que Ana acepte.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Echarme atrás'));
    expect(trade.cancel).toHaveBeenCalled();
  });

  it('un error con su salida', async () => {
    const trade = value({
      phase: 'error',
      role: 'answer',
      message: 'Ana ha cancelado el intercambio.',
    });
    await show(trade);
    expect(screen.getByText('Ana ha cancelado el intercambio.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Escribir otro código'));
    expect(trade.restart).toHaveBeenCalled();
  });

  it('hecho: la pieza recibida', async () => {
    const trade = value({ phase: 'done', received: 'roja' });
    await show(trade);
    expect(
      screen.getByText('Ya tienes «Roja». Está cosida donde llevabas la otra.'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByText('Ver mi pañuelo'));
    expect(trade.close).toHaveBeenCalled();
  });
});
