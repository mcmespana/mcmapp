import { FlatList, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useLayoutEffect, useMemo } from 'react';
import songsData from '../../assets/songs.json';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

const ALL_SONGS_CATEGORY_ID = '__ALL__';
const ALL_SONGS_CATEGORY_NAME = '🔎 Buscar una canción...';
const SELECTED_SONGS_CATEGORY_ID = '__SELECTED_SONGS__';
const SELECTED_SONGS_CATEGORY_NAME = '🎵 Tu selección de canciones';

export default function CategoriesScreen({
  navigation
}: {
  navigation: NativeStackNavigationProp<{
    Categories: undefined;
    SongsList: { categoryId: string; categoryName: string };
    SongDetail: { songId: string; songTitle?: string };
    SelectedSongs: undefined; // Added SelectedSongs for navigation
  }>
}) {
  const scheme = useColorScheme();
  const styles = useMemo(() => createStyles(scheme), [scheme]);
  const actualCategories = Object.keys(songsData);
  const displayCategories = [
    { id: SELECTED_SONGS_CATEGORY_ID, name: SELECTED_SONGS_CATEGORY_NAME },
    ...actualCategories.map(cat => ({ id: cat, name: `${cat}` }))
  ];

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('SongsList', {
              categoryId: ALL_SONGS_CATEGORY_ID,
              categoryName: ALL_SONGS_CATEGORY_NAME,
            })
          }
          style={{ paddingHorizontal: 12 }}
        >
          <MaterialIcons name="search" size={26} color="#fff" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  return (
    <FlatList
      data={displayCategories}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() => {
            if (item.id === SELECTED_SONGS_CATEGORY_ID) {
              navigation.navigate('SelectedSongs');
            } else {
              navigation.navigate('SongsList', { 
                categoryId: item.id, 
                categoryName: item.name 
              });
            }
          }}
          style={styles.itemRow}>
          <Text style={[styles.itemText,
            (item.id === ALL_SONGS_CATEGORY_ID || item.id === SELECTED_SONGS_CATEGORY_ID) && styles.specialText
          ]}>
            {item.id === ALL_SONGS_CATEGORY_ID || item.id === SELECTED_SONGS_CATEGORY_ID ? (
              item.name
            ) : (
              <>
                <Text style={{ fontWeight: 'bold' }}>{item.name.substring(0, 2)}</Text>
                {item.name.substring(2)}
              </>
            )}
          </Text>
        </TouchableOpacity>
      )}
    />
  );
}

const createStyles = (scheme: 'light' | 'dark' | null) => {
  const isDark = scheme === 'dark';
  return StyleSheet.create({
    itemRow: {
      padding: 20,
      borderBottomWidth: 1,
      borderColor: isDark ? '#444' : '#ddd',
      backgroundColor: isDark ? Colors.dark.background : Colors.light.background,
    },
    itemText: {
      fontSize: 18,
      color: isDark ? Colors.dark.text : Colors.light.text,
    },
    specialText: {
      color: isDark ? '#BBBBBB' : '#4A4A4A',
    },
  });
};
