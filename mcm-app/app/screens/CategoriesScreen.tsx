import {
  FlatList,
  Text,
  StyleSheet,
  View,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { NativeStackNavigationProp } from 'expo-router/build/react-navigation/native-stack';
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  useEffect,
} from 'react';
import Animated from 'react-native-reanimated';
import { useTabListScroll } from '@/components/tabs/useTabScroll';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import colors, {
  Colors,
  KeyPillColors,
  SystemGray,
  UIColors,
  themeColors,
} from '@/constants/colors';
import { radii } from '@/constants/uiStyles';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { PressableFeedback } from 'heroui-native';
import { useToast } from '@/contexts/AppToastContext';
import SuggestSongModal from '@/components/SuggestSongModal';
import { filterSongsData } from '@/utils/filterSongsData';
import { extractTrailingEmoji, stripCategoryPrefix } from '@/utils/songUtils';
import { useSelectedSongs } from '@/contexts/SelectedSongsContext';
import { useSongTagIndex } from '@/hooks/useSongTags';
import TagCloudSheet from '@/components/song-tags/TagCloudSheet';
import { tagCategoryId, type ResolvedTag } from '@/utils/songTags';
import { h } from '@/utils/haptics';
import {
  consumePendingCloudPlaylistCode,
  consumePendingChoirCode,
  consumePendingOfflinePlaylist,
  consumePendingChoirImport,
} from '@/utils/pendingCloudPlaylist';
import typography from '@/constants/typography';

const ALL_SONGS_CATEGORY_ID = '__ALL__';
const ALL_SONGS_CATEGORY_NAME = '🔎 Buscar una canción...';
const SELECTED_SONGS_CATEGORY_ID = '__SELECTED_SONGS__';

const isIOS = Platform.OS === 'ios';

