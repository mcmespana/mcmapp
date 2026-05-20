import React, { useCallback, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Dialog, SearchField } from 'heroui-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { useEscapeToClose } from '@/hooks/useEscapeToClose';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';
import { radii } from '@/constants/uiStyles';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

interface Command {
  id: string;
  title: string;
  subtitle?: string;
  icon: MaterialIconName;
  /** Path passed to `router.push`. Top-level routes only — sub-screens of
   *  nested non-router stacks (cancionero / mas) aren't reachable directly. */
  path: string;
  /** Extra search terms (synonyms, abbreviations, related concepts). */
  keywords?: string[];
}

const COMMANDS: Command[] = [
  {
    id: 'home',
    title: 'Inicio',
    subtitle: 'Pantalla principal',
    icon: 'home',
    path: '/',
    keywords: ['home', 'principal', 'menú'],
  },
  {
    id: 'cancionero',
    title: 'Cantoral',
    subtitle: 'Canciones con acordes',
    icon: 'music-note',
    path: '/cancionero',
    keywords: ['canciones', 'songs', 'acordes', 'cantar', 'cancionero'],
  },
  {
    id: 'calendario',
    title: 'Calendario',
    subtitle: 'Eventos y celebraciones',
    icon: 'event',
    path: '/calendario',
    keywords: ['eventos', 'agenda', 'fechas', 'calendar'],
  },
  {
    id: 'fotos',
    title: 'Fotos',
    subtitle: 'Galería de imágenes',
    icon: 'photo-library',
    path: '/fotos',
    keywords: ['gallery', 'imágenes', 'galería', 'álbum'],
  },
  {
    id: 'mas',
    title: 'Más',
    subtitle: 'Grupos, Materiales, Visitas...',
    icon: 'apps',
    path: '/mas',
    keywords: ['más', 'mas', 'grupos', 'materiales', 'visitas', 'contactos'],
  },
  {
    id: 'notifications',
    title: 'Notificaciones',
    icon: 'notifications',
    path: '/notifications',
    keywords: ['avisos', 'mensajes', 'noti'],
  },
  {
    id: 'wordle',
    title: 'Wordle',
    subtitle: 'Juego diario',
    icon: 'sports-esports',
    path: '/wordle',
    keywords: ['juego', 'game', 'palabras'],
  },
];

function matchCommand(cmd: Command, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  if (cmd.title.toLowerCase().includes(q)) return true;
  if (cmd.subtitle?.toLowerCase().includes(q)) return true;
  return Boolean(cmd.keywords?.some((k) => k.toLowerCase().includes(q)));
}

/**
 * Global command palette (Cmd/Ctrl + K). Web-only — returns `null` on
 * native. Lives at root so the shortcut works from anywhere in the app.
 *
 * v1 only navigates between top-level expo-router screens. Deep-linking
 * into nested stacks (e.g. specific song detail) needs the cancionero/mas
 * stacks to expose their navigation ref — out of scope here.
 */
export default function CommandPalette() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const styles = useMemo(() => createStyles(scheme), [scheme]);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const handleOpen = useCallback(() => {
    setQuery('');
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => setOpen(false), []);

  useKeyboardShortcut('k', handleOpen, { meta: true });
  useEscapeToClose(open, handleClose);

  const filtered = useMemo(
    () => COMMANDS.filter((c) => matchCommand(c, query)),
    [query],
  );

  const handleSelect = useCallback((path: string) => {
    setOpen(false);
    setQuery('');
    // expo-router accepts string paths; cast required because the typed
    // Href union doesn't include arbitrary tab-internal routes.
    router.push(path as never);
  }, []);

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
          <View style={styles.body}>
            <SearchField value={query} onChange={setQuery}>
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Saltar a..." autoFocus />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
            >
              {filtered.map((cmd) => (
                <Pressable
                  key={cmd.id}
                  onPress={() => handleSelect(cmd.path)}
                  style={({ pressed }) => [
                    styles.item,
                    pressed && styles.itemPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={cmd.title}
                >
                  <View style={styles.itemIcon}>
                    <MaterialIcons
                      name={cmd.icon}
                      size={20}
                      color={isDark ? '#AEAEB2' : '#636366'}
                    />
                  </View>
                  <View style={styles.itemText}>
                    <Text style={styles.itemTitle}>{cmd.title}</Text>
                    {cmd.subtitle ? (
                      <Text style={styles.itemSubtitle}>{cmd.subtitle}</Text>
                    ) : null}
                  </View>
                </Pressable>
              ))}
              {filtered.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>Sin resultados</Text>
                </View>
              ) : null}
            </ScrollView>
            <View style={styles.footer}>
              <Text style={styles.footerHint}>
                Esc para cerrar · ⌘K para abrir
              </Text>
            </View>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

const createStyles = (scheme: 'light' | 'dark' | null) => {
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
    body: {
      gap: 10,
      paddingVertical: 4,
    },
    list: {
      maxHeight: 360,
    },
    listContent: {
      gap: 2,
      paddingVertical: 4,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: radii.md,
      gap: 12,
    },
    itemPressed: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    },
    itemIcon: {
      width: 28,
      alignItems: 'center',
    },
    itemText: {
      flex: 1,
    },
    itemTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
    },
    itemSubtitle: {
      fontSize: 12,
      color: isDark ? '#AEAEB2' : '#8E8E93',
      marginTop: 2,
    },
    empty: {
      paddingVertical: 24,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 14,
      color: isDark ? '#8E8E93' : '#8E8E93',
      fontStyle: 'italic',
    },
    footer: {
      paddingTop: 6,
      alignItems: 'center',
    },
    footerHint: {
      fontSize: 11,
      color: isDark ? '#636366' : '#A0A0A8',
      letterSpacing: 0.3,
    },
  });
};
