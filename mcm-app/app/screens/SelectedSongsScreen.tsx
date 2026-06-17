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
  StyleSheet,
  Platform,
  Share,
  Modal,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { useToast } from '@/contexts/AppToastContext';
import { extractSongMedia } from '@/types/songMedia';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import {
  useSelectedSongs,
  SelectedSong,
} from '@/contexts/SelectedSongsContext';
import { useChoirSession } from '@/contexts/ChoirSessionContext';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { Colors } from '@/constants/colors';
import { radii } from '@/constants/uiStyles';
import { RootStackParamList } from '../(tabs)/cancionero';
import ProgressWithMessage from '@/components/ProgressWithMessage';

import { h } from '@/utils/haptics';
import PlaylistRow from '@/components/playlist/PlaylistRow';
import ReorderableList, {
  ReorderableListReorderEvent,
  useReorderableDrag,
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

import {
  cloudPlaylistExists,
  fetchCloudPlaylist,
  uploadCloudPlaylist,
  changeCloudPlaylistCode,
  deleteCloudPlaylist,
} from '@/services/cloudPlaylistService';
import {
  choirSessionExists,
  fetchChoirSession,
} from '@/services/choirSessionService';
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

/** Contraseña para sobrescribir una playlist en la nube que ya existe. */
const OVERWRITE_PASSWORD = 'coco';

type ViewMode = 'category' | 'manual';

/**
 * Fila del modo "Orden ajustado" dentro de `ReorderableList` (nativo):
 * long-press sobre la fila inicia el arrastre. `useReorderableDrag` solo
 * puede usarse dentro de una celda de la lista, por eso este wrapper.
 */
const DraggableManualRow: React.FC<React.ComponentProps<typeof PlaylistRow>> = (
  props,
) => {
  const drag = useReorderableDrag();
  return <PlaylistRow {...props} onLongPress={drag} />;
};

const SelectedSongsScreen: React.FC = () => {
  const {
    selectedSongs,
    isHydrated,
    clearSelection,
    addSong,
    removeSong,
    moveSong,
    replaceAll,
  } = useSelectedSongs();
  const choir = useChoirSession();
  const { settings } = useSettings();

  const navigation = useNavigation<SelectedSongsScreenNavigationProp>();
  const route = useRoute();
  const scheme = useColorScheme() || 'light';
  const isDark = scheme === 'dark';
  const layout = useResponsiveLayout();
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

  // Código de la última subida a la nube (para "cambiar código" / "borrar").
  // Persistido para sobrevivir al cierre de la app.
  const [lastUploadCode, setLastUploadCodeState] = useState<string | null>(
    null,
  );
  const LAST_UPLOAD_CODE_KEY = '@mcm_last_upload_code';
  useEffect(() => {
    AsyncStorage.getItem(LAST_UPLOAD_CODE_KEY).then((v) => {
      if (v) setLastUploadCodeState(v);
    });
  }, []);
  const setLastUploadCode = useCallback((code: string | null) => {
    setLastUploadCodeState(code);
    if (code) {
      AsyncStorage.setItem(LAST_UPLOAD_CODE_KEY, code).catch(() => {});
    } else {
      AsyncStorage.removeItem(LAST_UPLOAD_CODE_KEY).catch(() => {});
    }
  }, []);

  // Auto-import / auto-join si llegamos con ?p=XXXX o ?c=YYYY en web (deep link).
  const autoImportAttempted = useRef(false);
  useEffect(() => {
    if (autoImportAttempted.current) return;
    const params: any = (route?.params as any) || {};
    const playlistCode = params.p ?? params.code;
    const choirCode = params.c;

    if (typeof playlistCode === 'string' && /^\d{4}$/.test(playlistCode)) {
      autoImportAttempted.current = true;
      void handleDownloadFromCloud(playlistCode);
    } else if (typeof choirCode === 'string' && /^\d{4}$/.test(choirCode)) {
      autoImportAttempted.current = true;
      void handleJoinChoir(choirCode);
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
      askMergeOrReplace(songs);
      if (missing > 0) {
        toast.show({
          label: `${missing} canción(es) del QR no están en este dispositivo`,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSongsData]);

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
        console.error(e);
      }
    }
  }, [buildShareText, toast]);

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
      console.error('Error exportando playlist', err);
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
        console.error('Error exportando PDF', err);
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

  /** Muestra el confirmador "reemplazar / añadir / cancelar" tras una importación. */
  const askMergeOrReplace = useCallback(
    (imported: SelectedSong[]) => {
      if (selectedSongs.length === 0) {
        replaceAll(imported);
        toast.show({
          label: `Playlist importada (${imported.length} canciones)`,
        });
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
              replaceAll(imported);
              toast.show({ label: 'Playlist reemplazada' });
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
    [selectedSongs, replaceAll, addSong, toast],
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
      console.error('Error importando playlist', err);
      toast.show({ label: 'Error al importar' });
    }
  }, [importFromJson, askMergeOrReplace, toast]);

  // --- Nube -----------------------------------------------------------------

  const handleUploadToCloud = useCallback(
    async (code: string, name?: string) => {
      const exists = await cloudPlaylistExists(code);
      if (exists) {
        // El código ya tiene contenido (tuyo o de otra persona). Para
        // machacarlo pedimos la contraseña; también se puede elegir otro
        // código. Cerramos el diálogo de código para no apilar modales.
        setCodeDialog(null);
        setConfirmDialog({
          title: 'Código ocupado',
          description: `Ya hay una playlist subida con el código ${code}. Para sobrescribirla necesitas la contraseña.`,
          actions: [
            {
              label: 'Sobrescribir…',
              variant: 'danger',
              onPress: () => {
                setConfirmDialog(null);
                setPendingOverwrite({ code, name });
              },
            },
            {
              label: 'Elegir otro código',
              variant: 'primary',
              onPress: () => {
                setConfirmDialog(null);
                setCodeDialog({ variant: 'cloud-upload', initial: undefined });
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
      await uploadCloudPlaylist(code, selectedSongs, { name });
      setLastUploadCode(code);
      setCodeDialog(null);
      showUploadSuccess(code, name);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedSongs],
  );

  /** Subida tras validar la contraseña de sobrescritura. */
  const handleConfirmOverwrite = useCallback(async () => {
    const pending = pendingOverwrite;
    setPendingOverwrite(null);
    if (!pending) return;
    try {
      await uploadCloudPlaylist(pending.code, selectedSongs, {
        name: pending.name,
      });
      setLastUploadCode(pending.code);
      showUploadSuccess(pending.code, pending.name);
    } catch (e: any) {
      toast.show({ label: e?.message ?? 'Error al subir' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOverwrite, selectedSongs]);

  const showUploadSuccess = useCallback((code: string, name?: string) => {
    setQrModal({
      title: name
        ? `¡${name} subida! Código ${code}`
        : `¡Subida! Código ${code}`,
      url: `${WEB_BASE_URL}/playlist?p=${code}`,
      code,
    });
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
      const data = await fetchCloudPlaylist(code);
      if (!data) {
        throw new Error('No existe ninguna playlist con ese código');
      }
      setCodeDialog(null);
      askMergeOrReplace(data.songs);
    },
    [askMergeOrReplace],
  );

  const handleChangeCloudCode = useCallback(
    async (newCode: string) => {
      if (!lastUploadCode) return;
      await changeCloudPlaylistCode(lastUploadCode, newCode);
      setLastUploadCode(newCode);
      setCodeDialog(null);
      toast.show({ label: `Código cambiado a ${newCode}` });
    },
    [lastUploadCode, toast, setLastUploadCode],
  );

  const handleDeleteFromCloud = useCallback(async () => {
    if (!lastUploadCode) return;
    setConfirmDialog({
      title: `Borrar playlist ${lastUploadCode} de la nube`,
      description: 'Cualquiera con el código dejará de poder importarla.',
      actions: [
        {
          label: 'Borrar de la nube',
          variant: 'danger',
          onPress: async () => {
            setConfirmDialog(null);
            try {
              await deleteCloudPlaylist(lastUploadCode);
              setLastUploadCode(null);
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
  }, [lastUploadCode, toast, setLastUploadCode]);

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
                  await choir.startAsMaster(code, selectedSongs);
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
      await choir.startAsMaster(code, selectedSongs);
      setCodeDialog(null);
      showChoirSuccess(code);
    },
    [choir, selectedSongs, toast, showChoirSuccess],
  );

  const handleJoinChoir = useCallback(
    async (code: string) => {
      const session = await fetchChoirSession(code);
      if (!session) {
        throw new Error('No existe sesión con ese código');
      }
      // Importamos la playlist del maestro como nuestra selección base.
      replaceAll(session.playlist || []);
      await choir.joinAsSlave(code);
      setCodeDialog(null);
      toast.show({ label: `Conectado al coro ${code}` });
    },
    [choir, replaceAll, toast],
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

  // --- Reorden manual -------------------------------------------------------

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

    const nube: PlaylistAction[] = [
      {
        id: 'upload-cloud',
        icon: 'cloud-upload',
        label: 'Subir playlist (compartir código)',
        description: lastUploadCode
          ? `Código actual: ${lastUploadCode}`
          : 'Cualquiera con el código podrá importarla',
        onPress: () => setCodeDialog({ variant: 'cloud-upload' }),
      },
      {
        id: 'download-cloud',
        icon: 'cloud-download',
        label: 'Importar playlist con código',
        description: 'Introduce el código de 4 dígitos que te han pasado',
        onPress: () => setCodeDialog({ variant: 'cloud-download' }),
      },
    ];
    if (offlineUrl) {
      nube.push({
        id: 'show-qr-offline',
        icon: 'qr-code-scanner',
        label: 'Ver QR offline',
        description: 'Compártela a otro dispositivo sin internet (con la app)',
        onPress: () =>
          setQrModal({
            title: 'Playlist · Sin conexión',
            offlineUrl,
            url: lastUploadCode
              ? `${WEB_BASE_URL}/playlist?p=${lastUploadCode}`
              : undefined,
            code: lastUploadCode ?? undefined,
            defaultMode: 'offline',
          }),
      });
    }
    if (lastUploadCode) {
      nube.push(
        {
          id: 'show-qr-cloud',
          icon: 'qr-code-2',
          label: 'Ver QR de la playlist',
          description: 'Quien lo escanee abre la playlist directamente',
          onPress: () =>
            setQrModal({
              title: `Playlist · Código ${lastUploadCode}`,
              url: `${WEB_BASE_URL}/playlist?p=${lastUploadCode}`,
              code: lastUploadCode,
              offlineUrl,
            }),
        },
        {
          id: 'change-cloud-code',
          icon: 'edit',
          label: 'Cambiar código de la playlist',
          description: `Actual: ${lastUploadCode}`,
          onPress: () =>
            setCodeDialog({
              variant: 'change-code',
              initial: lastUploadCode,
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
              id: 'choir-start',
              icon: 'campaign',
              label: 'Iniciar sesión de coro (ser líder)',
              description:
                'Otros dispositivos te siguen con un código de 4 dígitos',
              onPress: () => setCodeDialog({ variant: 'choir-start' }),
            },
            {
              id: 'choir-join',
              icon: 'headphones',
              label: 'Unirse a sesión de coro',
              description:
                'Introduces un código y sigues las canciones del líder',
              onPress: () => setCodeDialog({ variant: 'choir-join' }),
            },
          ]
        : [
            {
              id: 'show-qr-choir',
              icon: 'qr-code-2',
              label: 'Ver QR del coro',
              description: 'Quien lo escanee se une al coro directamente',
              onPress: () =>
                setQrModal({
                  title: `Coro · Código ${choir.code}`,
                  url: `${WEB_BASE_URL}/coro?c=${choir.code}`,
                  code: choir.code ?? '',
                }),
            },
            {
              id: 'choir-change-code',
              icon: 'edit',
              label: 'Cambiar código del coro',
              description: `Actual: ${choir.code}${choir.mode === 'slave' ? ' (solo el líder puede cambiarlo)' : ''}`,
              onPress: () =>
                setCodeDialog({
                  variant: 'change-code',
                  initial: choir.code ?? undefined,
                }),
              disabled: choir.mode !== 'master',
            },
            {
              id: 'choir-leave',
              icon: 'logout',
              label:
                choir.mode === 'master'
                  ? 'Cerrar sesión de coro'
                  : 'Salir del coro',
              variant: 'danger',
              onPress: () => choir.leave(),
            },
          ];

    const peligro: PlaylistAction[] = [
      {
        id: 'clear',
        icon: 'delete-outline',
        label: 'Vaciar playlist',
        variant: 'danger',
        onPress: () => {
          setConfirmDialog({
            title: '¿Vaciar la playlist?',
            description: 'Se quitarán todas las canciones seleccionadas.',
            actions: [
              {
                label: 'Vaciar',
                variant: 'danger',
                onPress: () => {
                  clearSelection();
                  setConfirmDialog(null);
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
      },
    ];

    return [
      { title: 'Exportar y compartir', actions: exportar },
      { title: 'Playlist en la nube', actions: nube },
      { title: 'Archivo', actions: archivo },
      { title: 'Modo coro', actions: coro },
      { actions: peligro },
    ];
  }, [
    handleShareText,
    handleStartExportFile,
    handleStartExportPdf,
    handleImportFile,
    lastUploadCode,
    offlineUrl,
    choir,
    handleDeleteFromCloud,
    clearSelection,
  ]);

  // --- Header ---------------------------------------------------------------

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
  }, [navigation, headerIconColor, styles]);

  // --- Render ---------------------------------------------------------------

  if (loading && selectedSongs.length === 0 && isHydrated) {
    return <ProgressWithMessage message="Cargando canciones..." />;
  }

  const submitForVariant = (
    variant: CodeDialogVariant,
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
        return lastUploadCode
          ? handleChangeCloudCode
          : choir.mode === 'master'
            ? handleChangeChoirCode
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
        <PressableFeedback
          onPress={() => setCodeDialog({ variant: 'cloud-download' })}
          style={styles.importButton}
        >
          <PressableFeedback.Highlight />
          <MaterialIcons
            name="cloud-download"
            size={20}
            color={isDark ? '#7AB3FF' : '#253883'}
          />
          <Text style={styles.importButtonText}>
            Importar playlist con código
          </Text>
        </PressableFeedback>
        <PressableFeedback
          onPress={() => setCodeDialog({ variant: 'choir-join' })}
          style={styles.importButton}
        >
          <PressableFeedback.Highlight />
          <MaterialIcons
            name="headphones"
            size={20}
            color={isDark ? '#7AB3FF' : '#253883'}
          />
          <Text style={styles.importButtonText}>Unirme a un coro</Text>
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

  const renderHeaderBar = () => {
    return (
      <View>
        <ChoirSessionBanner />
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.selectionCount}>
              {selectedSongs.length}{' '}
              {selectedSongs.length === 1 ? 'canción' : 'canciones'}
            </Text>
            {lastUploadCode ? (
              <Text style={styles.subInfo}>
                ☁️ Guardada con código {lastUploadCode}
              </Text>
            ) : null}
          </View>
          {selectedSongs.length > 1 ? (
            <View style={styles.viewToggle}>
              <TouchableOpacity
                onPress={() => setViewMode('category')}
                style={[
                  styles.viewToggleBtn,
                  viewMode === 'category' && styles.viewToggleBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.viewToggleText,
                    viewMode === 'category' && styles.viewToggleTextActive,
                  ]}
                >
                  Por categoría
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setViewMode('manual')}
                style={[
                  styles.viewToggleBtn,
                  viewMode === 'manual' && styles.viewToggleBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.viewToggleText,
                    viewMode === 'manual' && styles.viewToggleTextActive,
                  ]}
                >
                  Orden ajustado
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  const renderCategoryGroup = ({ item }: { item: CategorizedSongs }) => (
    <View style={styles.categoryContainer}>
      <Text style={styles.categoryTitle}>{item.categoryTitle}</Text>
      {item.data.map((song) => {
        const isNow = choir.session?.current?.filename === song.filename;
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
  );

  const manualRowProps = (
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
    isNowPlaying: choir.session?.current?.filename === item.filename,
    onPress: () => handleSongPress(item),
    onRemove: () => removeSong(item.filename),
  });

  const renderManualItem = ({
    item,
    index,
  }: {
    item: (typeof flatSelectedSongs)[number];
    index: number;
  }) => <PlaylistRow {...manualRowProps(item, index)} />;

  const renderDraggableManualItem = ({
    item,
    index,
  }: {
    item: (typeof flatSelectedSongs)[number];
    index: number;
  }) => <DraggableManualRow {...manualRowProps(item, index)} />;

  const handleReorder = ({ from, to }: ReorderableListReorderEvent) => {
    const song = flatSelectedSongs[from];
    if (!song || from === to) return;
    h.select();
    moveSong(song.filename, to);
  };

  const isEmpty = selectedSongs.length === 0;

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
            ListHeaderComponent={renderHeaderBar()}
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
            ListHeaderComponent={renderHeaderBar()}
            contentContainerStyle={styles.listContentContainer}
            contentInsetAdjustmentBehavior="automatic"
            showsVerticalScrollIndicator={false}
          />
        )
      ) : (
        <FlatList
          data={categorized}
          renderItem={renderCategoryGroup}
          keyExtractor={(it) => it.categoryKey}
          ListHeaderComponent={renderHeaderBar()}
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

      {codeDialog ? (
        <CodeInputModal
          visible
          variant={codeDialog.variant}
          initialCode={codeDialog.initial}
          onClose={() => setCodeDialog(null)}
          onSubmit={async (code, name) => {
            const fn = submitForVariant(codeDialog.variant);
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
          onClose={() => setQrModal(null)}
        />
      ) : null}

      {pendingOverwrite ? (
        <PasswordPromptModal
          visible
          title="Sobrescribir playlist"
          description={`Vas a machacar la playlist con código ${pendingOverwrite.code}. Escribe la contraseña para confirmar.`}
          expectedPassword={OVERWRITE_PASSWORD}
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
                <TextInput
                  value={exportFileName}
                  onChangeText={setExportFileName}
                  placeholder="Playlist 7-ago"
                  placeholderTextColor={isDark ? '#636366' : '#A0A0A8'}
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

const createStyles = (
  scheme: 'light' | 'dark' | null,
  isWide: boolean = false,
  maxWidth: number = 9999,
) => {
  const isDark = scheme === 'dark';
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      marginRight: 4,
    },
    headerIconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 8,
      gap: 8,
    },
    selectionCount: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? '#8E8E93' : '#6B6B70',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    subInfo: {
      fontSize: 12,
      color: isDark ? '#7AB3FF' : '#253883',
      marginTop: 3,
      fontWeight: '600',
    },
    viewToggle: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
      borderRadius: 8,
      padding: 2,
    },
    viewToggleBtn: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 6,
    },
    viewToggleBtnActive: {
      backgroundColor: isDark ? '#1A2744' : '#FFFFFF',
      ...Platform.select({
        web: { boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
        default: {
          shadowColor: '#000',
          shadowOpacity: 0.1,
          shadowOffset: { width: 0, height: 1 },
          shadowRadius: 2,
          elevation: 1,
        },
      }),
    },
    viewToggleText: {
      fontSize: 12,
      fontWeight: '600',
      color: isDark ? '#AEAEB2' : '#636366',
    },
    viewToggleTextActive: {
      color: isDark ? '#7AB3FF' : '#253883',
      fontWeight: '700',
    },
    listContentContainer: {
      paddingBottom: Platform.OS === 'ios' ? 100 : 24,
      ...(isWide ? { maxWidth, width: '100%', alignSelf: 'center' } : null),
    },
    categoryContainer: {
      marginTop: 12,
      marginHorizontal: 16,
      backgroundColor: isDark ? '#2C2C2E' : '#fff',
      borderRadius: radii.lg,
      overflow: 'hidden',
      ...Platform.select({
        web: {
          boxShadow: isDark
            ? '0 1px 3px rgba(0,0,0,0.4)'
            : '0 1px 3px rgba(0,0,0,0.06)',
        },
        default: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: isDark ? 0.25 : 0.04,
          shadowRadius: 3,
          elevation: 1,
        },
      }),
    },
    categoryTitle: {
      fontSize: 14,
      fontWeight: '700',
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: isDark ? Colors.dark.card : '#F2F2F7',
      color: isDark ? '#AEAEB2' : '#636366',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    emptyContainer: {
      flex: 1,
      padding: 20,
      backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
      justifyContent: 'space-between',
      ...(isWide ? { maxWidth, width: '100%', alignSelf: 'center' } : null),
    },
    emptyContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    emptyIconContainer: {
      width: 100,
      height: 100,
      borderRadius: radii.full,
      backgroundColor: isDark ? '#2C2C2E' : '#fff',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
      ...Platform.select({
        web: {
          boxShadow: isDark
            ? '0 2px 8px rgba(0,0,0,0.3)'
            : '0 2px 8px rgba(0,0,0,0.06)',
        },
        default: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.25 : 0.06,
          shadowRadius: 8,
          elevation: 2,
        },
      }),
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: isDark ? '#EBEBF0' : '#1C1C1E',
      marginBottom: 8,
      textAlign: 'center',
      letterSpacing: -0.4,
    },
    emptyDescription: {
      fontSize: 15,
      color: isDark ? '#8E8E93' : '#636366',
      textAlign: 'center',
      lineHeight: 22,
    },
    importButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: radii.lg,
      backgroundColor: isDark ? '#1A2744' : '#E8F0FE',
      gap: 8,
    },
    importButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#7AB3FF' : '#253883',
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    modalCard: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF',
      borderRadius: 18,
      padding: 22,
      ...Platform.select({
        web: { boxShadow: '0 12px 40px rgba(0,0,0,0.25)' },
        default: {
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 8 },
          elevation: 12,
        },
      }),
    },
    modalTitle: {
      fontSize: 19,
      fontWeight: '700',
      color: isDark ? '#F5F5F7' : '#1C1C1E',
      letterSpacing: -0.3,
      marginBottom: 6,
    },
    modalDescription: {
      fontSize: 14,
      color: isDark ? '#A0A0A8' : '#6B6B70',
      marginBottom: 14,
    },
    modalInput: {
      borderWidth: 1,
      borderColor: isDark ? '#3A3A3C' : '#D1D1D6',
      borderRadius: radii.md,
      paddingVertical: 12,
      paddingHorizontal: 14,
      fontSize: 16,
      marginBottom: 8,
      backgroundColor: isDark ? '#1C1C1E' : '#F8F8FA',
      color: isDark ? '#F5F5F7' : '#1C1C1E',
    },
    modalNote: {
      fontSize: 12,
      color: isDark ? '#636366' : '#8E8E93',
      marginBottom: 18,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'flex-end',
    },
    modalBtn: {
      paddingVertical: 11,
      paddingHorizontal: 18,
      borderRadius: 10,
      minWidth: 100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalBtnSecondary: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F2F2F7',
    },
    modalBtnSecondaryText: {
      fontSize: 15,
      fontWeight: '600',
      color: isDark ? '#F5F5F7' : '#1C1C1E',
    },
    modalBtnPrimary: {
      backgroundColor: '#253883',
    },
    modalBtnPrimaryText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    modalBtnDisabled: {
      opacity: 0.45,
    },
  });
};

export default SelectedSongsScreen;
