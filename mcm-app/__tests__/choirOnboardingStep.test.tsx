/**
 * Último paso del onboarding del cantoral: «¿Formas parte de un coro?»
 * (`ChoirStep`). Se puede unir a uno que ya existe o registrar el suyo, y
 * ninguna de las dos cosas puede dejar la pantalla rota si falla la red.
 */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HeroUINativeProvider } from 'heroui-native';

import ChoirStep from '@/components/song-onboarding/ChoirStep';
import { sheetPalette } from '@/components/song-sheet/sheetKit';
import { createChoir, listChoirs } from '@/services/choirDirectoryService';

jest.mock('@expo/vector-icons', () => ({ MaterialIcons: () => null }));
jest.mock('@/contexts/ChoirSessionContext', () => ({
  useChoirSession: () => ({ deviceId: 'dev-1' }),
}));
jest.mock('@/contexts/UserProfileContext', () => ({
  useUserProfile: () => ({ profile: { name: ' Lucía ' } }),
}));
const mockSetChoir = jest.fn();
let mockMyChoir: { id: string; name: string } | null = null;
jest.mock('@/hooks/useMyChoir', () => ({
  useMyChoir: () => ({ choir: mockMyChoir, setChoir: mockSetChoir }),
}));
jest.mock('@/services/choirDirectoryService', () => ({
  listChoirs: jest.fn(),
  createChoir: jest.fn(),
}));

const mockList = listChoirs as jest.Mock;
const mockCreate = createChoir as jest.Mock;

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const choir = (id: string, name: string, playlists = 0) => ({
  id,
  v: 1,
  name,
  nameKey: id,
  createdAt: 1,
  updatedAt: 1,
  playlists: Object.fromEntries(
    Array.from({ length: playlists }, (_, i) => [`${i}`, {}]),
  ),
});

async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <HeroUINativeProvider>
          <ChoirStep palette={sheetPalette(false)} isDark={false} />
        </HeroUINativeProvider>
      </SafeAreaProvider>,
    );
  });
  return tree;
}

const texts = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(Text)
    .map((t) => [t.props.children].flat().join(''))
    .filter(Boolean);

const byLabel = (tree: ReactTestRenderer, label: RegExp) =>
  tree.root.find(
    (n) =>
      typeof n.props.onPress === 'function' &&
      typeof n.props.accessibilityLabel === 'string' &&
      label.test(n.props.accessibilityLabel),
  );

async function press(tree: ReactTestRenderer, label: RegExp) {
  await act(async () => {
    byLabel(tree, label).props.onPress();
  });
}

beforeEach(() => {
  // `reset` y no `clear`: tira también las respuestas `Once` sin consumir.
  mockList.mockReset();
  mockCreate.mockReset();
  mockSetChoir.mockReset();
  mockMyChoir = null;
});

