import { logger } from '@/utils/logger';
import { trackEvent } from '@/utils/analytics';
import { tramoTamano } from '@/constants/analyticsEvents';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  FlatList,
  Platform,
  Share,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { PressableFeedback } from 'heroui-native';
import AppTextField from '@/components/ui/AppTextField';
import { useToast } from '@/contexts/AppToastContext';
import { extractSongMedia } from '@/types/songMedia';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import {
  useNavigation,
  useRoute,
  useHeaderHeight,
} from 'expo-router/react-navigation';
import { NativeStackNavigationProp } from 'expo-router/build/react-navigation/native-stack';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import {
  useSelectedSongs,
  SelectedSong,
} from '@/contexts/SelectedSongsContext';
import { useChoirSession } from '@/contexts/ChoirSessionContext';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { RootStackParamList } from '../(tabs)/cancionero';
import ProgressWithMessage from '@/components/ProgressWithMessage';

import { h } from '@/utils/haptics';
import PlaylistRow from '@/components/playlist/PlaylistRow';
import { createStyles } from '@/components/playlist/selectedSongsStyles';
import {
  PlaylistHeaderBar,
  type ViewMode,
} from '@/components/playlist/PlaylistHeaderBar';
import { DraggableManualRow } from '@/components/playlist/DraggableManualRow';
import ContextMenuSheet, {
  ContextMenuAction,
} from '@/components/ContextMenuSheet';
import ReorderableList, {
  ReorderableListReorderEvent,
} from 'react-native-reorderable-list';
import PlaylistActionsBottomSheet, {
  PlaylistAction,
  PlaylistActionSection,
} from '@/components/playlist/PlaylistActionsBottomSheet';
import ExportPdfModal, {
  PdfExportConfig,
} from '@/components/playlist/ExportPdfModal';
import { buildPlaylistPdfHtml } from '@/utils/playlistPdfHtml';
import CodeInputModal, {
  CodeDialogVariant,
} from '@/components/playlist/CodeInputModal';
import ConfirmChoiceModal from '@/components/playlist/ConfirmChoiceModal';
import ShareQrModal from '@/components/playlist/ShareQrModal';
import PasswordPromptModal from '@/components/playlist/PasswordPromptModal';
import ChoirSessionBanner from '@/components/playlist/ChoirSessionBanner';
import ChoirSheet from '@/components/playlist/ChoirSheet';

import {
  fetchCloudPlaylist,
  uploadCloudPlaylist,
  changeCloudPlaylistCode,
  deleteCloudPlaylist,
} from '@/services/cloudPlaylistService';
import {
  removeChoirPlaylist,
  upsertChoirPlaylist,
} from '@/services/choirDirectoryService';
import {
  choirSessionExists,
  fetchChoirSession,
  fetchLiveChoirSession,
} from '@/services/choirSessionService';
import {
  usePlaylistSharing,
  SHARED_PASSWORD,
} from '@/hooks/usePlaylistSharing';
import { playlistSignature } from '@/utils/playlistSync';
import { isChoirId } from '@/utils/choirIds';
import { transposeLabel, transposeKey } from '@/utils/transposeKey';
import { convertChord } from '@/utils/chordNotation';
import { useSettings } from '@/contexts/SettingsContext';
import {
  encodeOfflinePlaylist,
  decodeOfflinePlaylist,
  parseSongNumber,
  type FilenameResolver,
} from '@/utils/offlinePlaylist';

interface Song {
  title: string;
  filename: string;
  author?: string;
  key?: string;
  capo?: number;
  info?: string;
  content?: string;
}

interface CategorizedSongs {
  categoryKey: string;
  categoryTitle: string;
  data: (Song & {
    originalCategoryKey: string;
    transpose: number;
    capoOverride: number | null;
    order: number;
  })[];
}

type SelectedSongsScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'SongDetail'
>;

const WEB_BASE_URL = 'https://mcm.expo.app';
/** Esquema propio para deep links offline (playlist embebida en la URL). */
const APP_SCHEME = 'mcmapp://';

