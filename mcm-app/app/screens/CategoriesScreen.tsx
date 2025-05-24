import { FlatList, TouchableOpacity, Text } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import songsData from '../../assets/songs.json';

const ALL_SONGS_CATEGORY_ID = '__ALL__';
const ALL_SONGS_CATEGORY_NAME = 'Todas las canciones';

export default function CategoriesScreen({
  navigation
}: {
  navigation: NativeStackNavigationProp<{
    Categories: undefined;
    SongsList: { categoryId: string; categoryName: string };
    SongDetail: { songId: string; songTitle?: string };
  }>
}) {
  const actualCategories = Object.keys(songsData);
  const displayCategories = [{ id: ALL_SONGS_CATEGORY_ID, name: ALL_SONGS_CATEGORY_NAME }, ...actualCategories.map(cat => ({ id: cat, name: `Categoría ${cat}` }))];

  return (
    <FlatList
      data={displayCategories}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() => navigation.navigate('SongsList', { 
            categoryId: item.id, 
            categoryName: item.name 
          })}
          style={{ padding: 20, borderBottomWidth: 1, borderColor: '#ddd' }}>
          <Text style={{ fontSize: 18 }}>{item.name}</Text>
        </TouchableOpacity>
      )}
    />
  );
}
