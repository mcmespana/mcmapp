import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextInputInstance,
  type ViewInstance,
} from 'react-native';
import { Dialog, PressableFeedback, SearchField } from 'heroui-native';
import { MaterialIcons } from '@/components/ui/icons';
import { router } from 'expo-router';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { useEscapeToClose } from '@/hooks/useEscapeToClose';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import EmptyState from '@/components/ui/EmptyState';
import { Colors, StateColors, themeColors } from '@/constants/colors';
import { radii } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { filterSongsData, type SongsData } from '@/utils/filterSongsData';
import {
  MIN_SONG_QUERY,
  buildSongIndex,
  searchSongIndex,
  songOpenParams,
  type IndexedSong,
} from '@/utils/songIndex';
import { openCantoral } from '@/utils/cantoralNavigation';
import {
  PALETTE_COMMANDS,
  matchCommand,
  stepIndex,
  type PaletteCommand,
  type PaletteIconName,
} from '@/utils/commandPalette';
import { modShortcutLabel } from '@/utils/shortcutLabel';

/** Canciones como mucho en la lista: es para saltar, no para explorar. */
const MAX_SONGS = 8;

type PaletteItem =
  | { kind: 'command'; key: string; command: PaletteCommand }
  | { kind: 'song'; key: string; song: IndexedSong };

/**
 * Paleta de comandos global (⌘K en Mac, Ctrl+K en el resto). Solo web: en
 * nativo devuelve `null`. Vive en la raíz para que el atajo funcione desde
 * cualquier pantalla.
 *
 * Salta a las pantallas de primer nivel y, desde la v2, busca canciones del
 * cantoral (sin tildes, como el buscador de la lista) y las abre en su ruta
 * (`/cancionero/cancion`). Se maneja sin soltar el teclado:
 * escribir, ↑/↓ e Intro; Esc cierra.
 *
 * Ligera a propósito: el cuerpo (y con él la lectura del nodo `songs`) solo
 * se monta con la paleta abierta, y con ella cerrada no escucha más tecla que
 * su atajo — las flechas e Intro son de la pantalla de debajo.
 */
