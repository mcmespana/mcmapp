import { useEffect, useState } from 'react';
import { FlatList, TouchableOpacity, Text } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import songsData from '../../assets/songs.json';

export default function CategoriesScreen({
  navigation
}: {
  navigation: NativeStackNavigationProp<{
    Categories: undefined;
    SongsList: { category: string };
    SongDetail: { songId: string };
  }>
}) {
  const categories = Object.keys(songsData);

  return (
    <FlatList
      data={categories}
      keyExtractor={(item) => item}
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() => navigation.navigate('SongsList', { category: item })}
          style={{ padding: 20, borderBottomWidth: 1, borderColor: '#ddd' }}>
          <Text style={{ fontSize: 18 }}>{`Categoría ${item}`}</Text>
        </TouchableOpacity>
      )}
    />
  );
}
