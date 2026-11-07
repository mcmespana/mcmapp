/**
 * Deslizar una fila del cantoral del todo AÑADE (o quita) la canción, sin
 * tener que tocar el botón que destapa.
 *
 * Build de TestFlight de Expo 58: la fila se abría y se quedaba abierta. En
 * gesture-handler 3, `onSwipeableOpen` recibe la dirección hacia la que se
 * movió la fila (`'left'` = destapa las acciones de la DERECHA), y el código
 * seguía comparando con la semántica del `Swipeable` viejo. Ver
 * `utils/swipeSide.ts`.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { render } from '@testing-library/react-native';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { openedActionsSide } from '@/utils/swipeSide';

let mockOnOpen: ((direction: string) => void) | undefined;
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const Local = require('react');
  const { View } = require('react-native');
  const Row = Local.forwardRef(
    (
      props: { children: unknown; onSwipeableOpen?: (d: string) => void },
      _ref: unknown,
    ) => {
      mockOnOpen = props.onSwipeableOpen;
      return Local.createElement(View, null, props.children);
    },
  );
  return { __esModule: true, default: Row, SwipeDirection: {} };
});

import SongListItem from '@/components/SongListItem';

const SONG = {
  title: '1. Alzad las manos',
  filename: 'alzad.cho',
  author: 'Kairoi',
  numericFilenamePart: '1',
} as never;

async function fila(isSelected: boolean) {
  const onAddSong = jest.fn();
  const onRemoveSong = jest.fn();
  await render(
    <SettingsProvider>
      <SongListItem
        song={SONG}
        onPress={jest.fn()}
        isSelected={isSelected}
        selectedTranspose={0}
        onAddSong={onAddSong}
        onRemoveSong={onRemoveSong}
      />
    </SettingsProvider>,
  );
  return { onAddSong, onRemoveSong };
}

it('deslizar a la izquierda una canción que no está en la selección la añade', async () => {
  const { onAddSong, onRemoveSong } = await fila(false);
  mockOnOpen?.('left');
  expect(onAddSong).toHaveBeenCalledWith('alzad.cho');
  expect(onRemoveSong).not.toHaveBeenCalled();
});

it('deslizar a la derecha una canción de la selección la quita', async () => {
  const { onAddSong, onRemoveSong } = await fila(true);
  mockOnOpen?.('right');
  expect(onRemoveSong).toHaveBeenCalledWith('alzad.cho');
  expect(onAddSong).not.toHaveBeenCalled();
});

it('el lado abierto es el contrario a la dirección del dedo', () => {
  expect(openedActionsSide('left')).toBe('right');
  expect(openedActionsSide('right')).toBe('left');
});

it('gesture-handler sigue llamando a onSwipeableOpen con la dirección del movimiento', () => {
  // Si una versión nueva vuelve a pasar el lado abierto, esto se pone rojo y
  // hay que revisar `utils/swipeSide.ts`.
  const src = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'node_modules/react-native-gesture-handler/src/components/ReanimatedSwipeable/ReanimatedSwipeable.tsx',
    ),
    'utf8',
  );
  expect(src).toMatch(
    /onSwipeableOpen,\s*toValue > 0 \? SwipeDirection\.RIGHT : SwipeDirection\.LEFT/,
  );
});
