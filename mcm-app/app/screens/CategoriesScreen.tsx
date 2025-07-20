import {
  FlatList,
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useLayoutEffect, useMemo, useState } from 'react';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useColorScheme } from '@/hooks/useColorScheme';
import colors, { Colors } from '@/constants/colors';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { FAB, Snackbar } from 'react-native-paper';
import SuggestSongModal from '@/components/SuggestSongModal';
import { filterSongsData } from '@/utils/filterSongsData';

const ALL_SONGS_CATEGORY_ID = '__ALL__';
const ALL_SONGS_CATEGORY_NAME = '🔎 Buscar una canción...';
const SELECTED_SONGS_CATEGORY_ID = '__SELECTED_SONGS__';
const SELECTED_SONGS_CATEGORY_NAME = '🎵 Tu selección de canciones';

export default function CategoriesScreen({
  navigation,
}: {
  navigation: NativeStackNavigationProp<{
    Categories: undefined;
    SongsList: { categoryId: string; categoryName: string };
    SongDetail: { songId: string; songTitle?: string };
    SelectedSongs: undefined; // Added SelectedSongs for navigation
  }>;
}) {
  const scheme = useColorScheme();
  const styles = useMemo(() => createStyles(scheme), [scheme]);
  const { data: songsData, loading } = useFirebaseData<Record<
    string,
    { categoryTitle: string; songs: any[] }
  > | null>('songs', 'songs', filterSongsData);
  const actualCategories = songsData ? Object.keys(songsData) : [];
  const sortedCategories = actualCategories.sort((a, b) => {
    const titleA = songsData?.[a]?.categoryTitle ?? a;
    const titleB = songsData?.[b]?.categoryTitle ?? b;
    return titleA.localeCompare(titleB);
  });
  const displayCategories = [
    { id: SELECTED_SONGS_CATEGORY_ID, name: SELECTED_SONGS_CATEGORY_NAME },
    ...sortedCategories.map((cat) => ({
      id: cat,
      name: songsData?.[cat]?.categoryTitle ?? cat,
    })),
  ];

  const [showForm, setShowForm] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  const handleSuccessSubmit = () => {
    setShowSuccessToast(true);
  };

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

  if (loading && actualCategories.length === 0) {
    return <ProgressWithMessage message="Cargando canciones..." />;
  }

  return (
    <View style={{ flex: 1 }}>
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
                  categoryName: item.name,
                });
              }
            }}
            style={styles.itemRow}
          >
            <Text
              style={[
                styles.itemText,
                (item.id === ALL_SONGS_CATEGORY_ID ||
                  item.id === SELECTED_SONGS_CATEGORY_ID) &&
                  styles.specialText,
              ]}
            >
              {item.id === ALL_SONGS_CATEGORY_ID ||
              item.id === SELECTED_SONGS_CATEGORY_ID ? (
                item.name
              ) : (
                <>
                  <Text style={{ fontWeight: 'bold' }}>
                    {item.name.substring(0, 2)}
                  </Text>
                  {item.name.substring(2)}
                </>
              )}
            </Text>
          </TouchableOpacity>
        )}
      />
      <FAB icon="plus" style={styles.fab} onPress={() => setShowForm(true)} />

      <SuggestSongModal
        visible={showForm}
        onClose={() => setShowForm(false)}
        availableCategories={sortedCategories}
        songsData={songsData}
        onSuccess={handleSuccessSubmit}
      />

      {/* Toast de éxito */}
      <Snackbar
        visible={showSuccessToast}
        onDismiss={() => setShowSuccessToast(false)}
        duration={3000}
        style={{
          backgroundColor: colors.warning,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
        }}
        action={{
          label: '✨',
          textColor: '#000',
          onPress: () => setShowSuccessToast(false),
        }}
      >
        <Text style={{ color: '#000', fontWeight: 'bold' }}>
          ¡Sugerencia de canción enviada! 📮
        </Text>
      </Snackbar>
    </View>
  );
}

const createStyles = (scheme: 'light' | 'dark' | null) => {
  const isDark = scheme === 'dark';
  return StyleSheet.create({
    itemRow: {
      padding: 20,
      borderBottomWidth: 1,
      borderColor: isDark ? '#444' : '#ddd',
      backgroundColor: isDark
        ? Colors.dark.background
        : Colors.light.background,
    },
    itemText: {
      fontSize: 18,
      color: isDark ? Colors.dark.text : Colors.light.text,
    },
    specialText: {
      color: isDark ? '#BBBBBB' : '#4A4A4A',
    },
    fab: {
      position: 'absolute',
      right: 16,
      bottom: 16,
      backgroundColor: '#f4c11e', // Mismo amarillo que el header
    },
  });
};