export default function CategoriesScreen({
  navigation,
}: {
  navigation: NativeStackNavigationProp<{
    Categories: undefined;
    SongsList: { categoryId: string; categoryName: string };
    SongDetail: { songId: string; songTitle?: string };
    SelectedSongs: { p?: string; c?: string; d?: string } | undefined;
  }>;
}) {
  const scheme = useColorScheme();
  const layout = useResponsiveLayout();
  // Pantalla raíz del tab Cantoral: colapsa la barra flotante al scrollear y
  // reserva su hueco al final de la lista.
  const { listRef, onScroll, contentPaddingBottom } =
    useTabListScroll<FlatList>('cancionero');
  const styles = useMemo(
    () => createStyles(scheme, layout.isWide, layout.contentMaxWidth),
    [scheme, layout.isWide, layout.contentMaxWidth],
  );
  const isDark = scheme === 'dark';
  const { data: songsData, loading } = useFirebaseData<Record<
    string,
    { categoryTitle: string; songs: any[] }
  > | null>('songs', 'songs', filterSongsData);
  const { selectedSongs } = useSelectedSongs();
  // ⚡ Bolt Optimization:
  // Split the useMemo to prevent re-sorting and re-mapping all categories
  // every time `selectedSongs.length` changes (O(N log N) -> O(1) on selection change).
  const { sortedCategories, baseCategoryItems } = useMemo(() => {
    const actualCategories = songsData ? Object.keys(songsData) : [];
    const sortedCats = actualCategories.sort((a, b) => {
      const titleA = songsData?.[a]?.categoryTitle ?? a;
      const titleB = songsData?.[b]?.categoryTitle ?? b;
      return titleA.localeCompare(titleB);
    });

    const mappedCats = sortedCats.map((cat) => ({
      id: cat,
      name: songsData?.[cat]?.categoryTitle ?? cat,
      songCount: songsData?.[cat]?.songs?.length || 0,
    }));

    return { sortedCategories: sortedCats, baseCategoryItems: mappedCats };
  }, [songsData]);

  const displayCategories = useMemo(() => {
    return [
      {
        id: SELECTED_SONGS_CATEGORY_ID,
        name: 'Tu selección',
        songCount: selectedSongs.length,
      },
      ...baseCategoryItems,
    ];
  }, [baseCategoryItems, selectedSongs.length]);

  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();

  // ── Etiquetas ────────────────────────────────────────────────────────────
  // El índice se construye sobre los datos ya descargados; el catálogo de
  // metadatos (`songs/tags`) es opcional. Si NO hay ninguna canción etiquetada
  // el botón del header ni siquiera se pinta: nada de un botón que abre una
  // hoja vacía.
  const tagIndex = useSongTagIndex(songsData);
  const hasTags = tagIndex.tags.length > 0;
  const [showTags, setShowTags] = useState(false);
  // La navegación espera a que la hoja esté DESMONTADA: en iOS es un Modal de
  // verdad y empujar una pantalla con él vivo deja la transición a medias.
  const pendingTagRef = useRef<ResolvedTag | null>(null);

  const handleTagsCloseComplete = useCallback(() => {
    const tag = pendingTagRef.current;
    if (!tag) return;
    pendingTagRef.current = null;
    navigation.navigate('SongsList', {
      categoryId: tagCategoryId([tag.slug]),
      categoryName: tag.label,
    });
  }, [navigation]);

  const handleSuccessSubmit = () => {
    toast.show({ variant: 'success', label: '¡Sugerencia enviada!' });
  };

  // Deep link: si llegamos con algo pendiente de la nube (de /playlist?p=1234,
  // /playlist?coro=<id> o /coro?coro=<id>), saltamos a la pantalla de
  // seleccionadas con ese parámetro para que dispare el autoimport o auto-join.
  useEffect(() => {
    const pendingPlaylist = consumePendingCloudPlaylistCode();
    const pendingChoir = consumePendingChoirCode();
    const pendingOffline = consumePendingOfflinePlaylist();
    const pendingChoirImport = consumePendingChoirImport();

    if (pendingOffline) {
      // setParams no funciona para una nueva pantalla; usamos navigate.
      navigation.navigate('SelectedSongs', { d: pendingOffline } as any);
    } else if (pendingChoirImport) {
      navigation.navigate('SelectedSongs', { coro: pendingChoirImport } as any);
    } else if (pendingPlaylist) {
      navigation.navigate('SelectedSongs', { p: pendingPlaylist } as any);
    } else if (pendingChoir) {
      navigation.navigate('SelectedSongs', { c: pendingChoir } as any);
    }
  }, [navigation]);

  // Header NATIVO: los botones "sugerir" + "buscar" van como bar items del
  // header nativo (headerRight) para que iOS 26 les aplique el efecto
  // liquid-glass del sistema (igual que el back/buscar de dentro de una
  // categoría). Antes vivían en un header inline dentro del scroll, por eso NO
  // tenían ese efecto. El título "Cantoral" lo pone el screenOptions del stack.
  const headerIconColor = isIOS
    ? isDark
      ? UIColors.accentYellow
      : '#3d79b9'
    : '#1a1a1a';
  useLayoutEffect(() => {
    // Título pequeño nativo (centrado, heredado del stack) + los 2 botones
    // separados. "Sugerir" a la IZQUIERDA y "Buscar" a la DERECHA → son dos bar
    // items nativos distintos, así que iOS 26 les da una cápsula liquid-glass a
    // cada uno (separadas), en vez de agruparlos en una sola.
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => setShowForm(true)}
          style={styles.headerNativeButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Sugerir canción"
        >
          <MaterialIcons name="add" size={24} color={headerIconColor} />
        </TouchableOpacity>
      ),
      // "Etiquetas" y "Buscar" van juntos a la derecha porque los dos son
      // "entrar a buscar algo"; el "+" de sugerir se queda solo a la izquierda.
      // El de etiquetas solo existe si hay etiquetas que enseñar.
      headerRight: () => (
        <View style={styles.headerActions}>
          {hasTags && (
            <TouchableOpacity
              onPress={() => {
                h.tap();
                setShowTags(true);
              }}
              style={styles.headerNativeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Ver etiquetas"
            >
              <MaterialIcons name="sell" size={22} color={headerIconColor} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('SongsList', {
                categoryId: ALL_SONGS_CATEGORY_ID,
                categoryName: ALL_SONGS_CATEGORY_NAME,
              })
            }
            style={styles.headerNativeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Buscar canción"
          >
            <MaterialIcons name="search" size={24} color={headerIconColor} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, styles, headerIconColor, hasTags]);

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

  const lastIndex = gridData.length - 1;
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
        : stripCategoryPrefix(cleanText);
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

      // ── Layout móvil ──────────────────────────────────────────────────
      // «Tu selección» va suelta y destacada; las categorías, en UNA lista
      // agrupada con separadores finos, como agrupa iOS sus ajustes. Antes
      // eran 16 tarjetas con su sombra cada una: más alto, más ruido y
      // ninguna jerarquía entre lo tuyo y el catálogo.
      if (isSpecial) {
        const count = item.songCount;
        return (
          <PressableFeedback
            onPress={onPress}
            style={[styles.row, styles.selectionRow]}
            accessibilityRole="button"
            accessibilityLabel={`Tu selección, ${
              count === 0
                ? 'vacía'
                : `${count} ${count === 1 ? 'canción' : 'canciones'}`
            }`}
          >
            <PressableFeedback.Highlight />
            <View style={[styles.rowIcon, styles.selectionIcon]}>
              <Text style={styles.emojiText}>{emoji}</Text>
            </View>
            <View style={styles.selectionContent}>
              <Text style={[styles.rowTitle, styles.selectionTitle]}>
                {displayName}
              </Text>
              <Text style={styles.selectionSubtitle} numberOfLines={1}>
                {count === 0
                  ? 'Vacía · añade canciones desde el cantoral'
                  : `${count} ${count === 1 ? 'canción' : 'canciones'}`}
              </Text>
            </View>
            <MaterialIcons
              name="chevron-right"
              size={20}
              color={themeColors(isDark).link}
            />
          </PressableFeedback>
        );
      }

      // `index` cuenta «Tu selección» (posición 0): la primera categoría es 1.
      const isFirst = index === 1;
      const isLast = index === lastIndex;
      const row = (
        <PressableFeedback
          onPress={onPress}
          style={[
            styles.row,
            styles.groupRow,
            isFirst && styles.groupFirst,
            isLast && styles.groupLast,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${displayName}, ${item.songCount} ${
            item.songCount === 1 ? 'canción' : 'canciones'
          }`}
        >
          <PressableFeedback.Highlight />
          <View style={styles.rowIcon}>
            <Text style={styles.emojiText}>{emoji}</Text>
          </View>
          <View style={[styles.rowContent, !isLast && styles.rowDivider]}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.rowCount}>{item.songCount}</Text>
            <MaterialIcons
              name="chevron-right"
              size={20}
              color={isDark ? SystemGray.dark.gray : SystemGray.light.gray3}
            />
          </View>
        </PressableFeedback>
      );
      if (!isFirst) return row;
      return (
        <View>
          <Text style={styles.groupLabel} accessibilityRole="header">
            Categorías
          </Text>
          {row}
        </View>
      );
    },
    [isDark, navigation, isWideLayout, styles, lastIndex],
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
          color={themeColors(isDark).link}
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
      {/* Old topColorBar removed to clean up inline custom header */}
      <Animated.FlatList
        ref={listRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        data={gridData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: contentPaddingBottom },
        ]}
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

      <TagCloudSheet
        visible={showTags}
        onClose={() => setShowTags(false)}
        tags={tagIndex.tags}
        onSelectTag={(tag) => {
          pendingTagRef.current = tag;
          setShowTags(false);
        }}
        onCloseComplete={handleTagsCloseComplete}
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
      backgroundColor: themeColors(isDark).backgroundSunken,
    },
    // Botones del header NATIVO (sugerir/buscar). Minimal —solo padding, sin
    // fondo— para que iOS 26 los envuelva en su cápsula liquid-glass.
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginRight: Platform.OS === 'web' ? 8 : 0,
    },
    headerNativeButton: {
      padding: 6,
    },
    listContent: {
      paddingHorizontal: isWide ? 24 : 16,
      ...(isWide
        ? {
            maxWidth: contentMaxWidth,
            width: '100%',
            alignSelf: 'center',
          }
        : null),
    },
    // ── Móvil: «Tu selección» suelta + lista agrupada ───────────────────
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors(isDark).background,
      paddingLeft: 14,
    },
    selectionRow: {
      marginTop: 12,
      paddingRight: 12,
      paddingVertical: 12,
      borderRadius: radii.lg,
      backgroundColor: isDark ? KeyPillColors.bgDark : KeyPillColors.bgLight,
      borderWidth: 1,
      borderColor: isDark
        ? KeyPillColors.borderDark
        : KeyPillColors.borderLight,
    },
    selectionIcon: {
      backgroundColor: isDark ? colors.primary : KeyPillColors.borderLight,
    },
    selectionContent: {
      flex: 1,
    },
    selectionTitle: {
      color: themeColors(isDark).link,
      flex: 0,
    },
    selectionSubtitle: {
      ...typography.caption,
      color: themeColors(isDark).textSecondary,
      marginTop: 1,
    },
    groupLabel: {
      ...typography.overline,
      color: themeColors(isDark).textMuted,
      marginTop: 24,
      marginBottom: 8,
      paddingLeft: 14,
    },
    groupRow: {},
    groupFirst: {
      borderTopLeftRadius: radii.lg,
      borderTopRightRadius: radii.lg,
    },
    groupLast: {
      borderBottomLeftRadius: radii.lg,
      borderBottomRightRadius: radii.lg,
    },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: radii.sm,
      backgroundColor: themeColors(isDark).backgroundSunken,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    emojiText: {
      fontSize: 20,
    },
    rowContent: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 52,
      paddingRight: 10,
      gap: 6,
    },
    // El separador empieza DESPUÉS del icono, como en iOS: separa filas, no
    // corta la columna de iconos.
    rowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: themeColors(isDark).separator,
    },
    rowTitle: {
      ...typography.body,
      fontWeight: '600',
      color: themeColors(isDark).text,
      letterSpacing: -0.2,
      flex: 1,
    },
    rowCount: {
      ...typography.subhead,
      color: themeColors(isDark).textMuted,
      fontVariant: ['tabular-nums'],
    },
    // ── iPad: hero + grid ───────────────────────────────────────────────
    sectionLabel: {
      ...typography.overline,
      color: themeColors(isDark).textMuted,
      marginTop: 22,
      marginBottom: 12,
      paddingLeft: 4,
    },
    heroCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? KeyPillColors.bgDark : KeyPillColors.bgLight,
      borderRadius: radii.xl,
      paddingHorizontal: 22,
      paddingVertical: 20,
      marginTop: 18,
      borderWidth: 1,
      borderColor: isDark
        ? KeyPillColors.borderDark
        : KeyPillColors.borderLight,
      gap: 18,
    },
    heroEmojiWrap: {
      width: 56,
      height: 56,
      borderRadius: radii.lg,
      backgroundColor: isDark ? colors.primary : KeyPillColors.borderLight,
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
      ...typography.h2,
      fontWeight: '800',
      letterSpacing: -0.4,
      color: themeColors(isDark).link,
      marginBottom: 4,
    },
    heroSubtitle: {
      ...typography.subhead,
      color: themeColors(isDark).textSecondary,
      lineHeight: 19,
    },
    gridRow: {
      gap: 14,
      marginBottom: 14,
    },
    gridCard: {
      flex: 1,
      backgroundColor: themeColors(isDark).background,
      borderRadius: radii.xl,
      paddingVertical: 22,
      paddingHorizontal: 18,
      minHeight: 140,
      justifyContent: 'flex-start',
      ...gridCardShadow,
    },
    gridCardEmojiWrap: {
      width: 52,
      height: 52,
      borderRadius: radii.lg,
      backgroundColor: isDark
        ? Colors.dark.card
        : themeColors(isDark).backgroundSunken,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 14,
    },
    gridCardEmoji: {
      fontSize: 28,
    },
    gridCardTitle: {
      ...typography.title,
      fontWeight: '700',
      letterSpacing: -0.3,
      color: themeColors(isDark).text,
      lineHeight: 21,
      marginBottom: 4,
    },
    gridCardCount: {
      ...typography.caption,
      fontWeight: '500',
      color: themeColors(isDark).textMuted,
      fontVariant: ['tabular-nums'],
    },
  });
};
