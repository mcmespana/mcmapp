import { TextInput } from 'react-native';

interface SongSearchProps {
  searchText: string;
  setSearchText: (text: string) => void;
}

export default function SongSearch({ searchText, setSearchText }: SongSearchProps) {
  return (
    <TextInput
      placeholder="Buscar canción"
      value={searchText}
      onChangeText={setSearchText}
      style={{ padding: 10, margin: 10, borderWidth: 1, borderColor: '#ddd', borderRadius: 5 }}
    />
  );
}
