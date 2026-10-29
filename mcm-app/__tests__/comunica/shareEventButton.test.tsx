/**
 * Plan 08, tarea 8: el botón «Compartir evento» de la cabecera llama a
 * `Share.share` con el mensaje ya escrito; sin enlace no se pinta y si falla,
 * lo dice.
 */
/* eslint-disable import/first */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Share } from 'react-native';
import { HeroUINativeProvider } from 'heroui-native';
import type { ShareableEvent } from '@/utils/comunica/eventShare';

const mockShow = jest.fn();
jest.mock('@expo/vector-icons', () => ({ MaterialIcons: () => null }));
jest.mock('@expo/vector-icons/MaterialIcons', () => () => null);
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('@/contexts/AppToastContext', () => ({
  useToast: () => ({ toast: { show: mockShow } }),
}));
jest.mock('@/services/comunica', () => ({
  comunicaNow: () => new Date('2026-10-28T10:00:00Z'),
}));
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve(true)),
}));

import ShareEventButton from '@/components/comunica/eventos/ShareEventButton';

const EVENT: ShareableEvent = {
  id: 'a1b2c3d4-0000-4000-8000-000000000001',
  name: 'Convivencia COM',
  startDate: '2026-11-14',
  endDate: '2026-11-15',
  place: 'Benicàssim',
  registrationClosesOn: '2026-11-05',
  share: {
    url: 'https://comunica.movimientoconsolacion.com/actividades/?e=convi-com',
    kind: 'public',
  },
};

async function mount(event: ShareableEvent) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <HeroUINativeProvider>
        <ShareEventButton event={event} />
      </HeroUINativeProvider>,
    );
  });
  return tree;
}

const button = (tree: ReactTestRenderer) =>
  tree.root.findAll(
    (n) =>
      n.props.accessibilityLabel === 'Compartir evento' &&
      typeof n.props.onPress === 'function',
  )[0];

describe('ShareEventButton', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockShow.mockClear();
  });

  it('abre la hoja del sistema con el mensaje y el enlace dentro', async () => {
    const spy = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction' });
    const tree = await mount(EVENT);
    await act(async () => button(tree).props.onPress());
    expect(spy).toHaveBeenCalledWith({
      message:
        'Convivencia COM · sáb 14 y dom 15 de noviembre · Benicàssim · Apúntate hasta el 5 de noviembre: https://comunica.movimientoconsolacion.com/actividades/?e=convi-com',
    });
  });

  it('sin enlace no se pinta', async () => {
    const tree = await mount({ ...EVENT, share: null });
    expect(button(tree)).toBeUndefined();
  });

  it('si Share falla: «No se ha podido compartir»', async () => {
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('x'));
    const tree = await mount(EVENT);
    await act(async () => button(tree).props.onPress());
    expect(mockShow).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'No se ha podido compartir' }),
    );
  });
});
