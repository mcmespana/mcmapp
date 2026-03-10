import {
  FlatList,
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useLayoutEffect, useMemo, useState } from 'react';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { FAB, Snackbar } from 'react-native-paper';
import SuggestSongModal from '@/components/SuggestSongModal';
import { filterSongsData } from '@/utils/filterSongsData';
import GlassFAB from '@/components/ui/GlassFAB.ios';
import { useSelectedSongs } from '@/contexts/SelectedSongsContext';

const ALL_SONGS_CATEGORY_ID = '__ALL__';
const ALL_SONGS_CATEGORY_NAME = '🔎 Buscar una canción...';
const SELECTED_SONGS_CATEGORY_ID = '__SELECTED_SONGS__';
const SELECTED_SONGS_CATEGORY_NAME = '🎵 Tu selección de canciones';

// Category emoji mapping for visual interest
const categoryEmojis: Record<string, string> = {
  adoracion: '🙏',
  entrada: '🚪',
  ofertorio: '🎁',
  comunion: '🍞',
  paz: '🕊️',
  salida: '👋',
  maria: '💐',
  cuaresma: '✝️',
  adviento: '🕯️',
  navidad: '⭐',
  pascua: '🌅',
  pentecostes: '🔥',
  espiritu: '💨',
  alabanza: '🎶',
  meditacion: '🧘',
  varios: '🎵',
};

function getCategoryEmoji(categoryId: string): string {
  const key = categoryId.toLowerCase().replace(/[^a-záéíóúñü]/g, '');
  return categoryEmojis[key] || '🎵';
}

export default function CategoriesScreen({
  navigation,
}: {
  navigation: NativeStackNavigationProp<{
    Categories: undefined;
    SongsList: { categoryId: string; categoryName: string };
    SongDetail: { songId: string; songTitle?: string };
    SelectedSongs: undefined;
  }>;
}) {
  const scheme = useColorScheme();
  const styles = useMemo(() => createStyles(scheme), [scheme]);
  const isDark = scheme === 'dark';
  const { data: songsData, loading } = useFirebaseData<Record<
    string,
    { categoryTitle: string; songs: any[] }
  > | null>('songs', 'songs', filterSongsData);
  const { selectedSongs } = useSelectedSongs();
  const actualCategories = songsData ? Object.keys(songsData) : [];
  const sortedCategories = actualCategories.sort((a, b) => {
    const titleA = songsData?.[a]?.categoryTitle ?? a;
    const titleB = songsData?.[b]?.categoryTitle ?? b;
    return titleA.localeCompare(titleB);
  });

  const totalSongs = songsData
    ? Object.values(songsData).reduce(
        (sum, cat) => sum + (cat.songs?.length || 0),
        0,
      )
    : 0;

  const displayCategories = [
    {
      id: SELECTED_SONGS_CATEGORY_ID,
      name: 'Tu selección',
      songCount: selectedSongs.length,
    },
    ...sortedCategories.map((cat) => ({
      id: cat,
      name: songsData?.[cat]?.categoryTitle ?? cat,
      songCount: songsData?.[cat]?.songs?.length || 0,
    })),
  ];

  const [showForm, setShowForm] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  const handleSuccessSubmit = () => {
    setShowSuccessToast(true);
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => {
        const iconColor =
          Platform.OS === 'ios'
            ? '#1a1a1a'
            : Platform.OS === 'web'
              ? '#1a1a1a'
              : '#fff';
        return (
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('SongsList', {
                categoryId: ALL_SONGS_CATEGORY_ID,
                categoryName: ALL_SONGS_CATEGORY_NAME,
              })
            }
            style={{ padding: 10, marginRight: 8 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons name="search" size={26} color={iconColor} />
          </TouchableOpacity>
        );
      },
    });
  }, [navigation]);

  if (loading && actualCategories.length === 0) {
    return <ProgressWithMessage message="Cargando canciones..." />;
  }

  const renderItem = ({
    item,
    index,
  }: {
    item: (typeof displayCategories)[0];
    index: number;
  }) => {
    const isSpecial = item.id === SELECTED_SONGS_CATEGORY_ID;
    const emoji = isSpecial ? '🎵' : getCategoryEmoji(item.id);
    const categoryLetter = item.name.match(/^[A-Za-zÁ-Úá-ú]/)?.[0] || '';

    return (
      <TouchableOpacity
        activeOpacity={0.7}
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
        style={[
          styles.card,
          isSpecial && styles.cardSpecial,
          index === 0 && { marginTop: 16 },
        ]}
      >
        <View style={[styles.cardEmoji, isSpecial && styles.cardEmojiSpecial]}>
          <Text style={styles.emojiText}>{emoji}</Text>
        </View>
        <View style={styles.cardContent}>
          <Text
            style={[styles.cardTitle, isSpecial && styles.cardTitleSpecial]}
            numberOfLines={1}
          >
            {isSpecial ? item.name : item.name.replace(/^\w\.?\s*/, '')}
            {!isSpecial && categoryLetter ? (
              <Text style={styles.cardTitlePrefix}>
                {' '}
              </Text>
            ) : null}
          </Text>
          <Text style={styles.cardSubtitle}>
            {item.songCount}{' '}
            {item.songCount === 1 ? 'canción' : 'canciones'}
          </Text>
        </View>
        <MaterialIcons
          name="chevron-right"
          size={22}
          color={isDark ? '#555' : '#C7C7CC'}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={displayCategories}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          Platform.OS === 'ios' && { paddingBottom: 100 },
        ]}
        ListHeaderComponent={
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.searchCard}
            onPress={() =>
              navigation.navigate('SongsList', {
                categoryId: ALL_SONGS_CATEGORY_ID,
                categoryName: ALL_SONGS_CATEGORY_NAME,
              })
            }
          >
            <View style={styles.searchIconContainer}>
              <MaterialIcons
                name="search"
                size={22}
                color={isDark ? '#AAAAAA' : '#8E8E93'}
              />
            </View>
            <Text style={styles.searchPlaceholder}>
              Buscar entre {totalSongs} canciones...
            </Text>
          </TouchableOpacity>
        }
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
      />
      {Platform.OS === 'ios' ? (
        <GlassFAB
          icon="add"
          onPress={() => setShowForm(true)}
          tintColor="#f4c11e"
          iconColor="#222"
        />
      ) : (
        <FAB
          icon="plus"
          style={styles.fab}
          color="#222"
          onPress={() => setShowForm(true)}
        />
      )}

      <SuggestSongModal
        visible={showForm}
        onClose={() => setShowForm(false)}
        availableCategories={sortedCategories}
        songsData={songsData}
        onSuccess={handleSuccessSubmit}
      />

      <Snackbar
        visible={showSuccessToast}
        onDismiss={() => setShowSuccessToast(false)}
        duration={3000}
        style={styles.snackbar}
        action={{
          label: 'OK',
          textColor: isDark ? '#fff' : '#000',
          onPress: () => setShowSuccessToast(false),
        }}
      >
        <Text style={{ color: isDark ? '#fff' : '#000', fontWeight: '600' }}>
          ¡Sugerencia enviada!
        </Text>
      </Snackbar>
    </View>
  );
}

