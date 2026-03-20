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
import { radii } from '@/constants/uiStyles';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Snackbar } from 'react-native-paper';
import SuggestSongModal from '@/components/SuggestSongModal';
import { filterSongsData } from '@/utils/filterSongsData';
import { useSelectedSongs } from '@/contexts/SelectedSongsContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ALL_SONGS_CATEGORY_ID = '__ALL__';
const ALL_SONGS_CATEGORY_NAME = '🔎 Buscar una canción...';
const SELECTED_SONGS_CATEGORY_ID = '__SELECTED_SONGS__';

const EMOJI_REGEX =
  /[\p{Emoji_Presentation}\p{Extended_Pictographic}][\u{FE0F}\u{200D}\p{Emoji_Presentation}\p{Extended_Pictographic}]*$/u;

function extractTrailingEmoji(text: string): {
  emoji: string;
  cleanText: string;
} {
  const trimmed = text.trim();
  const match = trimmed.match(EMOJI_REGEX);
  if (match) {
    return {
      emoji: match[0],
      cleanText: trimmed.slice(0, match.index).trim(),
    };
  }
  return { emoji: '🎵', cleanText: trimmed };
}

const isIOS = Platform.OS === 'ios';

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
  const insets = useSafeAreaInsets();
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

  // Header: search + add buttons together (integrado en el header)
  useLayoutEffect(() => {
    const iconColor = isIOS
      ? '#f4c11e'
      : Platform.OS === 'web'
        ? '#1a1a1a'
        : '#1a1a1a';
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerButtons}>
          <TouchableOpacity
            onPress={() => setShowForm(true)}
            style={styles.headerButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Sugerir canción"
          >
            <MaterialIcons name="add" size={26} color={iconColor} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('SongsList', {
                categoryId: ALL_SONGS_CATEGORY_ID,
                categoryName: ALL_SONGS_CATEGORY_NAME,
              })
            }
            style={styles.headerButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Buscar canción"
          >
            <MaterialIcons name="search" size={26} color={iconColor} />
          </TouchableOpacity>
        </View>
      ),
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
    const { emoji, cleanText } = isSpecial
      ? { emoji: '🎵', cleanText: item.name }
      : extractTrailingEmoji(item.name);
    const displayName = isSpecial
      ? cleanText
      : cleanText.replace(/^\w\.?\s*/, '');

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
          index === 0 && { marginTop: 12 },
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
            {displayName}
          </Text>
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.countBadge}>{item.songCount}</Text>
          <MaterialIcons
            name="chevron-right"
            size={20}
            color={isDark ? '#555' : '#C7C7CC'}
          />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Línea de color amarillo en la parte superior — visible sobre el header glass en iOS */}
      {isIOS && (
        <View
          style={[styles.topColorBar, { height: insets.top > 0 ? 4 : 4 }]}
        />
      )}
      <FlatList
        data={displayCategories}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        contentInsetAdjustmentBehavior="automatic"
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
      />

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
    headerButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginRight: Platform.OS === 'web' ? 8 : 0,
    },
    headerButton: {
      padding: 8,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: isIOS ? 100 : 80,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#2C2C2E' : '#fff',
      borderRadius: radii.lg,
      paddingHorizontal: 14,
      paddingVertical: 11,
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
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: isDark ? Colors.dark.card : '#F2F2F7',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
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
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#FFFFFF' : '#1C1C1E',
      letterSpacing: -0.2,
    },
    cardTitleSpecial: {
      color: isDark ? '#7AB3FF' : '#253883',
    },
    cardRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    countBadge: {
      fontSize: 14,
      fontWeight: '500',
      color: isDark ? '#636366' : '#AEAEB2',
      fontVariant: ['tabular-nums'],
    },
    topColorBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 4,
      backgroundColor: '#f4c11e',
      zIndex: 1000,
    },
    snackbar: {
      borderRadius: radii.md,
      marginBottom: isIOS ? 90 : 8,
      backgroundColor: isDark ? Colors.dark.card : '#1C1C1E',
      marginHorizontal: 16,
    },
  });
};