const SelectedSongsScreen: React.FC = () => {
  const { selectedSongs, isHydrated, addSong, removeSong, moveSong } =
    useSelectedSongs();
  const choir = useChoirSession();
  // Escalar suelto a propósito: leer `choir.session?.current?.filename` DENTRO
  // de un callback hace que se infiera `choir.session` entera como dependencia,
  // así que el memo se rehace en cada latido del líder aunque la canción en
  // curso no cambie (mismo patrón que el `const uid = user?.uid` de TODO.md §2).
  const nowPlayingFilename = choir.session?.current?.filename;
  const { settings } = useSettings();

  const navigation = useNavigation<SelectedSongsScreenNavigationProp>();
  const route = useRoute();
  const scheme = useColorScheme() || 'light';
  const isDark = scheme === 'dark';
  const layout = useResponsiveLayout();
  // En iOS el header es transparente (`headerTransparent`) y las FlatList lo
  // compensan con `contentInsetAdjustmentBehavior="automatic"`. La
  // `ReorderableList` (modo "Orden ajustado") NO respeta ese inset, así que su
  // contenido arrancaba bajo el header y al arrastrar la primera canción
  // quedaba tapada. Le damos el inset superior explícito.
  const headerHeight = useHeaderHeight();
  const reorderableTopInset = Platform.OS === 'ios' ? headerHeight : 0;
  const styles = useMemo(
    () => createStyles(scheme, layout.isWide, layout.readableMaxWidth),
    [scheme, layout.isWide, layout.readableMaxWidth],
  );
  const { data: allSongsData, loading } = useFirebaseData<
    Record<string, { categoryTitle: string; songs: Song[] }>
  >('songs', 'songs');
  const { toast } = useToast();

  // Por defecto "Orden ajustado": es donde se reordena con drag & drop.
  const [viewMode, setViewMode] = useState<ViewMode>('manual');

  // Modales / sheets
  const [showActions, setShowActions] = useState(false);
  const [showExportFileModal, setShowExportFileModal] = useState(false);
  const [exportFileName, setExportFileName] = useState('');
  const [showExportPdfModal, setShowExportPdfModal] = useState(false);
  const [exportPdfDefaultName, setExportPdfDefaultName] = useState('');

  // Diálogo genérico de código (variant decide la operación a hacer en submit).
  const [codeDialog, setCodeDialog] = useState<{
    variant: CodeDialogVariant;
    initial?: string;
  } | null>(null);

  // Diálogo de confirmación múltiple genérico.
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description?: string;
    actions: {
      label: string;
      onPress: () => void;
      variant?: 'primary' | 'secondary' | 'danger';
    }[];
  } | null>(null);

  // Modal de QR (tras subir playlist / iniciar coro, o desde el menú).
  const [qrModal, setQrModal] = useState<{
    title: string;
    url?: string;
    code?: string;
    offlineUrl?: string;
    defaultMode?: 'online' | 'offline';
  } | null>(null);

  // Subida pendiente de contraseña (el código ya existe en la nube).
  const [pendingOverwrite, setPendingOverwrite] = useState<{
    code: string;
    name?: string;
  } | null>(null);

  // Estado de "compartir": coro elegido, enlace con la nube, deshacer,
  // contraseña… todo vive en su propio hook (ver `usePlaylistSharing`).
  const sharing = usePlaylistSharing({
    onShowQr: (l) =>
      setQrModal({
        title: l.name ? `${l.name} · #${l.code}` : `Playlist · #${l.code}`,
        url: `${WEB_BASE_URL}/playlist?p=${l.code}`,
        code: l.code,
      }),
  });
  const link = sharing.link;

  // (Los dos efectos de auto-import por enlace viven más abajo, justo detrás de
  // `handleJoinChoir` y `offlineFilenameResolver`: necesitan leerlos y aquí
  // arriba quedaban en zona muerta.)

  // Mapa filename → datos completos de la canción (con categoría original).
  const allSongsMap = useMemo(() => {
    const map = new Map<string, Song & { originalCategoryKey: string }>();
    if (!allSongsData) return map;
    for (const [categoryKey, categoryData] of Object.entries(allSongsData)) {
      categoryData.songs.forEach((song) => {
        map.set(song.filename, { ...song, originalCategoryKey: categoryKey });
      });
    }
    return map;
  }, [allSongsData]);

  // --- QR offline -----------------------------------------------------------
  // Resuelve filename → (categoría, número) para CODIFICAR la playlist offline.
  const resolveSongInfo = useCallback(
    (filename: string) => {
      const meta = allSongsMap.get(filename);
      if (!meta) return null;
      return {
        categoryKey: meta.originalCategoryKey,
        number: parseSongNumber(meta.title, filename),
      };
    },
    [allSongsMap],
  );

  // Resuelve (categoría, número) → filename para DECODIFICAR un QR offline
  // contra el catálogo cacheado del dispositivo.
  const offlineFilenameResolver = useMemo<FilenameResolver>(() => {
    const byCatNum = new Map<string, string>();
    if (allSongsData) {
      for (const [categoryKey, cat] of Object.entries(allSongsData)) {
        cat.songs.forEach((song) => {
          const n = parseSongNumber(song.title, song.filename);
          if (n != null) {
            const key = `${categoryKey}:${n}`;
            if (!byCatNum.has(key)) byCatNum.set(key, song.filename);
          }
        });
      }
    }
    return {
      resolveCategory: (categoryKey, number) =>
        byCatNum.get(`${categoryKey}:${number}`) ?? null,
      hasFilename: (filename) => allSongsMap.has(filename),
    };
  }, [allSongsData, allSongsMap]);

  // URL del QR offline con la playlist entera embebida.
  const offlineUrl = useMemo(() => {
    if (selectedSongs.length === 0) return undefined;
    const payload = encodeOfflinePlaylist(selectedSongs, resolveSongInfo);
    return `${APP_SCHEME}playlist?d=${encodeURIComponent(payload)}`;
  }, [selectedSongs, resolveSongInfo]);

  // Datos enriquecidos de la selección, ordenados por el campo `order`.
  const enrichedSelected = useMemo(() => {
    return selectedSongs
      .map((sel) => {
        const meta = allSongsMap.get(sel.filename);
        if (!meta) return null;
        return {
          ...meta,
          transpose: sel.transpose,
          capoOverride: sel.capoOverride ?? null,
          order: sel.order,
        };
      })
      .filter(
        (
          s,
        ): s is Song & {
          originalCategoryKey: string;
          transpose: number;
          capoOverride: number | null;
          order: number;
        } => s !== null,
      );
  }, [selectedSongs, allSongsMap]);

  // Lista plana ordenada (para modo "manual") y para navegación entre canciones.
  const flatSelectedSongs = useMemo(
    () => [...enrichedSelected].sort((a, b) => a.order - b.order),
    [enrichedSelected],
  );

  // Contador que coincide con lo que realmente se ve en la lista. La lista
  // filtra canciones que no estén en el catálogo cargado, así que contar
  // `selectedSongs.length` daba descuadres (p. ej. "13" mostrando 12 filas).
  // Mientras el catálogo aún no ha cargado, caemos al total seleccionado para
  // no parpadear a 0.
  const visibleCount = allSongsData
    ? flatSelectedSongs.length
    : selectedSongs.length;

  const songIndexMap = useMemo(() => {
    const m = new Map<string, number>();
    flatSelectedSongs.forEach((s, i) => m.set(s.filename, i));
    return m;
  }, [flatSelectedSongs]);

  // Agrupación por categoría (modo "category").
  const categorized = useMemo<CategorizedSongs[]>(() => {
    if (!allSongsData) return [];
    const out: CategorizedSongs[] = [];
    for (const [categoryKey, categoryData] of Object.entries(allSongsData)) {
      const selectedInCat = enrichedSelected
        .filter((s) => s.originalCategoryKey === categoryKey)
        .sort((a, b) => a.filename.localeCompare(b.filename));
      if (selectedInCat.length > 0) {
        out.push({
          categoryKey,
          categoryTitle: categoryData.categoryTitle,
          data: selectedInCat,
        });
      }
    }
    out.sort((a, b) => a.categoryTitle.localeCompare(b.categoryTitle));
    return out;
  }, [allSongsData, enrichedSelected]);

  // Si el maestro publica cambios en la playlist, refrescamos.
  useEffect(() => {
    if (choir.mode !== 'master') return;
    void choir.publishPlaylist(selectedSongs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choir.mode, selectedSongs]);

  // --- Acciones --------------------------------------------------------------

  const handleSongPress = useCallback(
    (song: Song) => {
      const completeSong = allSongsMap.get(song.filename);
      if (!completeSong) return;
      const index = songIndexMap.get(completeSong.filename) ?? -1;
      navigation.navigate('SongDetail', {
        filename: completeSong.filename,
        title: completeSong.title,
        ...(completeSong.author && { author: completeSong.author }),
        ...(completeSong.key && { key: completeSong.key }),
        ...(typeof completeSong.capo !== 'undefined' && {
          capo: completeSong.capo,
        }),
        content: completeSong.content || '',
        media: extractSongMedia(completeSong) ?? undefined,
        navigationList: flatSelectedSongs.map((s) => ({
          title: s.title,
          filename: s.filename,
          author: s.author,
          key: s.key,
          capo: s.capo,
          content: s.content,
          media: extractSongMedia(s) ?? undefined,
        })),
        currentIndex: index,
        source: 'selection',
        firebaseCategory: completeSong.originalCategoryKey || 'entrada',
      });
    },
    [allSongsMap, songIndexMap, flatSelectedSongs, navigation],
  );

  /** Texto formateado: usa el TONO TRANSPORTADO (no el original). */
  const buildShareText = useCallback(() => {
    const date = new Date()
      .toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
      .toUpperCase()
      .replace('.', '');
    const musicalEmojis = [
      '🎹',
      '🎸',
      '🎤',
      '🎶',
      '🎵',
      '🎼',
      '🎷',
      '🎺',
      '🎻',
    ];
    const randomEmoji =
      musicalEmojis[Math.floor(Math.random() * musicalEmojis.length)];
    const header = `*CANCIONES ${date} ${randomEmoji}*`;
    const lines: string[] = [];

    // Recorremos en el orden actualmente visible (manual o por categoría).
    const visibleGroups: {
      categoryTitle: string;
      data: typeof flatSelectedSongs;
    }[] =
      viewMode === 'manual'
        ? [{ categoryTitle: '', data: flatSelectedSongs }]
        : categorized.map((c) => ({
            categoryTitle: c.categoryTitle,
            data: c.data,
          }));

    visibleGroups.forEach((group) => {
      const letter = group.categoryTitle
        ? group.categoryTitle.charAt(0).toUpperCase()
        : '';
      group.data.forEach((song) => {
        const cleanTitle = song.title.replace(/^\d+\.\s*/, '');
        let toneStr = '';
        if (song.key) {
          const original = song.key.toUpperCase();
          if (song.transpose === 0) {
            toneStr = `\`${convertChord(original, settings.notation)}\``;
          } else {
            const target = transposeKey(original, song.transpose);
            const lbl = transposeLabel(song.transpose);
            toneStr =
              `\`${convertChord(original, settings.notation)}→` +
              `${convertChord(target, settings.notation)}\` *(${lbl} st)*`;
          }
          const effectiveCapo =
            song.capoOverride !== null && song.capoOverride !== undefined
              ? song.capoOverride
              : song.capo;
          if (effectiveCapo && effectiveCapo > 0) {
            toneStr += ` \`C/${effectiveCapo}${song.capoOverride !== null && song.capoOverride !== undefined ? '✱' : ''}\``;
          }
        }
        const idMatch = song.title.match(/^\d+/);
        const songId = idMatch ? idMatch[0] : '??';
        let line = letter ? `*${letter}.* ${cleanTitle}` : `• ${cleanTitle}`;
        if (toneStr) line += ` · ${toneStr}`;
        line += ` · *[#${songId}]*`;
        if (song.author) line += ` · ${song.author}`;
        lines.push(line);
      });
    });

    return [header, ...lines].join('\n');
  }, [viewMode, flatSelectedSongs, categorized, settings.notation]);

  const handleShareText = useCallback(() => {
    const text = buildShareText();
    trackEvent('playlist_usada', {
      accion: 'compartida',
      tamano: tramoTamano(flatSelectedSongs.length),
    });
    const desktopLike =
      Platform.OS === 'web' ||
      Platform.OS === 'windows' ||
      Platform.OS === 'macos';
    if (desktopLike) {
      Clipboard.setStringAsync(text)
        .then(() => toast.show({ label: 'Lista copiada al portapapeles' }))
        .catch(() => toast.show({ label: 'Error al copiar la lista' }));
    } else {
      try {
        Share.share({ message: text });
      } catch (e) {
        logger.error(e);
      }
    }
    // `flatSelectedSongs.length` va en las deps aunque hoy `buildShareText` ya
    // cambie con la lista: sin él, el día que ese memo cambie de dependencias
    // la analítica empezaría a reportar el tamaño de una playlist vieja.
  }, [buildShareText, toast, flatSelectedSongs.length]);

  const handleStartExportFile = useCallback(() => {
    const monthNames = [
      'ene',
      'feb',
      'mar',
      'abr',
      'may',
      'jun',
      'jul',
      'ago',
      'sep',
      'oct',
      'nov',
      'dic',
    ];
    const now = new Date();
    const dateStr = `${now.getDate()}-${monthNames[now.getMonth()]}`;
    setExportFileName(`Playlist ${dateStr}`);
    setShowExportFileModal(true);
  }, []);

  const handleConfirmExportFile = useCallback(async () => {
    try {
      const fileName = `${exportFileName}.mcm`;
      const payload = JSON.stringify({
        version: 2,
        createdAt: Date.now(),
        songs: selectedSongs,
      });
      if (Platform.OS === 'web') {
        const blob = new Blob([payload], { type: 'application/octet-stream' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      } else {
        const path = FileSystem.cacheDirectory + fileName;
        await FileSystem.writeAsStringAsync(path, payload, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        await Sharing.shareAsync(path, {
          mimeType: 'application/octet-stream',
          dialogTitle: 'Compartir playlist',
          UTI: 'com.mcmespana.mcmapp.playlist',
        });
      }
      setShowExportFileModal(false);
      toast.show({ label: 'Playlist exportada' });
    } catch (err) {
      logger.error('Error exportando playlist', err);
      setShowExportFileModal(false);
      toast.show({ label: 'Error al exportar' });
    }
  }, [exportFileName, selectedSongs, toast]);

  // --- Exportar a PDF -------------------------------------------------------

  const handleStartExportPdf = useCallback(() => {
    const monthNames = [
      'ene',
      'feb',
      'mar',
      'abr',
      'may',
      'jun',
      'jul',
      'ago',
      'sep',
      'oct',
      'nov',
      'dic',
    ];
    const now = new Date();
    const dateStr = `${now.getDate()}-${monthNames[now.getMonth()]}`;
    setExportPdfDefaultName(`Playlist ${dateStr}`);
    setShowExportPdfModal(true);
  }, []);

  const handleConfirmExportPdf = useCallback(
    async (cfg: PdfExportConfig) => {
      try {
        if (flatSelectedSongs.length === 0) {
          toast.show({ label: 'Playlist vacía' });
          setShowExportPdfModal(false);
          return;
        }
        const html = buildPlaylistPdfHtml({
          playlistName: cfg.playlistName,
          songs: flatSelectedSongs.map((s) => ({
            title: s.title,
            author: s.author,
            key: s.key,
            capo: s.capo,
            capoOverride: s.capoOverride,
            content: s.content,
            transpose: s.transpose,
          })),
          notation: settings.notation,
          pageBreakPerSong: cfg.pageBreakPerSong,
          showChords: cfg.showChords,
          lyricsFontPt: cfg.lyricsFontPt,
          printedDate: cfg.printedDate,
        });

        if (Platform.OS === 'web') {
          // Abre una nueva pestaña con el HTML listo para imprimir/PDF.
          const w = window.open('', '_blank');
          if (!w) {
            toast.show({
              label: 'Permite las ventanas emergentes para exportar',
            });
            return;
          }
          w.document.open();
          w.document.write(html);
          w.document.close();
          // Pequeño delay para que Inter cargue antes de lanzar print.
          setTimeout(() => {
            try {
              w.focus();
              w.print();
            } catch {}
          }, 600);
        } else {
          const Print = await import('expo-print');
          const { uri } = await Print.printToFileAsync({
            html,
            base64: false,
            // A4 en puntos (72 PPI); sin esto expo-print asume US Letter.
            width: 595,
            height: 842,
            // iOS ignora el `margin` de @page del CSS, así que ahí los
            // márgenes van por opción nativa (expo-print solo la aplica en
            // iOS; Android sí respeta el @page del HTML).
            margins: { top: 51, bottom: 51, left: 45, right: 45 },
          });
          const safeName =
            cfg.playlistName
              .replace(/[^\p{L}\p{N}\-_ ]/gu, '')
              .trim()
              .slice(0, 60) || 'Playlist';
          const finalPath = FileSystem.cacheDirectory + `${safeName}.pdf`;
          try {
            await FileSystem.moveAsync({ from: uri, to: finalPath });
          } catch {
            // Si el move falla (ya existe), simplemente usamos el original.
          }
          const sharePath = (await FileSystem.getInfoAsync(finalPath)).exists
            ? finalPath
            : uri;
          await Sharing.shareAsync(sharePath, {
            mimeType: 'application/pdf',
            dialogTitle: 'Compartir playlist en PDF',
            UTI: 'com.adobe.pdf',
          });
        }
        setShowExportPdfModal(false);
        toast.show({ label: 'Tenemos tu PDF recién sacado del orno' });
      } catch (err) {
        logger.error('Error exportando PDF', err);
        toast.show({
          label: 'Error al generar el PDF, sorry, lo arreglaremos',
        });
      }
    },
    [flatSelectedSongs, settings.notation, toast],
  );

  /**
   * Importa una lista desde texto JSON. Soporta:
   *  - v2: { version: 2, songs: SelectedSong[] }
   *  - v1: string[]
   */
  const importFromJson = useCallback((raw: string): SelectedSong[] | null => {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 2 && Array.isArray(parsed.songs)) {
        return parsed.songs as SelectedSong[];
      }
      if (Array.isArray(parsed)) {
        const now = Date.now();
        return parsed.map((filename: string, i: number) => ({
          filename,
          transpose: 0,
          order: i,
          addedAt: now + i,
        }));
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  /**
   * Importación desde ARCHIVO (.mcm). Es el único sitio donde seguimos
   * preguntando "reemplazar o añadir": un archivo suele ser un trozo de
   * repertorio que quieres juntar con lo tuyo, mientras que una playlist del
   * coro o de un enlace es "la lista de hoy" y ahí reemplazar y ofrecer
   * deshacer es más rápido y menos confuso.
   */
  const askMergeOrReplace = useCallback(
    (imported: SelectedSong[]) => {
      if (selectedSongs.length === 0) {
        sharing.replaceWithUndo(
          imported,
          `Playlist importada (${imported.length} canciones)`,
          null,
        );
        return;
      }
      setConfirmDialog({
        title: 'Ya tienes una playlist',
        description: `Tu lista actual tiene ${selectedSongs.length} canciones. La importada tiene ${imported.length}.`,
        actions: [
          {
            label: 'Reemplazar la mía',
            variant: 'primary',
            onPress: () => {
              setConfirmDialog(null);
              sharing.replaceWithUndo(imported, 'Playlist reemplazada', null);
            },
          },
          {
            label: 'Añadir las nuevas',
            variant: 'secondary',
            onPress: () => {
              setConfirmDialog(null);
              const existing = new Set(selectedSongs.map((s) => s.filename));
              imported.forEach((s) => {
                if (!existing.has(s.filename)) {
                  addSong(s.filename, {
                    transpose: s.transpose,
                    categoryHint: s.categoryHint,
                  });
                }
              });
              toast.show({ label: 'Canciones añadidas' });
            },
          },
          {
            label: 'Cancelar',
            variant: 'secondary',
            onPress: () => setConfirmDialog(null),
          },
        ],
      });
    },
    [selectedSongs, sharing, addSong, toast],
  );

  const handleImportFile = useCallback(async () => {
    const valid = ['.mcm', '.json', '.mcmsongs'];
    const isValid = (n: string) =>
      valid.some((ext) => n.toLowerCase().endsWith(ext));
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.mcm,.json,.mcmsongs';
        input.onchange = async () => {
          if (!input.files || input.files.length === 0) return;
          const file = input.files[0];
          if (file.name && !isValid(file.name)) {
            toast.show({ label: 'Selecciona un archivo .mcm' });
            return;
          }
          const text = await file.text();
          const songs = importFromJson(text);
          if (!songs || songs.length === 0) {
            toast.show({ label: 'Archivo vacío o inválido' });
            return;
          }
          askMergeOrReplace(songs);
        };
        input.click();
      } else {
        const res = await DocumentPicker.getDocumentAsync({
          type: ['application/json', 'application/octet-stream'],
        });
        if (res.canceled || !res.assets || res.assets.length === 0) return;
        const file = res.assets[0];
        if (file.name && !isValid(file.name)) {
          toast.show({ label: 'Selecciona un archivo .mcm' });
          return;
        }
        const content = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        const songs = importFromJson(content);
        if (!songs || songs.length === 0) {
          toast.show({ label: 'Archivo vacío o inválido' });
          return;
        }
        askMergeOrReplace(songs);
      }
    } catch (err) {
      logger.error('Error importando playlist', err);
      toast.show({ label: 'Error al importar' });
    }
  }, [importFromJson, askMergeOrReplace, toast]);

  // --- Nube -----------------------------------------------------------------

  /** Guarda el enlace local tras subir con código suelto (sin coro). */
  const rememberUpload = useCallback(
    (code: string, name?: string) => {
      sharing.setLink({
        code,
        name,
        choirId: link?.code === code ? link.choirId : undefined,
        choirName: link?.code === code ? link.choirName : undefined,
        signature: playlistSignature(selectedSongs),
        syncedAt: Date.now(),
        owned: true,
      });
    },
    [sharing, link, selectedSongs],
  );

  /**
   * Subida por CÓDIGO (opción secundaria; lo normal es subir al coro).
   *
   * Si el código está ocupado ya no es un callejón sin salida: cualquiera
   * puede machacarlo escribiendo la contraseña, y si la playlist la subiste tú
   * desde este mismo dispositivo ni siquiera se pide.
   */
  const handleUploadToCloud = useCallback(
    async (code: string, name?: string) => {
      const existing = await fetchCloudPlaylist(code);
      const mine =
        !!existing &&
        ((!!existing.ownerDeviceId &&
          existing.ownerDeviceId === sharing.identity.deviceId) ||
          (link?.code === code && link.owned));
      if (existing && !mine) {
        // Ocupado por otra persona: se puede machacar con la contraseña o
        // coger otro código. Cerramos el diálogo para no apilar modales.
        setCodeDialog(null);
        setConfirmDialog({
          title: 'Ese código ya está ocupado',
          description: `Hay una playlist${
            existing.name ? ` («${existing.name}»)` : ''
          } en el código ${code}. Puedes machacarla con la contraseña del coro o subir la tuya con otro código.`,
          actions: [
            {
              label: 'Sobrescribirla…',
              variant: 'danger',
              onPress: () => {
                setConfirmDialog(null);
                setPendingOverwrite({ code, name: name ?? existing.name });
              },
            },
            {
              label: 'Elegir otro código',
              variant: 'primary',
              onPress: () => {
                setConfirmDialog(null);
                setCodeDialog({ variant: 'cloud-upload' });
              },
            },
            {
              label: 'Cancelar',
              variant: 'secondary',
              onPress: () => setConfirmDialog(null),
            },
          ],
        });
        // Lanzamos error para que el diálogo no se cierre automáticamente.
        throw new Error('__handled__');
      }
      await uploadCloudPlaylist(code, selectedSongs, {
        name,
        createdAt: existing?.createdAt,
        choirId: existing?.choirId,
        choirName: existing?.choirName,
        by: sharing.identity.name,
        ownerDeviceId: sharing.identity.deviceId,
      });
      rememberUpload(code, name);
      setCodeDialog(null);
      showUploadSuccess(code, name);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedSongs, link, sharing.identity, rememberUpload],
  );

  /** Subida tras validar la contraseña de sobrescritura. */
  const handleConfirmOverwrite = useCallback(async () => {
    const pending = pendingOverwrite;
    setPendingOverwrite(null);
    if (!pending) return;
    try {
      const existing = await fetchCloudPlaylist(pending.code);
      await uploadCloudPlaylist(pending.code, selectedSongs, {
        name: pending.name,
        createdAt: existing?.createdAt,
        choirId: existing?.choirId,
        choirName: existing?.choirName,
        by: sharing.identity.name,
        ownerDeviceId: sharing.identity.deviceId,
      });
      rememberUpload(pending.code, pending.name);
      showUploadSuccess(pending.code, pending.name);
    } catch (e: any) {
      toast.show({ label: e?.message ?? 'Error al subir' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOverwrite, selectedSongs, sharing.identity, rememberUpload]);

  const showUploadSuccess = useCallback(
    (code: string, name?: string) => {
      setQrModal({
        title: name
          ? `¡${name} subida! Código ${code}`
          : `¡Subida! Código ${code}`,
        url: `${WEB_BASE_URL}/playlist?p=${code}`,
        code,
        offlineUrl,
      });
    },
    [offlineUrl],
  );

  /** Desde la pestaña "con código" del QR cuando aún no se ha subido. */
  const handleQrRequestUpload = useCallback(() => {
    setQrModal(null);
    setCodeDialog({ variant: 'cloud-upload' });
  }, []);

  const showChoirSuccess = useCallback((code: string) => {
    setQrModal({
      title: `¡Coro iniciado! Código ${code}`,
      url: `${WEB_BASE_URL}/coro?c=${code}`,
      code,
    });
  }, []);

  const handleDownloadFromCloud = useCallback(
    async (code: string) => {
      await sharing.importByCode(code);
      setCodeDialog(null);
    },
    [sharing],
  );

  /**
   * QR offline escaneado desde el diálogo de importar: la playlist viene
   * entera dentro del propio código, así que no hay descarga — se resuelve
   * contra el catálogo cacheado igual que el deep link `?d=`.
   */
  const handleScannedOfflinePlaylist = useCallback(
    (payload: string) => {
      const { songs, missing } = decodeOfflinePlaylist(
        payload,
        offlineFilenameResolver,
      );
      if (songs.length === 0) {
        toast.show({ label: 'No se pudo leer la playlist del QR' });
        return;
      }
      setCodeDialog(null);
      sharing.replaceWithUndo(songs, 'Playlist del QR importada', null);
      if (missing > 0) {
        toast.show({
          label: `${missing} canción(es) del QR no están en este dispositivo`,
        });
      }
    },
    [sharing, offlineFilenameResolver, toast],
  );

  /** QR de coro escaneado desde "importar": traemos su última playlist. */
  const handleScannedChoirQr = useCallback(
    (choirId: string) => {
      setCodeDialog(null);
      void sharing.importLatestFromChoir(choirId).catch((e: any) => {
        toast.show({
          variant: 'danger',
          label: e?.message ?? 'No se ha podido importar',
        });
      });
    },
    [sharing, toast],
  );

  const handleChangeCloudCode = useCallback(
    async (newCode: string) => {
      if (!link) return;
      await changeCloudPlaylistCode(link.code, newCode);
      // El índice del coro va por código, así que hay que rehacer la entrada.
      if (link.choirId) {
        try {
          await removeChoirPlaylist(link.choirId, link.code);
          await upsertChoirPlaylist(link.choirId, {
            code: newCode,
            name: link.name ?? `Playlist ${newCode}`,
            createdAt: link.syncedAt,
            updatedAt: Date.now(),
            songCount: selectedSongs.length,
            ownerDeviceId: sharing.identity.deviceId,
          });
        } catch (e) {
          logger.error('reindex choir playlist error', e);
        }
      }
      sharing.setLink({ ...link, code: newCode });
      setCodeDialog(null);
      toast.show({ label: `Código cambiado a ${newCode}` });
    },
    [link, toast, sharing, selectedSongs.length],
  );

  const handleDeleteFromCloud = useCallback(async () => {
    if (!link) return;
    const { code, choirId, name } = link;
    setConfirmDialog({
      title: `Borrar «${name ?? code}» de la nube`,
      description: choirId
        ? 'Desaparece del histórico del coro y nadie podrá importarla.'
        : 'Cualquiera con el código dejará de poder importarla.',
      actions: [
        {
          label: 'Borrar de la nube',
          variant: 'danger',
          onPress: async () => {
            setConfirmDialog(null);
            try {
              await deleteCloudPlaylist(code);
              if (choirId) await removeChoirPlaylist(choirId, code);
              sharing.setLink(null);
              toast.show({ label: 'Borrada de la nube' });
            } catch (e: any) {
              toast.show({ label: e?.message ?? 'Error al borrar' });
            }
          },
        },
        {
          label: 'Cancelar',
          variant: 'secondary',
          onPress: () => setConfirmDialog(null),
        },
      ],
    });
  }, [link, toast, sharing]);

  // --- Coro -----------------------------------------------------------------

  const handleStartChoir = useCallback(
    async (code: string) => {
      const exists = await choirSessionExists(code);
      if (exists) {
        setCodeDialog(null);
        const existing = await fetchChoirSession(code);
        setConfirmDialog({
          title: 'Código de coro ocupado',
          description: existing
            ? `Ya hay una sesión activa con código ${code}. ¿Sobrescribirla?`
            : 'Ese código ya está en uso.',
          actions: [
            {
              label: 'Sobrescribir',
              variant: 'danger',
              onPress: async () => {
                setConfirmDialog(null);
                try {
                  await choir.startAsMaster(code, selectedSongs, {
                    name: sharing.identity.name,
                  });
                  showChoirSuccess(code);
                } catch (e: any) {
                  toast.show({ label: e?.message ?? 'Error al iniciar' });
                }
              },
            },
            {
              label: 'Elegir otro código',
              variant: 'primary',
              onPress: () => {
                setConfirmDialog(null);
                setCodeDialog({ variant: 'choir-start' });
              },
            },
            {
              label: 'Cancelar',
              variant: 'secondary',
              onPress: () => setConfirmDialog(null),
            },
          ],
        });
        throw new Error('__handled__');
      }
      await choir.startAsMaster(code, selectedSongs, {
        name: sharing.identity.name,
      });
      setCodeDialog(null);
      showChoirSuccess(code);
    },
    [choir, selectedSongs, toast, showChoirSuccess, sharing.identity.name],
  );

  const handleJoinChoir = useCallback(
    async (key: string) => {
      // `fetchLive…` ignora las caducadas (24 h): mejor decir "no hay sesión"
      // que meter al usuario en una que va a expulsarle en el siguiente tic.
      const session = await fetchLiveChoirSession(key);
      if (!session) {
        throw new Error('No hay ninguna sesión de coro abierta ahí');
      }
      // La playlist del líder pasa a ser la nuestra — con 10 s para deshacer,
      // que unirse al coro no debería costarte tu propia lista.
      sharing.replaceWithUndo(
        session.playlist || [],
        `Sigues a ${session.master?.name || 'el líder'}${
          session.choirName ? ` en ${session.choirName}` : ''
        }`,
        null,
      );
      await choir.joinAsSlave(key);
      setCodeDialog(null);
    },
    [choir, sharing],
  );

  const handleChangeChoirCode = useCallback(
    async (newCode: string) => {
      if (!choir.code) return;
      await choir.changeCode(newCode);
      setCodeDialog(null);
      toast.show({ label: `Código coro: ${newCode}` });
    },
    [choir, toast],
  );

  // --- Auto-import al llegar por un enlace -----------------------------------
  // Van AQUÍ, y no arriba con el resto de efectos, porque leen
  // `handleJoinChoir` y `offlineFilenameResolver`, que se declaran justo antes.
  // Declarados antes, el compilador los veía como acceso en zona muerta y
  // dejaba de rastrear sus cambios. Son efectos de un solo disparo (pestillo en
  // un ref), así que su orden relativo al resto da igual.
  //
  //   ?p=1234    → playlist por código
  //   ?coro=id   → la ÚLTIMA playlist de ese coro (siempre la de hoy)
  //   ?c=1234|id → sesión de coro en vivo
  // En los tres casos se reemplaza la selección directamente y el toast deja
  // 10 s para deshacer: venir de un enlace y que te pregunten tres cosas antes
  // de enseñarte nada era el peor momento posible para un diálogo.
  const autoImportAttempted = useRef(false);
  useEffect(() => {
    if (autoImportAttempted.current) return;
    const params: any = (route?.params as any) || {};
    const playlistCode = params.p ?? params.code;
    const choirParam = params.coro;
    const liveKey = params.c;

    if (typeof playlistCode === 'string' && /^\d{4}$/.test(playlistCode)) {
      autoImportAttempted.current = true;
      void sharing.importByCode(playlistCode).catch((e: any) => {
        toast.show({
          variant: 'danger',
          label: e?.message ?? 'No se ha podido importar',
        });
      });
    } else if (typeof choirParam === 'string' && isChoirId(choirParam)) {
      autoImportAttempted.current = true;
      void sharing.importLatestFromChoir(choirParam).catch((e: any) => {
        toast.show({
          variant: 'danger',
          label: e?.message ?? 'No se ha podido importar',
        });
      });
    } else if (typeof liveKey === 'string' && liveKey) {
      autoImportAttempted.current = true;
      void handleJoinChoir(liveKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-import de un QR offline (?d=<payload>). Esperamos a que el catálogo
  // esté cargado para poder resolver categoría+número → filename.
  const offlineImportAttempted = useRef(false);
  useEffect(() => {
    if (offlineImportAttempted.current) return;
    const params: any = (route?.params as any) || {};
    const payload = params.d;
    if (typeof payload === 'string' && payload && allSongsData) {
      offlineImportAttempted.current = true;
      const { songs, missing } = decodeOfflinePlaylist(
        payload,
        offlineFilenameResolver,
      );
      if (songs.length === 0) {
        toast.show({ label: 'No se pudo leer la playlist del QR' });
        return;
      }
      sharing.replaceWithUndo(songs, 'Playlist del QR importada', null);
      if (missing > 0) {
        toast.show({
          label: `${missing} canción(es) del QR no están en este dispositivo`,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSongsData]);

  // --- Reorden manual -------------------------------------------------------

  // Canción sobre la que está abierto el menú contextual (clic derecho en web).
  const [menuFilename, setMenuFilename] = useState<string | null>(null);

  const handleMoveUp = useCallback(
    (filename: string) => {
      const idx = flatSelectedSongs.findIndex((s) => s.filename === filename);
      if (idx > 0) moveSong(filename, idx - 1);
    },
    [flatSelectedSongs, moveSong],
  );

  const handleMoveDown = useCallback(
    (filename: string) => {
      const idx = flatSelectedSongs.findIndex((s) => s.filename === filename);
      if (idx >= 0 && idx < flatSelectedSongs.length - 1) {
        moveSong(filename, idx + 1);
      }
    },
    [flatSelectedSongs, moveSong],
  );

  // --- Acciones del sheet ---------------------------------------------------

  const hasSongs = flatSelectedSongs.length > 0;

  const sheetSections = useMemo<PlaylistActionSection[]>(() => {
    const exportar: PlaylistAction[] = [
      {
        id: 'share-text',
        icon: 'share',
        label:
          Platform.OS === 'web' ||
          Platform.OS === 'windows' ||
          Platform.OS === 'macos'
            ? 'Copiar lista al portapapeles'
            : 'Compartir mensaje con las canciones',
        description: 'Texto para Whatsapp con canción, tono y número',
        onPress: handleShareText,
      },
      {
        id: 'export-pdf',
        icon: 'picture-as-pdf',
        label: 'Exportar a PDF',
        description: 'Letra y acordes con un formato bonito',
        onPress: handleStartExportPdf,
      },
    ];

    // El coro es ahora la vía principal: nadie tiene que acordarse de códigos.
    const coroPlaylists: PlaylistAction[] = [
      {
        id: 'choir-hub',
        icon: 'groups',
        label: sharing.myChoir
          ? `Coro: ${sharing.myChoir.name}`
          : 'Elegir mi coro',
        description: sharing.myChoir
          ? 'Importar la última, ver el histórico o dirigir en vivo'
          : 'Las playlists cuelgan del coro. Elígelo una vez y listo.',
        onPress: () => sharing.openSheet(sharing.myChoir ? 'home' : 'choose'),
      },
    ];
    if (hasSongs) {
      coroPlaylists.push({
        id: 'choir-save',
        icon: 'cloud-upload',
        label: link
          ? 'Guardar cambios en el coro'
          : 'Subir esta playlist al coro',
        description: link
          ? sharing.isSynced
            ? `«${link.name ?? link.code}» ya está al día`
            : `Actualizar «${link.name ?? link.code}» o subir una nueva`
          : `${flatSelectedSongs.length} canciones para todo el coro`,
        onPress: () => sharing.openSheet(sharing.myChoir ? 'save' : 'choose'),
      });
    }

    // Códigos y QR: se mantienen, pero como opción secundaria.
    const nube: PlaylistAction[] = [
      {
        id: 'download-cloud',
        icon: 'pin',
        label: 'Importar con un código',
        description: 'Los 4 dígitos que te han pasado (o escanear un QR)',
        onPress: () => setCodeDialog({ variant: 'cloud-download' }),
      },
      {
        id: 'upload-cloud',
        icon: 'cloud-upload',
        label: 'Subir con un código suelto',
        description: link
          ? `Sin coro. Código actual: ${link.code}`
          : 'Sin coro: solo quien tenga el código podrá importarla',
        onPress: () => setCodeDialog({ variant: 'cloud-upload' }),
      },
    ];
    if (offlineUrl) {
      // Un único botón de QR: dentro, el modal ofrece dos pestañas
      // (con código / sin conexión). Si todavía no se ha subido, la pestaña
      // online invita a subir la playlist.
      nube.push({
        id: 'show-qr',
        icon: 'qr-code-2',
        label: 'Compartir QR de la playlist',
        description: 'Dos pestañas: con código (internet) o sin conexión',
        onPress: () =>
          setQrModal({
            title: link
              ? `${link.name ?? 'Playlist'} · #${link.code}`
              : 'Compartir playlist',
            url: link ? `${WEB_BASE_URL}/playlist?p=${link.code}` : undefined,
            code: link?.code,
            offlineUrl,
            defaultMode: link ? 'online' : 'offline',
          }),
      });
    }
    if (sharing.myChoir) {
      nube.push({
        id: 'share-choir-link',
        icon: 'link',
        label: 'Enlace del coro (siempre la última)',
        description: `Quien lo abra importa la última playlist de ${sharing.myChoir.name}`,
        onPress: () =>
          setQrModal({
            title: `${sharing.myChoir!.name} · última playlist`,
            url: `${WEB_BASE_URL}/playlist?coro=${sharing.myChoir!.id}`,
          }),
      });
    }
    // Cambiar el código o borrar de la nube solo tiene sentido sobre una
    // playlist que subiste tú: sobre la de otra persona sería un destrozo
    // silencioso (para eso está "actualizar", que sí pide la contraseña).
    if (link?.owned) {
      nube.push(
        {
          id: 'change-cloud-code',
          icon: 'edit',
          label: 'Cambiar código de la playlist',
          description: `Actual: ${link.code}`,
          onPress: () =>
            setCodeDialog({
              variant: 'change-code',
              initial: link.code,
            }),
        },
        {
          id: 'delete-cloud',
          icon: 'cloud-off',
          label: 'Borrar playlist de la nube',
          variant: 'danger',
          onPress: handleDeleteFromCloud,
        },
      );
    }

    const archivo: PlaylistAction[] = [
      {
        id: 'export-file',
        icon: 'file-upload',
        label: 'Exportar archivo (.mcm)',
        description: 'Incluye tonos cambiados y orden personalizado',
        onPress: handleStartExportFile,
      },
      {
        id: 'import-file',
        icon: 'file-download',
        label: 'Importar archivo (.mcm)',
        onPress: handleImportFile,
      },
    ];

    const coro: PlaylistAction[] =
      choir.mode === 'off'
        ? [
            {
              id: 'choir-live-hub',
              icon: 'campaign',
              label: 'Dirigir o seguir a mi coro',
              description: sharing.myChoir
                ? `Sin códigos: se entra por ${sharing.myChoir.name}`
                : 'Elige tu coro y dirige (o síguele) en vivo',
              onPress: () =>
                sharing.openSheet(sharing.myChoir ? 'home' : 'choose'),
            },
            {
              id: 'choir-start',
              icon: 'pin',
              label: 'Sesión suelta con código',
              description: 'Para un ensayo puntual fuera de tu coro',
              onPress: () => setCodeDialog({ variant: 'choir-start' }),
            },
            {
              id: 'choir-join',
              icon: 'headphones',
              label: 'Unirse con un código',
              description:
                'Introduces un código y sigues las canciones del líder',
              onPress: () => setCodeDialog({ variant: 'choir-join' }),
            },
          ]
        : (() => {
            // La sesión puede colgar de un coro (clave = id del coro) o ser
            // suelta (clave = 4 dígitos). No es lo mismo: a una sesión de coro
            // NO se le puede cambiar el código, porque la clave *es* el coro —
            // hacerlo la desataría de él y nadie del coro la encontraría.
            const key = choir.code ?? '';
            const esCoro = isChoirId(key);
            const nombre = choir.session?.choirName ?? sharing.myChoir?.name;
            const acciones: PlaylistAction[] = [
              {
                id: 'show-qr-choir',
                icon: 'qr-code-2',
                label: 'Ver QR de la sesión',
                description: 'Quien lo escanee entra directamente',
                onPress: () =>
                  setQrModal({
                    title: esCoro
                      ? `${nombre ?? 'Coro'} · en vivo`
                      : `Coro · Código ${key}`,
                    url: esCoro
                      ? `${WEB_BASE_URL}/coro?coro=${key}`
                      : `${WEB_BASE_URL}/coro?c=${key}`,
                    code: esCoro ? undefined : key,
                  }),
              },
            ];
            if (!esCoro) {
              acciones.push({
                id: 'choir-change-code',
                icon: 'edit',
                label: 'Cambiar código de la sesión',
                description: `Actual: ${key}${choir.mode === 'slave' ? ' (solo el líder puede cambiarlo)' : ''}`,
                onPress: () =>
                  setCodeDialog({ variant: 'change-code', initial: key }),
                disabled: choir.mode !== 'master',
              });
            }
            acciones.push({
              id: 'choir-leave',
              icon: 'logout',
              label:
                choir.mode === 'master'
                  ? 'Cerrar la sesión en vivo'
                  : 'Salir del coro en vivo',
              variant: 'danger',
              onPress: () => choir.leave(),
            });
            return acciones;
          })();

    // Vaciar ya no pasa por un diálogo de confirmación: se vacía y el toast
    // deja 10 s para deshacerlo. Empezar una lista de cero es de las cosas que
    // más se hacen y era de las más pesadas (menú → confirmar → aceptar).
    const peligro: PlaylistAction[] = [
      {
        id: 'clear',
        icon: 'delete-outline',
        label: 'Vaciar playlist y empezar de cero',
        description: 'Se puede deshacer justo después',
        variant: 'danger',
        onPress: sharing.clearWithUndo,
      },
    ];

    // Sin canciones no se puede compartir, exportar, subir ni vaciar NADA: esas
    // opciones se quitan en vez de dejarse muertas (una lista llena de cosas
    // que no hacen nada es peor que una lista corta). Se quedan las que SÍ
    // funcionan con la lista vacía: importar, el hub del coro, compartir el
    // enlace del coro (que no depende de tu selección) y el modo coro en vivo,
    // donde las canciones las pone el líder después.
    const VIVAS_SIN_CANCIONES = new Set([
      'download-cloud',
      'choir-hub',
      'share-choir-link',
    ]);
    const soloImportar = <T extends PlaylistAction>(as: T[]) =>
      as.filter(
        (a) => a.id.startsWith('import') || VIVAS_SIN_CANCIONES.has(a.id),
      );

    // Orden por frecuencia de uso real: traer/guardar la del coro es lo que se
    // hace cada semana; exportar el mensaje de WhatsApp o el PDF, casi igual de
    // a menudo; el coro en vivo, los domingos; y los códigos, los QR y los
    // archivos son la trastienda para casos raros.
    return [
      { title: 'Mi coro', actions: coroPlaylists },
      { title: 'Exportar y compartir', actions: hasSongs ? exportar : [] },
      { title: 'Coro en vivo', actions: coro },
      {
        title: 'Códigos y QR',
        actions: hasSongs ? nube : soloImportar(nube),
      },
      { title: 'Archivo', actions: hasSongs ? archivo : soloImportar(archivo) },
      { actions: hasSongs ? peligro : [] },
    ];
  }, [
    hasSongs,
    handleShareText,
    handleStartExportFile,
    handleStartExportPdf,
    handleImportFile,
    link,
    sharing,
    flatSelectedSongs.length,
    offlineUrl,
    choir,
    handleDeleteFromCloud,
  ]);

  // --- Header ---------------------------------------------------------------

  /** Abre la hoja del coro por el paso que toque según si ya hay coro elegido. */
  const openChoirSheet = useCallback(
    (step: 'home' | 'save' = 'home') =>
      sharing.openSheet(sharing.myChoir ? step : 'choose'),
    [sharing],
  );

  const headerIconColor =
    Platform.OS === 'ios' || Platform.OS === 'web'
      ? isDark
        ? '#ffffff'
        : '#1a1a1a'
      : '#fff';

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          {/* El coro a un toque: es el camino principal para traer y dejar
              playlists, así que no puede vivir escondido en el menú. */}
          <TouchableOpacity
            onPress={() => openChoirSheet()}
            style={styles.headerIconBtn}
            hitSlop={6}
            accessibilityLabel="Playlists del coro"
          >
            <MaterialIcons name="groups" size={24} color={headerIconColor} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowActions(true)}
            style={styles.headerIconBtn}
            hitSlop={6}
            accessibilityLabel="Acciones"
          >
            <MaterialIcons
              name="more-horiz"
              size={24}
              color={headerIconColor}
            />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, headerIconColor, styles, openChoirSheet]);

  // --- Render ---------------------------------------------------------------

  const submitForVariant = (
    variant: CodeDialogVariant,
    initial?: string,
  ): ((code: string, name?: string) => Promise<void>) => {
    switch (variant) {
      case 'cloud-upload':
        return handleUploadToCloud;
      case 'cloud-download':
        return handleDownloadFromCloud;
      case 'choir-start':
        return handleStartChoir;
      case 'choir-join':
        return handleJoinChoir;
      case 'change-code':
        // El mismo diálogo sirve para renombrar el código de la playlist y el
        // de la sesión de coro. Lo desambigua el código con el que se abrió:
        // si es el de la sesión en curso, estamos cambiando el del coro.
        return initial && initial === choir.code && choir.mode === 'master'
          ? handleChangeChoirCode
          : link
            ? handleChangeCloudCode
            : async () => {};
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyContent}>
        <View style={styles.emptyIconContainer}>
          <MaterialIcons
            name="queue-music"
            size={56}
            color={isDark ? '#636366' : '#C7C7CC'}
          />
        </View>
        <Text style={styles.emptyTitle}>Sin canciones seleccionadas</Text>
        <Text style={styles.emptyDescription}>
          Desliza una canción hacia la izquierda para añadirla o usa el botón +
          en la pantalla de detalle.
        </Text>
      </View>
      <View style={{ gap: 10, marginBottom: Platform.OS === 'ios' ? 100 : 20 }}>
        {/* Con la lista vacía, lo primero que quiere casi todo el mundo es
            traerse la del coro: va la primera y sin pedir ningún código. */}
        <PressableFeedback
          onPress={() => openChoirSheet()}
          style={styles.importButton}
        >
          <PressableFeedback.Highlight />
          <MaterialIcons
            name="groups"
            size={20}
            color={isDark ? '#7AB3FF' : '#253883'}
          />
          <Text style={styles.importButtonText}>
            {sharing.myChoir
              ? `Traer la playlist de ${sharing.myChoir.name}`
              : 'Elegir mi coro e importar'}
          </Text>
        </PressableFeedback>
        <PressableFeedback
          onPress={() => setCodeDialog({ variant: 'cloud-download' })}
          style={styles.importButton}
        >
          <PressableFeedback.Highlight />
          <MaterialIcons
            name="pin"
            size={20}
            color={isDark ? '#7AB3FF' : '#253883'}
          />
          <Text style={styles.importButtonText}>Tengo un código o un QR</Text>
        </PressableFeedback>
        <PressableFeedback
          onPress={handleImportFile}
          style={styles.importButton}
        >
          <PressableFeedback.Highlight />
          <MaterialIcons
            name="file-download"
            size={20}
            color={isDark ? '#7AB3FF' : '#253883'}
          />
          <Text style={styles.importButtonText}>Importar desde archivo</Text>
        </PressableFeedback>
      </View>
    </View>
  );

  const headerComponent = useMemo(
    () => (
      <PlaylistHeaderBar
        visibleCount={visibleCount}
        link={link}
        isSynced={sharing.isSynced}
        onPressStatus={() => openChoirSheet('save')}
        onClear={sharing.clearWithUndo}
        viewMode={viewMode}
        setViewMode={setViewMode}
        styles={styles}
      />
    ),
    [
      visibleCount,
      link,
      sharing.isSynced,
      sharing.clearWithUndo,
      openChoirSheet,
      viewMode,
      setViewMode,
      styles,
    ],
  );

  // ⚡ Bolt: Memoized render functions for FlatList items using `useCallback`.
  // This preserves referential equality across parent renders, preventing the entire list
  // from unnecessarily unmounting and remounting its child components when state changes.
  const renderCategoryGroup = useCallback(
    ({ item }: { item: CategorizedSongs }) => (
      <View style={styles.categoryContainer}>
        <Text style={styles.categoryTitle}>{item.categoryTitle}</Text>
        {item.data.map((song) => {
          const isNow = nowPlayingFilename === song.filename;
          return (
            <PlaylistRow
              key={song.filename}
              song={song}
              transpose={song.transpose}
              capoOverride={song.capoOverride}
              isNowPlaying={isNow}
              onPress={() => handleSongPress(song)}
              onRemove={() => removeSong(song.filename)}
            />
          );
        })}
      </View>
    ),
    [
      nowPlayingFilename,
      handleSongPress,
      removeSong,
      styles.categoryContainer,
      styles.categoryTitle,
    ],
  );

  const manualRowProps = useCallback(
    (
      item: (typeof flatSelectedSongs)[number],
      index: number,
    ): React.ComponentProps<typeof PlaylistRow> => ({
      song: item,
      transpose: item.transpose,
      capoOverride: item.capoOverride,
      position: index + 1,
      showReorderControls: true,
      canMoveUp: index > 0,
      canMoveDown: index < flatSelectedSongs.length - 1,
      onMoveUp: () => handleMoveUp(item.filename),
      onMoveDown: () => handleMoveDown(item.filename),
      onContextMenu: () => setMenuFilename(item.filename),
      isNowPlaying: nowPlayingFilename === item.filename,
      onPress: () => handleSongPress(item),
      onRemove: () => removeSong(item.filename),
    }),
    [
      flatSelectedSongs.length,
      handleMoveUp,
      handleMoveDown,
      handleSongPress,
      removeSong,
      nowPlayingFilename,
      setMenuFilename,
    ],
  );

  const renderManualItem = useCallback(
    ({
      item,
      index,
    }: {
      item: (typeof flatSelectedSongs)[number];
      index: number;
    }) => <PlaylistRow {...manualRowProps(item, index)} />,
    [manualRowProps],
  );

  const renderDraggableManualItem = useCallback(
    ({
      item,
      index,
    }: {
      item: (typeof flatSelectedSongs)[number];
      index: number;
    }) => <DraggableManualRow {...manualRowProps(item, index)} />,
    [manualRowProps],
  );

  const handleReorder = ({ from, to }: ReorderableListReorderEvent) => {
    const song = flatSelectedSongs[from];
    if (!song || from === to) return;
    h.select();
    moveSong(song.filename, to);
  };

  const isEmpty = selectedSongs.length === 0;

  if (loading && selectedSongs.length === 0 && isHydrated) {
    return <ProgressWithMessage message="Cargando canciones..." />;
  }

  return (
    <View style={styles.container}>
      {isEmpty ? (
        <>
          <ChoirSessionBanner />
          {renderEmptyState()}
        </>
      ) : viewMode === 'manual' ? (
        Platform.OS === 'web' ? (
          // En web no hay drag & drop (la lista reordenable usa gestos
          // nativos); se reordena con las flechas ↑/↓ de cada fila.
          <FlatList
            data={flatSelectedSongs}
            renderItem={renderManualItem}
            keyExtractor={(it) => it.filename}
            ListHeaderComponent={headerComponent}
            contentContainerStyle={styles.listContentContainer}
            contentInsetAdjustmentBehavior="automatic"
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <ReorderableList
            data={flatSelectedSongs}
            onReorder={handleReorder}
            renderItem={renderDraggableManualItem}
            keyExtractor={(it) => it.filename}
            ListHeaderComponent={headerComponent}
            contentContainerStyle={[
              styles.listContentContainer,
              { paddingTop: reorderableTopInset },
            ]}
            contentInsetAdjustmentBehavior="never"
            showsVerticalScrollIndicator={false}
          />
        )
      ) : (
        <FlatList
          data={categorized}
          renderItem={renderCategoryGroup}
          keyExtractor={(it) => it.categoryKey}
          ListHeaderComponent={headerComponent}
          contentContainerStyle={styles.listContentContainer}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
        />
      )}

      <PlaylistActionsBottomSheet
        visible={showActions}
        sections={sheetSections}
        onClose={() => setShowActions(false)}
        title={
          choir.mode !== 'off'
            ? `Coro ${choir.code} · ${choir.mode === 'master' ? 'Maestro' : 'Esclavo'}`
            : 'Acciones'
        }
      />

      {/* Menú contextual (clic derecho en web) sobre una canción de la lista */}
      {(() => {
        const idx = menuFilename
          ? flatSelectedSongs.findIndex((s) => s.filename === menuFilename)
          : -1;
        const song = idx >= 0 ? flatSelectedSongs[idx] : null;
        const actions: ContextMenuAction[] = song
          ? [
              {
                key: 'up',
                label: 'Subir',
                icon: 'keyboard-arrow-up',
                disabled: idx <= 0,
                onPress: () => handleMoveUp(song.filename),
              },
              {
                key: 'down',
                label: 'Bajar',
                icon: 'keyboard-arrow-down',
                disabled: idx >= flatSelectedSongs.length - 1,
                onPress: () => handleMoveDown(song.filename),
              },
              {
                key: 'remove',
                label: 'Quitar de la lista',
                icon: 'remove-circle-outline',
                destructive: true,
                onPress: () => removeSong(song.filename),
              },
            ]
          : [];
        return (
          <ContextMenuSheet
            visible={menuFilename !== null}
            onClose={() => setMenuFilename(null)}
            title={song?.title.replace(/^\d+\.\s*/, '')}
            actions={actions}
          />
        );
      })()}

      {codeDialog ? (
        <CodeInputModal
          visible
          variant={codeDialog.variant}
          initialCode={codeDialog.initial}
          onClose={() => setCodeDialog(null)}
          onScanOffline={
            codeDialog.variant === 'cloud-download'
              ? handleScannedOfflinePlaylist
              : undefined
          }
          onScanChoir={
            codeDialog.variant === 'cloud-download'
              ? handleScannedChoirQr
              : undefined
          }
          onSubmit={async (code, name) => {
            const fn = submitForVariant(codeDialog.variant, codeDialog.initial);
            try {
              await fn(code, name);
            } catch (e: any) {
              if (e?.message === '__handled__') return;
              throw e;
            }
          }}
        />
      ) : null}

      {confirmDialog ? (
        <ConfirmChoiceModal
          visible
          title={confirmDialog.title}
          description={confirmDialog.description}
          actions={confirmDialog.actions}
          onClose={() => setConfirmDialog(null)}
        />
      ) : null}

      {qrModal ? (
        <ShareQrModal
          visible
          title={qrModal.title}
          url={qrModal.url}
          code={qrModal.code}
          offlineUrl={qrModal.offlineUrl}
          defaultMode={qrModal.defaultMode}
          onRequestUpload={handleQrRequestUpload}
          onClose={() => setQrModal(null)}
        />
      ) : null}

      {/* Hoja del coro: elegir coro, importar la última, histórico, guardar y
          dirigir/seguir en vivo. Es el camino principal; los códigos quedan
          como opción secundaria dentro del menú de acciones. */}
      <ChoirSheet
        visible={sharing.sheetStep !== null}
        initialStep={sharing.sheetStep ?? 'home'}
        myChoir={sharing.myChoir}
        onChooseChoir={sharing.setMyChoir}
        songCount={flatSelectedSongs.length}
        link={link}
        identity={sharing.identity}
        liveMode={choir.mode}
        liveKey={choir.code}
        onImport={(entry, c) => void sharing.importEntry(entry, c)}
        onSaveNew={(name, c) => void sharing.saveNew(name, c)}
        onSaveUpdate={sharing.saveUpdate}
        onLead={sharing.lead}
        onJoinLive={(c, session) => void sharing.joinLive(c, session)}
        onLeaveLive={sharing.leaveLive}
        onClose={sharing.closeSheet}
      />

      {/* Contraseña compartida ('coco'): machacar la playlist de otra persona
          o quitarle el mando al líder de un coro. */}
      {sharing.passwordRequest ? (
        <PasswordPromptModal
          visible
          title={sharing.passwordRequest.title}
          description={sharing.passwordRequest.description}
          expectedPassword={SHARED_PASSWORD}
          confirmLabel={sharing.passwordRequest.confirmLabel}
          onSuccess={sharing.passwordRequest.onSuccess}
          onClose={sharing.dismissPassword}
        />
      ) : null}

      {pendingOverwrite ? (
        <PasswordPromptModal
          visible
          title="Sobrescribir playlist"
          description={`Ya hay una playlist en el código ${pendingOverwrite.code}. Cualquiera puede machacarla con la contraseña del coro.`}
          expectedPassword={SHARED_PASSWORD}
          confirmLabel="Sobrescribir"
          onSuccess={() => void handleConfirmOverwrite()}
          onClose={() => setPendingOverwrite(null)}
        />
      ) : null}

      {/* Modal de exportar a archivo (nombre del .mcm). */}
      <Modal
        visible={showExportFileModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExportFileModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowExportFileModal(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Exportar playlist</Text>
                <Text style={styles.modalDescription}>
                  Elige un nombre para tu archivo
                </Text>
                <AppTextField
                  value={exportFileName}
                  onChangeText={setExportFileName}
                  placeholder="Playlist 7-ago"
                  autoFocus
                  selectTextOnFocus
                  style={styles.modalInput}
                  onSubmitEditing={() => {
                    if (exportFileName.trim()) handleConfirmExportFile();
                  }}
                  returnKeyType="done"
                />
                <Text style={styles.modalNote}>
                  Se exportará como archivo .mcm para compartirlo
                </Text>
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    onPress={() => setShowExportFileModal(false)}
                    style={[styles.modalBtn, styles.modalBtnSecondary]}
                  >
                    <Text style={styles.modalBtnSecondaryText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleConfirmExportFile}
                    disabled={!exportFileName.trim()}
                    style={[
                      styles.modalBtn,
                      styles.modalBtnPrimary,
                      !exportFileName.trim() && styles.modalBtnDisabled,
                    ]}
                  >
                    <Text style={styles.modalBtnPrimaryText}>Exportar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <ExportPdfModal
        visible={showExportPdfModal}
        initialName={exportPdfDefaultName}
        songCount={flatSelectedSongs.length}
        onClose={() => setShowExportPdfModal(false)}
        onSubmit={handleConfirmExportPdf}
      />
    </View>
  );
};

export default SelectedSongsScreen;