const createStyles = (scheme: 'light' | 'dark' | null) => {
  const isDark = scheme === 'dark';
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 24,
    },
    searchCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#2C2C2E' : '#fff',
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginTop: 16,
      marginBottom: 8,
      ...(Platform.OS === 'web'
        ? {
            boxShadow: isDark
              ? '0 1px 3px rgba(0,0,0,0.4)'
              : '0 1px 3px rgba(0,0,0,0.08)',
          }
        : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: isDark ? 0.3 : 0.06,
            shadowRadius: 3,
            elevation: 2,
          }),
    },
    searchIconContainer: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: isDark ? '#3A3A3C' : '#F2F2F7',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    searchPlaceholder: {
      fontSize: 16,
      color: isDark ? '#8E8E93' : '#8E8E93',
      flex: 1,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#2C2C2E' : '#fff',
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 14,
      marginBottom: 8,
      ...(Platform.OS === 'web'
        ? {
            boxShadow: isDark
              ? '0 1px 3px rgba(0,0,0,0.4)'
              : '0 1px 3px rgba(0,0,0,0.06)',
          }
        : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: isDark ? 0.25 : 0.04,
            shadowRadius: 3,
            elevation: 1,
          }),
    },
    cardSpecial: {
      backgroundColor: isDark ? '#1A2744' : '#EEF4FF',
      borderWidth: 1,
      borderColor: isDark ? '#2A3D66' : '#D4E2FF',
    },
    cardEmoji: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: isDark ? '#3A3A3C' : '#F2F2F7',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14,
    },
    cardEmojiSpecial: {
      backgroundColor: isDark ? '#253883' : '#D4E2FF',
    },
    emojiText: {
      fontSize: 20,
    },
    cardContent: {
      flex: 1,
    },
    cardTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: isDark ? '#FFFFFF' : '#1C1C1E',
      letterSpacing: -0.2,
    },
    cardTitlePrefix: {
      fontWeight: '400',
      color: isDark ? '#8E8E93' : '#8E8E93',
    },
    cardTitleSpecial: {
      color: isDark ? '#7AB3FF' : '#253883',
    },
    cardSubtitle: {
      fontSize: 13,
      color: isDark ? '#8E8E93' : '#8E8E93',
      marginTop: 2,
    },
    fab: {
      position: 'absolute',
      right: 16,
      bottom: 16,
      backgroundColor: '#f4c11e',
      borderRadius: 16,
    },
    snackbar: {
      backgroundColor: isDark ? '#3A3A3C' : '#f4c11e',
      borderRadius: 12,
      marginBottom: 8,
      marginHorizontal: 16,
    },
  });
};
