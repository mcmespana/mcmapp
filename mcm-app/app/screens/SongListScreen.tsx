import { useState } from 'react';
import { FlatList, TouchableOpacity, Text, View } from 'react-native';
import songsData from '../../assets/songs.json';
import SongSearch from '../../components/SongSearch';

type Category = 'A' | 'C' | 'D';

export default function SongsListScreen({ route, navigation }: {
  route: { params: { category: Category } },
  navigation: any
}) {
  const { category } = route.params;
  const [search, setSearch] = useState('');

  const songs = songsData[category].filter(song =>
    song.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={{ flex: 1 }}>
      <SongSearch searchText={search} setSearchText={setSearch} />
      <FlatList
        data={songs}
        keyExtractor={(item) => item.filename}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate('SongDetail', item)}
            style={{ padding: 20, borderBottomWidth: 1, borderColor: '#ddd' }}>
            <Text style={{ fontSize: 18 }}>{item.title}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
