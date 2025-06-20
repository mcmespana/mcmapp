import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { SelectedSongsProvider, useSelectedSongs } from '../contexts/SelectedSongsContext';

describe('SelectedSongsContext', () => {
  it('adds and removes songs correctly', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SelectedSongsProvider>{children}</SelectedSongsProvider>
    );
    const { result } = renderHook(() => useSelectedSongs(), { wrapper });

    act(() => result.current.addSong('song1.cho'));
    expect(result.current.selectedSongs).toContain('song1.cho');

    act(() => result.current.removeSong('song1.cho'));
    expect(result.current.selectedSongs).not.toContain('song1.cho');
  });
});