export default function CommandPalette() {
  const [open, setOpen] = useState(false);

  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);

  useKeyboardShortcut('k', handleOpen, { meta: true });
  useEscapeToClose(open, handleClose);

  if (Platform.OS !== 'web') return null;

  return (
    <Dialog
      isOpen={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          {open ? <PaletteBody onClose={handleClose} /> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

function PaletteBody({ onClose }: { onClose: () => void }) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const styles = useMemo(() => createStyles(scheme), [scheme]);

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  // Mismo nodo y mismo filtro (sin borradores) que las pantallas del
  // cantoral: sale de la caché de `useFirebaseData`, sin descarga extra.
  const { data: songsData, loading: songsLoading } = useFirebaseData<SongsData>(
    'songs',
    'songs',
    filterSongsData as (data: unknown) => SongsData,
  );
  const songIndex = useMemo(() => buildSongIndex(songsData), [songsData]);

  const items = useMemo<PaletteItem[]>(() => {
    const commands = PALETTE_COMMANDS.filter((c) => matchCommand(c, query)).map(
      (command): PaletteItem => ({
        kind: 'command',
        key: `cmd:${command.id}`,
        command,
      }),
    );
    const songs = searchSongIndex(songIndex, query, MAX_SONGS).map(
      (song): PaletteItem => ({
        kind: 'song',
        key: `song:${song.filename}`,
        song,
      }),
    );
    return [...commands, ...songs];
  }, [query, songIndex]);

  const handleQuery = useCallback((text: string) => {
    setQuery(text);
    setActiveIndex(0);
  }, []);

  const handleSelect = useCallback(
    (item: PaletteItem) => {
      onClose();
      if (item.kind === 'song') {
        openCantoral('SongDetail', songOpenParams(item.song), {
          fromOutside: true,
        });
        return;
      }
      // expo-router acepta rutas en string; el cast es porque la unión
      // tipada de Href no incluye todas las rutas de primer nivel.
      router.push(item.command.path as never);
    },
    [onClose],
  );

  // Teclado mientras la paleta está abierta (y SOLO entonces: este listener
  // vive en el cuerpo, que se desmonta al cerrar). En fase de captura y
  // cortando la propagación, para que ↑/↓/Intro no le lleguen también a los
  // atajos de la pantalla de debajo (el detalle de canción tiene los suyos).
  // Intro solo se toma desde el buscador: sobre una fila enfocada con Tab, o
  // sobre el botón de borrar, Intro hace lo de ese botón.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex((i) =>
          stepIndex(i, e.key === 'ArrowDown' ? 1 : -1, items.length),
        );
        return;
      }
      if (e.key !== 'Enter') return;
      const target = e.target as { tagName?: string } | null;
      if (target?.tagName?.toUpperCase() !== 'INPUT') return;
      const item = items[activeIndex];
      if (!item) return;
      e.preventDefault();
      e.stopPropagation();
      handleSelect(item);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [items, activeIndex, handleSelect]);

  // `autoFocus` no basta: el diálogo monta el campo mientras anima la entrada
  // y el navegador deja el foco en el `body`, así que lo que se teclea nada
  // más pulsar ⌘K se perdía. Se enfoca a mano en el siguiente fotograma.
  const inputRef = useRef<TextInputInstance>(null);
  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, []);

  // El resaltado siempre a la vista al moverse con las flechas. En web el
  // ref de un `View` es el nodo del DOM.
  const rowRefs = useRef<(ViewInstance | null)[]>([]);
  useEffect(() => {
    const node = rowRefs.current[activeIndex] as unknown as {
      scrollIntoView?: (opts: { block: string }) => void;
    } | null;
    node?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex]);

  const firstSongIndex = items.findIndex((i) => i.kind === 'song');
  const searchingSongs =
    query.trim().length >= MIN_SONG_QUERY &&
    songsLoading &&
    songIndex.length === 0;
  const muted = themeColors(isDark).textMuted;

  return (
    <View style={styles.body}>
      <SearchField value={query} onChange={handleQuery}>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input
            ref={inputRef}
            placeholder="Busca una canción o salta a…"
            autoFocus
            accessibilityLabel="Buscar canciones y pantallas"
          />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      >
        {items.map((item, index) => {
          const active = index === activeIndex;
          const isSong = item.kind === 'song';
          const title = isSong ? item.song.title : item.command.title;
          const subtitle = isSong
            ? [item.song.author, item.song.categoryName]
                .filter(Boolean)
                .join(' · ')
            : item.command.subtitle;
          const icon: PaletteIconName = isSong
            ? 'music-note'
            : item.command.icon;
          return (
            <View
              key={item.key}
              ref={(node) => {
                rowRefs.current[index] = node;
              }}
            >
              {index === firstSongIndex ? (
                <Text style={styles.sectionLabel}>Canciones</Text>
              ) : null}
              <PressableFeedback
                onPress={() => handleSelect(item)}
                onHoverIn={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                style={[styles.item, active && styles.itemActive]}
                accessibilityRole="button"
                accessibilityLabel={isSong ? `Canción: ${title}` : title}
                accessibilityHint={subtitle || undefined}
                accessibilityState={{ selected: active }}
              >
                <View style={styles.itemIcon}>
                  <MaterialIcons
                    name={icon}
                    size={20}
                    color={themeColors(isDark).textSecondary}
                  />
                </View>
                <View style={styles.itemText}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {title}
                  </Text>
                  {subtitle ? (
                    <Text style={styles.itemSubtitle} numberOfLines={1}>
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
                {active ? (
                  <MaterialIcons
                    name="keyboard-return"
                    size={16}
                    color={muted}
                  />
                ) : null}
              </PressableFeedback>
            </View>
          );
        })}
        {searchingSongs ? (
          <Text style={styles.status}>Cargando el cantoral…</Text>
        ) : items.length === 0 ? (
          <EmptyState compact icon="search-off" title="Sin resultados" />
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        <Text style={styles.footerHint}>
          ↑↓ para moverte · Intro para abrir · Esc para cerrar ·{' '}
          {modShortcutLabel('k')} desde cualquier pantalla
        </Text>
      </View>
    </View>
  );
}

const createStyles = (scheme: 'light' | 'dark' | null) => {
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
    body: {
      gap: 10,
      paddingVertical: spacing.xs,
    },
    list: {
      maxHeight: 360,
    },
    listContent: {
      gap: 2,
      paddingVertical: spacing.xs,
    },
    sectionLabel: {
      ...typography.overline,
      color: themeColors(isDark).textMuted,
      paddingHorizontal: 12,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: radii.md,
      gap: 12,
    },
    itemActive: {
      backgroundColor: isDark
        ? StateColors.pressedOverlayDark
        : StateColors.pressedOverlay,
    },
    itemIcon: {
      width: 28,
      alignItems: 'center',
    },
    itemText: {
      flex: 1,
    },
    itemTitle: {
      ...typography.button,
      color: theme.text,
    },
    itemSubtitle: {
      ...typography.footnote,
      color: themeColors(isDark).textSecondary,
      marginTop: 2,
    },
    status: {
      ...typography.subhead,
      color: themeColors(isDark).textMuted,
      textAlign: 'center',
      paddingVertical: spacing.md,
    },
    footer: {
      paddingTop: 6,
      alignItems: 'center',
    },
    footerHint: {
      ...typography.micro,
      color: themeColors(isDark).textMuted,
      letterSpacing: 0.3,
      textAlign: 'center',
    },
  });
};