describe('ChoirStep', () => {
  it('enseña los coros que hay, con su número de playlists', async () => {
    mockList.mockResolvedValue([
      choir('a-1111', 'Coro A', 1),
      choir('b-2222', 'Coro B', 3),
    ]);
    const tree = await render();
    const t = texts(tree);
    expect(t).toContain('Coro A');
    expect(t).toContain('1 playlist');
    expect(t).toContain('3 playlists');
    expect(t).toContain('Registrar mi coro');
  });

  it('sumarse a uno que ya hay lo guarda como «mi coro»', async () => {
    mockList.mockResolvedValue([choir('b-2222', 'Coro B', 3)]);
    const tree = await render();
    await press(tree, /Coro B/);
    expect(mockSetChoir).toHaveBeenCalledWith({ id: 'b-2222', name: 'Coro B' });
  });

  it('el coro que ya era el tuyo sale marcado y no se vuelve a guardar', async () => {
    mockMyChoir = { id: 'b-2222', name: 'Coro B' };
    mockList.mockResolvedValue([choir('b-2222', 'Coro B', 3)]);
    const tree = await render();
    const row = byLabel(tree, /Coro B/);
    expect(row.props.accessibilityState).toEqual({ selected: true });
    await press(tree, /Coro B/);
    expect(mockSetChoir).not.toHaveBeenCalled();
  });

  it('registrar el suyo: lo crea con quién es, lo guarda y lo añade a la lista', async () => {
    mockList.mockResolvedValue([choir('b-2222', 'Coro B')]);
    mockCreate.mockResolvedValue(choir('a-3333', 'Coro Alfa'));
    const tree = await render();
    await press(tree, /Registrar mi coro/);

    const field = tree.root.find(
      (n) =>
        n.props.accessibilityLabel === 'Nombre de tu coro' &&
        n.props.onChangeText,
    );
    await act(async () => field.props.onChangeText('Coro Alfa'));
    await press(tree, /^Registrar coro$/);

    expect(mockCreate).toHaveBeenCalledWith('Coro Alfa', {
      deviceId: 'dev-1',
      name: 'Lucía',
    });
    expect(mockSetChoir).toHaveBeenCalledWith({
      id: 'a-3333',
      name: 'Coro Alfa',
    });
    const t = texts(tree);
    expect(t).toContain('Coro Alfa');
    // El formulario se cierra y vuelve el botón de registrar.
    expect(t).toContain('Registrar mi coro');
  });

  it('un nombre demasiado corto no deja registrar', async () => {
    mockList.mockResolvedValue([]);
    const tree = await render();
    await press(tree, /Registrar mi coro/);
    const field = tree.root.find(
      (n) =>
        n.props.accessibilityLabel === 'Nombre de tu coro' &&
        n.props.onChangeText,
    );
    await act(async () => field.props.onChangeText('ab'));
    await press(tree, /^Registrar coro$/);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('si ya existe uno igual, lo dice y no guarda nada', async () => {
    mockList.mockResolvedValue([]);
    mockCreate.mockRejectedValue(
      new Error('Ya existe «Coro Alfa». Elígelo en la lista.'),
    );
    const tree = await render();
    await press(tree, /Registrar mi coro/);
    const field = tree.root.find(
      (n) =>
        n.props.accessibilityLabel === 'Nombre de tu coro' &&
        n.props.onChangeText,
    );
    await act(async () => field.props.onChangeText('coro alfa'));
    await press(tree, /^Registrar coro$/);
    expect(texts(tree)).toContain(
      'Ya existe «Coro Alfa». Elígelo en la lista.',
    );
    expect(mockSetChoir).not.toHaveBeenCalled();
  });

  it('sin conexión al registrar: mensaje en castellano', async () => {
    mockList.mockResolvedValue([]);
    mockCreate.mockRejectedValue(new Error('Client is offline'));
    const tree = await render();
    await press(tree, /Registrar mi coro/);
    const field = tree.root.find(
      (n) =>
        n.props.accessibilityLabel === 'Nombre de tu coro' &&
        n.props.onChangeText,
    );
    await act(async () => field.props.onChangeText('Coro Alfa'));
    await press(tree, /^Registrar coro$/);
    expect(texts(tree)).toContain(
      'No se ha podido registrar el coro. ¿Tienes internet?',
    );
  });

  it('sin conexión al cargar la lista: avisa y deja reintentar', async () => {
    mockList.mockRejectedValueOnce(new Error('offline'));
    const tree = await render();
    expect(texts(tree).join(' ')).toMatch(/No se ha podido cargar/);
    mockList.mockResolvedValueOnce([choir('b-2222', 'Coro B')]);
    // El botón es un TouchableOpacity que envuelve el texto «Reintentar».
    let node = tree.root.find(
      (n) => n.type === Text && n.props.children === 'Reintentar',
    ).parent;
    while (node && typeof node.props.onPress !== 'function') node = node.parent;
    await act(async () => {
      node!.props.onPress();
    });
    expect(texts(tree)).toContain('Coro B');
  });

  it('sin ningún coro, anima a registrar el primero', async () => {
    mockList.mockResolvedValue([]);
    const tree = await render();
    expect(texts(tree).join(' ')).toMatch(/Registra el primero/);
  });
});
