import { FlatList, Text, StyleSheet, View, Platform } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useLayoutEffect,
  useMemo,
  useState,
  useCallback,
  useEffect,
} from 'react';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { Colors } from '@/constants/colors';
import { radii } from '@/constants/uiStyles';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { PressableFeedback } from 'heroui-native';
import { useToast } from '@/contexts/AppToastContext';
import SuggestSongModal from '@/components/SuggestSongModal';
import { filterSongsData } from '@/utils/filterSongsData';
import { useSelectedSongs } from '@/contexts/SelectedSongsContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  consumePendingCloudPlaylistCode,
  consumePendingChoirCode,
} from '@/utils/pendingCloudPlaylist';

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
    SelectedSongs: { p?: string; c?: string } | undefined;
  }>;
}) {
  const scheme = useColorScheme();
  const layout = useResponsiveLayout();
  const styles = useMemo(
    () => createStyles(scheme, layout.isWide, layout.contentMaxWidth),
    [scheme, layout.isWide, layout.contentMaxWidth],
  );
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();
  const { data: songsData, loading } = useFirebaseData<Record<
    string,
    { categoryTitle: string; songs: any[] }
  > | null>('songs', 'songs', filterSongsData);
  const { selectedSongs } = useSelectedSongs();
  const { sortedCategories, displayCategories } = useMemo(() => {
    const actualCategories = songsData ? Object.keys(songsData) : [];
    const sortedCats = actualCategories.sort((a, b) => {
      const titleA = songsData?.[a]?.categoryTitle ?? a;
      const titleB = songsData?.[b]?.categoryTitle ?? b;
      return titleA.localeCompare(titleB);
    });

    const displayCats = [
      {
        id: SELECTED_SONGS_CATEGORY_ID,
        name: 'Tu selección',
        songCount: selectedSongs.length,
      },
      ...sortedCats.map((cat) => ({
        id: cat,
        name: songsData?.[cat]?.categoryTitle ?? cat,
        songCount: songsData?.[cat]?.songs?.length || 0,
      })),
    ];

    return { sortedCategories: sortedCats, displayCategories: displayCats };
  }, [songsData, selectedSongs.length]);

  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();

  const handleSuccessSubmit = () => {
    toast.show({ variant: 'success', label: '¡Sugerencia enviada!' });
  };

  // Deep link: si llegamos con un código pendiente de la nube
  // (proveniente de /playlist?p=1234 o /coro?c=1234), saltamos a la pantalla de
  // seleccionadas con ese código para que dispare el autoimport o auto-join.
  useEffect(() => {
    const pendingPlaylist = consumePendingCloudPlaylistCode();
    const pendingChoir = consumePendingChoirCode();

    if (pendingPlaylist) {
      // setParams no funciona para una nueva pantalla; usamos navigate.
      navigation.navigate('SelectedSongs', { p: pendingPlaylist } as any);
    } else if (pendingChoir) {
      navigation.navigate('SelectedSongs', { c: pendingChoir } as any);
    }
  }, [navigation]);

  // Header: add on left, search on right
  useLayoutEffect(() => {
    const iconColor = isIOS ? '#f4c11e' : '#1a1a1a';
    navigation.setOptions({
      headerLeft: () => (
        <PressableFeedback
          onPress={() => setShowForm(true)}
          style={styles.headerButton}
          accessibilityLabel="Sugerir canción"
        >
          <PressableFeedback.Highlight />
          <MaterialIcons name="add" size={26} color={iconColor} />
        </PressableFeedback>
      ),
      headerRight: () => (
        <PressableFeedback
          onPress={() =>
            navigation.navigate('SongsList', {
              categoryId: ALL_SONGS_CATEGORY_ID,
              categoryName: ALL_SONGS_CATEGORY_NAME,
            })
          }
          style={styles.headerButton}
          accessibilityLabel="Buscar canción"
        >
          <PressableFeedback.Highlight />
          <MaterialIcons name="search" size={26} color={iconColor} />
        </PressableFeedback>
      ),
    });
  }, [navigation]);

  // En iPad/web amplio rendiriamos la "Tu selección" en una card destacada
  // de ancho completo arriba, y las categorías reales en un grid de 2-3 cols
  // según ancho (3 cols en iPad landscape / desktop, 2 cols en iPad portrait).
  const isWideLayout = layout.isWide;
  const numColumns = layout.gridColumns;
  const gridData = useMemo(() => {
    if (!isWideLayout) return displayCategories;
    // En grid, la primera card ("Tu selección") la rendirizamos a parte
    // como hero/banner, así que la sacamos de los items del grid.
    return displayCategories.slice(1);
  }, [displayCategories, isWideLayout]);

  const renderItem = useCallback(
    ({
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
      const onPress = () => {
        if (item.id === SELECTED_SONGS_CATEGORY_ID) {
          navigation.navigate('SelectedSongs');
        } else {
          navigation.navigate('SongsList', {
            categoryId: item.id,
            categoryName: item.name,
          });
        }
      };

      // ── Layout iPad: tarjeta cuadrada tipo dashboard ────────────────
      if (isWideLayout && !isSpecial) {
        return (
          <PressableFeedback onPress={onPress} style={styles.gridCard}>
            <PressableFeedback.Highlight />
            <View style={styles.gridCardEmojiWrap}>
              <Text style={styles.gridCardEmoji}>{emoji}</Text>
            </View>
            <Text style={styles.gridCardTitle} numberOfLines={2}>
              {displayName}
            </Text>
            <Text style={styles.gridCardCount}>
              {item.songCount} {item.songCount === 1 ? 'canción' : 'canciones'}
            </Text>
          </PressableFeedback>
        );
      }

      // ── Layout móvil: fila tradicional ───────────────────────────────
      return (
        <PressableFeedback
          onPress={onPress}
          style={[
            styles.card,
            isSpecial && styles.cardSpecial,
            index === 0 && { marginTop: 12 },
          ]}
        >
          <PressableFeedback.Highlight />
          <View
            style={[styles.cardEmoji, isSpecial && styles.cardEmojiSpecial]}
          >
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
              color={isDark ? '#8E8E93' : '#C7C7CC'}
            />
          </View>
        </PressableFeedback>
      );
    },
    [isDark, navigation, isWideLayout, styles],
  );

  // ── Hero "Tu selección" para iPad ────────────────────────────────────
  const renderSelectionHero = useCallback(() => {
    if (!isWideLayout) return null;
    const selectionItem = displayCategories[0];
    if (!selectionItem) return null;
    return (
      <PressableFeedback
        onPress={() => navigation.navigate('SelectedSongs')}
        style={styles.heroCard}
      >
        <PressableFeedback.Highlight />
        <View style={styles.heroEmojiWrap}>
          <Text style={styles.heroEmoji}>🎵</Text>
        </View>
        <View style={styles.heroContent}>
          <Text style={styles.heroTitle}>Tu selección</Text>
          <Text style={styles.heroSubtitle}>
            {selectionItem.songCount === 0
              ? 'Añade canciones a tu playlist para tenerlas a mano'
              : `${selectionItem.songCount} ${
                  selectionItem.songCount === 1 ? 'canción' : 'canciones'
                } en tu playlist`}
          </Text>
        </View>
        <MaterialIcons
          name="chevron-right"
          size={24}
          color={isDark ? '#7AB3FF' : '#253883'}
        />
      </PressableFeedback>
    );
  }, [isWideLayout, displayCategories, navigation, isDark, styles]);

  const sectionLabel = useCallback(() => {
    if (!isWideLayout) return null;
    return (
      <Text style={styles.sectionLabel}>
        CATEGORÍAS · {displayCategories.length - 1}
      </Text>
    );
  }, [isWideLayout, displayCategories.length, styles]);

  const listHeader = useMemo(
    () => (
      <View>
        {renderSelectionHero()}
        {sectionLabel()}
      </View>
    ),
    [renderSelectionHero, sectionLabel],
  );

  if (loading && sortedCategories.length === 0) {
    return <ProgressWithMessage message="Cargando canciones..." />;
  }

  return (
    <View style={styles.container}>
      {/* Línea de color amarillo en la parte superior — visible sobre el header glass en iOS */}
      {isIOS && (
        <View
          style={[styles.topColorBar, { height: insets.top > 0 ? 4 : 4 }]}
        />
      )}
      <FlatList
        data={gridData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        contentInsetAdjustmentBehavior="automatic"
        initialNumToRender={10}
        maxToRenderPerBatch={15}
        windowSize={5}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={listHeader}
        numColumns={numColumns}
        columnWrapperStyle={numColumns > 1 ? styles.gridRow : undefined}
        // Cambiar numColumns en runtime requiere remontar la lista.
        key={`cats-${numColumns}`}
      />

      <SuggestSongModal
        visible={showForm}
        onClose={() => setShowForm(false)}
        availableCategories={sortedCategories}
        songsData={songsData}
        onSuccess={handleSuccessSubmit}
      />
    </View>
  );
}

const createStyles = (
  scheme: 'light' | 'dark' | null,
  isWide: boolean,
  contentMaxWidth: number,
) => {
  const isDark = scheme === 'dark';
  const cardShadow =
    Platform.OS === 'web'
      ? ({
          boxShadow: isDark
            ? '0 1px 3px rgba(0,0,0,0.4)'
            : '0 1px 3px rgba(0,0,0,0.06)',
        } as any)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: isDark ? 0.25 : 0.04,
          shadowRadius: 3,
          elevation: 1,
        };
  const gridCardShadow =
    Platform.OS === 'web'
      ? ({
          boxShadow: isDark
            ? '0 2px 10px rgba(0,0,0,0.4)'
            : '0 2px 10px rgba(0,0,0,0.06)',
        } as any)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.3 : 0.06,
          shadowRadius: 8,
          elevation: 2,
        };

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
    },
    headerButton: {
      padding: 8,
      borderRadius: 8,
    },
    listContent: {
      paddingHorizontal: isWide ? 24 : 16,
      paddingBottom: isIOS ? 100 : 80,
      ...(isWide
        ? {
            maxWidth: contentMaxWidth,
            width: '100%',
            alignSelf: 'center',
          }
        : null),
    },
    // ── Móvil: fila tradicional ─────────────────────────────────────────
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#2C2C2E' : '#fff',
      borderRadius: radii.lg,
      paddingHorizontal: 14,
      paddingVertical: 11,
      marginBottom: 8,
      ...cardShadow,
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
      fontSize: 12,
      fontWeight: '600',
      color: isDark ? '#8E8E93' : '#6E6E73',
      backgroundColor: isDark ? '#3A3A3C' : '#F2F2F7',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 10,
      overflow: 'hidden',
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
    // ── iPad: hero + grid ───────────────────────────────────────────────
    sectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.2,
      color: isDark ? '#8E8E93' : '#8E8E93',
      marginTop: 22,
      marginBottom: 12,
      paddingLeft: 4,
    },
    heroCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1A2744' : '#EEF4FF',
      borderRadius: radii.lg + 6,
      paddingHorizontal: 22,
      paddingVertical: 20,
      marginTop: 18,
      borderWidth: 1,
      borderColor: isDark ? '#2A3D66' : '#D4E2FF',
      gap: 18,
    },
    heroEmojiWrap: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: isDark ? '#253883' : '#D4E2FF',
      justifyContent: 'center',
      alignItems: 'center',
    },
    heroEmoji: {
      fontSize: 30,
    },
    heroContent: {
      flex: 1,
    },
    heroTitle: {
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.4,
      color: isDark ? '#7AB3FF' : '#253883',
      marginBottom: 4,
    },
    heroSubtitle: {
      fontSize: 14,
      color: isDark ? '#9CB7E0' : '#5A6B8A',
      lineHeight: 19,
    },
    gridRow: {
      gap: 14,
      marginBottom: 14,
    },
    gridCard: {
      flex: 1,
      backgroundColor: isDark ? '#2C2C2E' : '#fff',
      borderRadius: radii.lg + 4,
      paddingVertical: 22,
      paddingHorizontal: 18,
      minHeight: 140,
      justifyContent: 'flex-start',
      ...gridCardShadow,
    },
    gridCardEmojiWrap: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor: isDark ? Colors.dark.card : '#F7F7FB',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 14,
    },
    gridCardEmoji: {
      fontSize: 28,
    },
    gridCardTitle: {
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: -0.3,
      color: isDark ? '#FFFFFF' : '#1C1C1E',
      lineHeight: 21,
      marginBottom: 4,
    },
    gridCardCount: {
      fontSize: 13,
      fontWeight: '500',
      color: isDark ? '#8E8E93' : '#8A8A8E',
      fontVariant: ['tabular-nums'],
    },
  });
};
