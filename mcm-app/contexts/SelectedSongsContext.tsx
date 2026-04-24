import React, { createContext, useState, useContext, ReactNode, useMemo, useCallback } from 'react';

// Define the shape of the context value
interface SelectedSongsContextType {
  selectedSongs: string[];
  addSong: (filename: string) => void;
  removeSong: (filename: string) => void;
  isSongSelected: (filename: string) => boolean;
  clearSelection: () => void;
}

// Create the context with a default undefined value
const SelectedSongsContext = createContext<
  SelectedSongsContextType | undefined
>(undefined);

// Define the props for the provider
interface SelectedSongsProviderProps {
  children: ReactNode;
}

// Create the provider component
export const SelectedSongsProvider: React.FC<SelectedSongsProviderProps> = ({
  children,
}) => {
  const [selectedSongs, setSelectedSongs] = useState<string[]>([]);

  const selectedSongsSet = useMemo(() => new Set(selectedSongs), [selectedSongs]);

  const addSong = useCallback((filename: string) => {
    setSelectedSongs((prevSelectedSongs) => {
      if (!prevSelectedSongs.includes(filename)) {
        return [...prevSelectedSongs, filename];
      }
      return prevSelectedSongs;
    });
  }, []);

  const removeSong = useCallback((filename: string) => {
    setSelectedSongs((prevSelectedSongs) =>
      prevSelectedSongs.filter((song) => song !== filename),
    );
  }, []);

  const isSongSelected = useCallback((filename: string): boolean => {
    return selectedSongsSet.has(filename);
  }, [selectedSongsSet]);

  const clearSelection = useCallback(() => {
    setSelectedSongs([]);
  }, []);

  const contextValue = useMemo(() => ({
    selectedSongs,
    addSong,
    removeSong,
    isSongSelected,
    clearSelection,
  }), [selectedSongs, addSong, removeSong, isSongSelected, clearSelection]);

  return (
    <SelectedSongsContext.Provider value={contextValue}>
      {children}
    </SelectedSongsContext.Provider>
  );
};

// Custom hook to use the SelectedSongsContext
export const useSelectedSongs = (): SelectedSongsContextType => {
  const context = useContext(SelectedSongsContext);
  if (context === undefined) {
    throw new Error(
      'useSelectedSongs must be used within a SelectedSongsProvider',
    );
  }
  return context;
};
