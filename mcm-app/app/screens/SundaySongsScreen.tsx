/**
 * «Cantos para el domingo»: la misa que propone la app para una fecha
 * (entrada, salmo, aleluya, ofertorio, santo, comunión y salida), con el
 * tiempo litúrgico bien puesto. Un toque la pasa a «Tu selección» y de ahí al
 * coro. Doc viva: `docs/funcionalidades/CANTOS_DOMINGO.md`.
 *
 * La lógica está en `utils/sundaySongs.ts` y `hooks/useSundaySongs.ts`; aquí
 * solo se pinta. Todo dentro de la lista (el header del cantoral es
 * transparente: lo que va fuera de la lista se pinta bajo la barra de estado).
 */
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { useTabListScroll } from '@/components/tabs/useTabScroll';
import CandidatesSheet from '@/components/song-sunday/CandidatesSheet';
import MomentBlock from '@/components/song-sunday/MomentBlock';
import ListSkeleton from '@/components/ListSkeleton';
import SongListItem from '@/components/SongListItem';
import EmptyState from '@/components/ui/EmptyState';
import AppPrimaryButton from '@/components/ui/AppPrimaryButton';
import { MaterialIcons } from '@/components/ui/icons';
import { themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { useToast } from '@/contexts/AppToastContext';
import { useSelectedSongs } from '@/contexts/SelectedSongsContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useMyChoir } from '@/hooks/useMyChoir';
import { usePlaylistLink } from '@/hooks/usePlaylistLink';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useSundaySongs } from '@/hooks/useSundaySongs';
import { openCantoral } from '@/utils/cantoralNavigation';
import { cantoralHref } from '@/utils/eventRoutes';
import { h } from '@/utils/haptics';
import {
  addDays,
  isIsoDate,
  isoDateLocal,
  longDateEs,
  shortDateEs,
  targetSunday,
} from '@/utils/liturgicalDay';
import { songRouteParams } from '@/utils/songNavList';
import { extractSongMedia } from '@/types/songMedia';
import { massToSelection, type MomentSuggestion } from '@/utils/sundaySongs';

/** Cuánto dura el «Deshacer» al pasar la misa a Tu selección. */
const UNDO_MS = 10_000;
/** Tamaño del punto del color litúrgico. */
const DOT = 12;
/** Área táctil mínima (design.md §1). */
const TOUCH = 44;

type Song = React.ComponentProps<typeof SongListItem>['song'];

