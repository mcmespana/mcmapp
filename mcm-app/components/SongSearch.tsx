import { SearchField } from 'heroui-native';

interface SongSearchProps {
  searchText: string;
  setSearchText: (text: string) => void;
}

export default function SongSearch({
  searchText,
  setSearchText,
}: SongSearchProps) {
  return (
    <SearchField value={searchText} onChange={setSearchText}>
      <SearchField.Group>
        <SearchField.SearchIcon />
        <SearchField.Input placeholder="Escribe aquí para buscar...." />
        <SearchField.ClearButton />
      </SearchField.Group>
    </SearchField>
  );
}
