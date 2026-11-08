import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { makeMutable } from 'react-native-reanimated';
import SongSwipePeek from '@/components/SongSwipePeek';

it('pinta a qué canción se iría, sin ser tocable', async () => {
  await render(
    <SongSwipePeek
      side="next"
      title="Alzad las manos"
      slide={makeMutable(-90)}
      enabled={makeMutable(1)}
      armAt={80}
      isDark={false}
    />,
  );
  expect(
    screen.getByText('Siguiente', { includeHiddenElements: true }),
  ).toBeTruthy();
  expect(
    screen.getByText('Alzad las manos', { includeHiddenElements: true }),
  ).toBeTruthy();
});