export default function SundaySongsScreen() {
  const params = useLocalSearchParams<{ fecha?: string }>();
  const [fecha, setFecha] = useState(() =>
    isIsoDate(params.fecha) ? params.fecha : targetSunday(isoDateLocal()),
  );
  const isDark = useColorScheme() === 'dark';
  const roles = themeColors(isDark);
  const layout = useResponsiveLayout();
  const { toast } = useToast();
  const { listRef, onScroll, contentPaddingBottom } =
    useTabListScroll<Animated.FlatList<MomentSuggestion>>('cancionero');

  const sunday = useSundaySongs(fecha);
  const { day, mass, change, remove, restore, choose } = sunday;
  const {
    selectedSongs,
    replaceAll,
    isSongSelected,
    getSelectedSong,
    addSong,
    removeSong,
  } = useSelectedSongs();
  const { choir } = useMyChoir();
  const { link, setLink } = usePlaylistLink();
  const [choosing, setChoosing] = useState<MomentSuggestion | null>(null);

  const isSelected = isSongSelected;
  const selectedTranspose = useCallback(
    (filename: string) => getSelectedSong(filename)?.transpose ?? 0,
    [getSelectedSong],
  );

  const openSong = useCallback((song: Song) => {
    openCantoral(
      'SongDetail',
      songRouteParams({
        filename: song.filename,
        list: [
          {
            title: song.title,
            filename: song.filename,
            author: song.author,
            key: song.key,
            capo: song.capo,
            media: extractSongMedia(song as never) ?? undefined,
          },
        ],
        currentIndex: 0,
        source: 'category',
      }),
    );
  }, []);

  const chosenCount = useMemo(
    () => mass.filter((m) => m.chosenIndex >= 0).length,
    [mass],
  );

  /** Reemplaza Tu selección con la misa, con 10 s de «Deshacer». */
  const passToSelection = useCallback(() => {
    const songs = massToSelection(mass);
    if (songs.length === 0) return false;
    const prevSongs = selectedSongs;
    const prevLink = link;
    replaceAll(songs);
    setLink(null);
    h.add();
    toast.show({
      label: `Cantos del ${shortDateEs(fecha)} en Tu selección`,
      variant: 'success',
      duration: UNDO_MS,
      actionLabel: 'Deshacer',
      onActionPress: ({ hide }) => {
        replaceAll(prevSongs);
        setLink(prevLink);
        hide();
        toast.show({ label: 'Restaurada tu playlist anterior' });
      },
    });
    return true;
  }, [mass, selectedSongs, link, replaceAll, setLink, toast, fecha]);

  // Se entra casi siempre DESDE Tu selección: `dismissTo` vuelve a ella en vez
  // de apilar otra; si no está debajo (desde Inicio), la pone en su lugar.
  const onPass = useCallback(() => {
    if (passToSelection())
      router.dismissTo(cantoralHref('SelectedSongs') as never);
  }, [passToSelection]);

  const onUploadToChoir = useCallback(() => {
    if (passToSelection())
      router.dismissTo(
        cantoralHref('SelectedSongs', { hoja: 'guardar-coro' }) as never,
      );
  }, [passToSelection]);

  const goTo = useCallback((next: string) => {
    h.select();
    setFecha(next);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: MomentSuggestion }) => (
      <MomentBlock
        suggestion={item}
        isSelected={isSelected}
        selectedTranspose={selectedTranspose}
        onOpenSong={openSong}
        onAddSong={addSong}
        onRemoveSong={removeSong}
        onChange={() => {
          h.select();
          change(item.moment);
        }}
        onChooseOther={() => setChoosing(item)}
        onRemove={() => {
          h.remove();
          remove(item.moment);
        }}
        onRestore={() => restore(item.moment)}
      />
    ),
    [
      isSelected,
      selectedTranspose,
      openSong,
      addSong,
      removeSong,
      change,
      remove,
      restore,
    ],
  );

  const subtitle = [
    day.name,
    day.feastName && day.feastName !== day.name ? day.feastName : null,
    `Ciclo ${day.cycle}`,
  ]
    .filter(Boolean)
    .join(' · ');

  const header = (
    <View style={styles.header}>
      <Text
        style={[typography.h2, { color: roles.text }]}
        accessibilityRole="header"
      >
        {longDateEs(fecha)}
      </Text>
      <View style={styles.subtitleRow}>
        <View
          style={[
            styles.dot,
            { backgroundColor: day.colorHex, borderColor: roles.textMuted },
          ]}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <Text style={[styles.subtitle, { color: roles.textSecondary }]}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.dateNav}>
        <PressableFeedback
          onPress={() => goTo(addDays(fecha, -7))}
          style={styles.navButton}
          accessibilityRole="button"
          accessibilityLabel="Domingo anterior"
        >
          <MaterialIcons name="chevron-left" size={22} color={roles.link} />
          <Text style={[typography.button, { color: roles.link }]}>
            Anterior
          </Text>
        </PressableFeedback>
        <PressableFeedback
          onPress={() => goTo(addDays(fecha, 7))}
          style={styles.navButton}
          accessibilityRole="button"
          accessibilityLabel="Domingo siguiente"
        >
          <Text style={[typography.button, { color: roles.link }]}>
            Siguiente
          </Text>
          <MaterialIcons name="chevron-right" size={22} color={roles.link} />
        </PressableFeedback>
      </View>
    </View>
  );

  const footer = (
    <View style={styles.footer}>
      <AppPrimaryButton
        label="Pasar a Tu selección"
        icon="playlist-add"
        onPress={onPass}
        disabled={chosenCount === 0}
      />
      {choir ? (
        <PressableFeedback
          onPress={() => {
            h.tap();
            onUploadToChoir();
          }}
          isDisabled={chosenCount === 0}
          style={[styles.secondary, { borderColor: roles.link }]}
          accessibilityRole="button"
          accessibilityLabel={`Subir a ${choir.name}`}
        >
          <Text style={[typography.button, { color: roles.link }]}>
            Subir a {choir.name}
          </Text>
        </PressableFeedback>
      ) : null}
      {sunday.customized ? (
        <PressableFeedback
          onPress={() => {
            h.tap();
            sunday.resetAll();
          }}
          style={styles.textButton}
          accessibilityRole="button"
          accessibilityLabel="Volver a la propuesta de la app"
        >
          <Text style={[typography.button, { color: roles.link }]}>
            Volver a la propuesta
          </Text>
        </PressableFeedback>
      ) : null}
    </View>
  );

  if ((sunday.loading && !sunday.hasSongs) || !sunday.ready) {
    return (
      <ListSkeleton
        isDark={isDark}
        label="Preparando los cantos"
        maxWidth={layout.isWide ? layout.contentMaxWidth : undefined}
      />
    );
  }

  if (!sunday.hasSongs) {
    return (
      <View style={[styles.container, styles.centered]}>
        <EmptyState
          icon={sunday.offline ? 'cloud-off' : 'library-music'}
          title={sunday.offline ? 'Sin conexión' : 'No hay canciones'}
          subtitle="Los cantos se proponen con el cantoral. Se descarga la primera vez que hay internet y luego funciona sin conexión."
          actionLabel={sunday.offline ? undefined : 'Reintentar'}
          onAction={sunday.offline ? undefined : () => void sunday.refresh()}
        />
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: roles.backgroundSunken }]}
    >
      <Animated.FlatList
        ref={listRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        data={mass}
        keyExtractor={(m) => m.moment}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          layout.isWide && {
            maxWidth: layout.contentMaxWidth,
            width: '100%',
            alignSelf: 'center',
          },
          { paddingBottom: contentPaddingBottom },
        ]}
      />
      <CandidatesSheet
        suggestion={
          choosing
            ? (mass.find((m) => m.moment === choosing.moment) ?? choosing)
            : null
        }
        onClose={() => setChoosing(null)}
        onPick={(moment, filename) => {
          h.select();
          choose(moment, filename);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center' },
  content: { paddingHorizontal: spacing.md },
  header: { paddingTop: spacing.sm, gap: spacing.xs },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: radii.pillFull,
    borderWidth: 1,
  },
  subtitle: { ...typography.subhead, flex: 1 },
  dateNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: -spacing.sm,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH,
    paddingHorizontal: spacing.sm,
  },
  footer: { marginTop: spacing.lg, gap: spacing.sm },
  secondary: {
    minHeight: TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
  },
  textButton: {
    minHeight: TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
