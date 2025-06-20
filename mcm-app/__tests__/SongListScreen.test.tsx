import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import SongListScreen from '../app/screens/SongListScreen';

jest.mock('../hooks/useFirebaseData', () => ({
  useFirebaseData: () => ({
    data: {
      Hymns: {
        categoryTitle: 'Hymns',
        songs: [
          { title: 'Song A', filename: 'song_a.cho' },
          { title: 'Song B', filename: 'song_b.cho' },
        ],
      },
    },
    loading: false,
  }),
}));

jest.mock('../hooks/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

describe('SongListScreen', () => {
  const route = { params: { categoryId: 'Hymns', categoryName: 'Hymns' } } as any;
  const navigation = { navigate: jest.fn() } as any;

  it('renders songs from category', () => {
    const { getByText } = render(
      <SongListScreen route={route} navigation={navigation} />
    );
    expect(getByText('Song A')).toBeTruthy();
    expect(getByText('Song B')).toBeTruthy();
  });

  it('filters songs using search bar', () => {
    const { getByPlaceholderText, queryByText } = render(
      <SongListScreen route={route} navigation={navigation} />
    );
    const searchInput = getByPlaceholderText('Escribe el título de una canción o el autor');
    fireEvent.changeText(searchInput, 'Song A');
    expect(queryByText('Song B')).toBeNull();
  });
});
