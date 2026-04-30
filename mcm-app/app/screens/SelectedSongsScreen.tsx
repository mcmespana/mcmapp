import React, {
  useEffect,
  useState,
  useLayoutEffect,
  useCallback,
  useMemo,
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
import { useToast, PressableFeedback } from 'heroui-native';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { useSelectedSongs } from '../../contexts/SelectedSongsContext';
import SongListItem from '../../components/SongListItem';
import { IconSymbol } from '../../components/ui/IconSymbol';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { RootStackParamList } from '../(tabs)/cancionero';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';
import { radii, shadows } from '@/constants/uiStyles';

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
  categoryTitle: string;
  data: Song[];
}

type SelectedSongsScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'SongDetail'
>;

const SelectedSongsScreen: React.FC = () => {
  const { selectedSongs, clearSelection, addSong } = useSelectedSongs();
  const navigation = useNavigation<SelectedSongsScreenNavigationProp>();
  const scheme = useColorScheme() || 'light';
  const isDark = scheme === 'dark';
  const styles = useMemo(() => createStyles(scheme), [scheme]);
  const { data: allSongsData, loading } = useFirebaseData<
    Record<string, { categoryTitle: string; songs: Song[] }>
  >('songs', 'songs');
  const [categorizedSelectedSongs, setCategorizedSelectedSongs] = useState<
    CategorizedSongs[]
  >([]);
  const { toast } = useToast();
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFileName, setExportFileName] = useState('');

  useEffect(() => {
    const processSongs = () => {
      if (!selectedSongs || selectedSongs.length === 0) {
        setCategorizedSelectedSongs([]);
        return;
      }

      if (!allSongsData) {
        setCategorizedSelectedSongs([]);
        return;
      }

      const categories: CategorizedSongs[] = [];
      for (const categoryName in allSongsData) {
        const songsInCategory = (
          allSongsData as Record<
            string,
            { categoryTitle: string; songs: Song[] }
          >
        )[categoryName].songs;
        const selectedInCategory = songsInCategory.filter((song) =>
          selectedSongs.includes(song.filename),
        );

        if (selectedInCategory.length > 0) {
          categories.push({
            categoryTitle: (
              allSongsData as Record<
                string,
                { categoryTitle: string; songs: Song[] }
              >
            )[categoryName].categoryTitle,
            data: selectedInCategory,
          });
        }
      }
      categories.sort((a, b) => a.categoryTitle.localeCompare(b.categoryTitle));
      setCategorizedSelectedSongs(categories);
    };

    processSongs();
  }, [selectedSongs, allSongsData]);

  const handleExport = useCallback(() => {
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

    const formattedSongLines: string[] = [];

    categorizedSelectedSongs.forEach((category) => {
      const categoryLetter = category.categoryTitle.charAt(0).toUpperCase();

      category.data.forEach((song) => {
        if (selectedSongs.includes(song.filename)) {
          const songTitleClean = song.title.replace(/^\d+\.\s*/, '');

          let chordCapoString = '';
          if (song.key) {
            chordCapoString = `\`${song.key}\``;
            if (song.capo && song.capo > 0) {
              chordCapoString += ` \`C/${song.capo}\``;
            }
          }

          const songIdMatch = song.title.match(/^\d+/);
          const songId = songIdMatch ? songIdMatch[0] : '??';

          let line = `*${categoryLetter}.* ${songTitleClean}`;
          if (chordCapoString) {
            line += ` · ${chordCapoString}`;
          }
          line += ` · *[#${songId}]*`;
          if (song.author) {
            line += ` · ${song.author}`;
          }
          formattedSongLines.push(line);
        }
      });
    });

    const finalText = [header, ...formattedSongLines].join('\n');

    if (
      Platform.OS === 'web' ||
      Platform.OS === 'windows' ||
      Platform.OS === 'macos'
    ) {
      try {
        Clipboard.setStringAsync(finalText);
        toast.show({ label: 'Lista copiada al portapapeles' });
      } catch (error) {
        console.error('Error copying to clipboard:', error);
        toast.show({ label: 'Error al copiar la lista' });
      }
    } else {
      try {
        Share.share({
          message: finalText,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    }
  }, [categorizedSelectedSongs, selectedSongs]);

  const handleShareFile = useCallback(async () => {
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
    const defaultFileName = `Playlist ${dateStr}`;

    setExportFileName(defaultFileName);
    setShowExportModal(true);
  }, []);

  const handleConfirmExport = useCallback(async () => {
    try {
      const fileName = `${exportFileName}.mcm`;

      if (Platform.OS === 'web') {
        const blob = new Blob([JSON.stringify(selectedSongs)], {
          type: 'application/octet-stream',
        });
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
        await FileSystem.writeAsStringAsync(
          path,
          JSON.stringify(selectedSongs),
          {
            encoding: FileSystem.EncodingType.UTF8,
          },
        );
        await Sharing.shareAsync(path, {
          mimeType: 'application/octet-stream',
          dialogTitle: 'Compartir playlist',
          UTI: 'com.mcmespana.mcmapp.playlist',
        });
      }

      setShowExportModal(false);
      toast.show({ label: 'Playlist exportada' });
    } catch (err) {
      console.error('Error sharing file', err);
      setShowExportModal(false);
      toast.show({ label: 'Error al exportar' });
    }
  }, [selectedSongs, exportFileName]);

  const handleImportFile = useCallback(async () => {
    const validExtensions = ['.mcm', '.json', '.mcmsongs'];
    const isValidFile = (name: string) =>
      validExtensions.some((ext) => name.toLowerCase().endsWith(ext));

    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.mcm,.json,.mcmsongs';
        input.onchange = async () => {
          if (!input.files || input.files.length === 0) return;
          const file = input.files[0];
          if (file.name && !isValidFile(file.name)) {
            toast.show({ label: 'Selecciona un archivo .mcm' });
            return;
          }
          const text = await file.text();
          try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) {
              if (parsed.length === 0) {
                toast.show({ label: 'El archivo está vacío' });
                return;
              }
              parsed.forEach((fn: string) => addSong(fn));
              toast.show({ label: 'Playlist importada' });
            } else {
              toast.show({ label: 'Formato de archivo inválido' });
            }
          } catch (parseError) {
            console.error('Error parsing JSON:', parseError);
            toast.show({ label: 'El archivo no es un JSON válido' });
          }
        };
        input.click();
      } else {
        const res = await DocumentPicker.getDocumentAsync({
          type: ['application/json', 'application/octet-stream'],
        });
        if (res.canceled || !res.assets || res.assets.length === 0) return;
        const file = res.assets[0];
        if (file.name && !isValidFile(file.name)) {
          toast.show({ label: 'Selecciona un archivo .mcm' });
          return;
        }
        const content = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        try {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            if (parsed.length === 0) {
              toast.show({ label: 'El archivo está vacío' });
              return;
            }
            parsed.forEach((fn: string) => addSong(fn));
            toast.show({ label: 'Playlist importada' });
          } else {
            toast.show({ label: 'Formato de archivo inválido' });
          }
        } catch (parseError) {
          console.error('Error parsing JSON:', parseError);
          toast.show({ label: 'El archivo no es un JSON válido' });
        }
      }
    } catch (err) {
      console.error('Error importing playlist', err);
      toast.show({ label: 'Error al importar' });
    }
  }, [addSong]);

  const handleSongPress = (song: Song) => {
    if (!allSongsData) return;

    let completeSong: Song | undefined;
    for (const cat of Object.values(allSongsData)) {
      completeSong = cat.songs.find((s) => s.filename === song.filename);
      if (completeSong) break;
    }

    if (!completeSong) {
      console.error('Song not found in allSongsData:', song.filename);
      return;
    }

    const allSelected: Song[] = [];
    let index = -1;
    for (const cat of categorizedSelectedSongs) {
      for (const s of cat.data) {
        if (s.filename === completeSong.filename) {
          index = allSelected.length;
        }
        allSelected.push(s);
      }
    }

    navigation.navigate('SongDetail', {
      filename: completeSong.filename,
      title: completeSong.title,
      ...(completeSong.author && { author: completeSong.author }),
      ...(completeSong.key && { key: completeSong.key }),
      ...(typeof completeSong.capo !== 'undefined' && {
        capo: completeSong.capo,
      }),
      content: completeSong.content || '',
      navigationList: allSelected,
      currentIndex: index,
      source: 'selection',
      firebaseCategory: (completeSong as any).originalCategoryKey || 'entrada',
    });
  };

  const renderCategory = ({ item }: { item: CategorizedSongs }) => (
    <View style={styles.categoryContainer}>
      <Text style={styles.categoryTitle}>{item.categoryTitle}</Text>
      {item.data
        .filter(
          (song): song is Song & { filename: string } =>
            song &&
            typeof song.filename === 'string' &&
            song.filename.length > 0,
        )
        .map((song) => (
          <SongListItem
            key={song.filename}
            song={song}
            onPress={handleSongPress}
          />
        ))}
    </View>
  );

  const headerIconColor =
    Platform.OS === 'ios'
      ? '#1a1a1a'
      : Platform.OS === 'web'
        ? '#1a1a1a'
        : '#fff';

  useLayoutEffect(() => {
    if (selectedSongs.length > 0) {
      const isDesktopLike =
        Platform.OS === 'web' ||
        Platform.OS === 'windows' ||
        Platform.OS === 'macos';
      navigation.setOptions({
        headerRight: () => (
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={handleExport}
              style={styles.headerIconBtn}
              hitSlop={6}
              accessibilityLabel={
                isDesktopLike
                  ? 'Copiar lista al portapapeles'
                  : 'Compartir lista'
              }
            >
              <IconSymbol
                name={isDesktopLike ? 'doc.on.doc' : 'square.and.arrow.up'}
                size={20}
                color={headerIconColor}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleShareFile}
              style={styles.headerIconBtn}
              hitSlop={6}
              accessibilityLabel="Exportar como archivo"
            >
              <MaterialIcons
                name="file-upload"
                size={22}
                color={headerIconColor}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleImportFile}
              style={styles.headerIconBtn}
              hitSlop={6}
              accessibilityLabel="Importar archivo"
            >
              <MaterialIcons
                name="file-download"
                size={22}
                color={headerIconColor}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={clearSelection}
              style={styles.headerIconBtn}
              hitSlop={6}
              accessibilityLabel="Borrar playlist"
            >
              <MaterialIcons name="delete-outline" size={22} color="#FF453A" />
            </TouchableOpacity>
          </View>
        ),
      });
    } else {
      navigation.setOptions({
        headerRight: () => null,
      });
    }
  }, [
    navigation,
    handleExport,
    handleShareFile,
    handleImportFile,
    clearSelection,
    selectedSongs.length,
    headerIconColor,
  ]);

  if (loading && selectedSongs.length === 0) {
    return <ProgressWithMessage message="Cargando canciones..." />;
  }

  if (selectedSongs.length === 0) {
    return (
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
            Desliza una canción hacia la izquierda para seleccionarla o usa el
            botón + en la pantalla de detalle.
          </Text>
        </View>
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
          <Text style={styles.importButtonText}>Importar playlist</Text>
        </PressableFeedback>
      </View>
    );
  }

  const ListCountHeader = () => (
    <View style={styles.countHeader}>
      <Text style={styles.selectionCount}>
        {selectedSongs.length}{' '}
        {selectedSongs.length === 1 ? 'canción' : 'canciones'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={categorizedSelectedSongs}
        renderItem={renderCategory}
        keyExtractor={(item) => item.categoryTitle}
        ListHeaderComponent={<ListCountHeader />}
        contentContainerStyle={styles.listContentContainer}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      />

      {/* Export modal — native RN Modal works reliably on web, iOS and Android.
          The previous heroui Dialog had inconsistent input focus and overlay
          behaviour on web that prevented downloads from firing. */}
      <Modal
        visible={showExportModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExportModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowExportModal(false)}>
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
                    if (exportFileName.trim()) handleConfirmExport();
                  }}
                  returnKeyType="done"
                />
                <Text style={styles.modalNote}>
                  Se exportará como archivo .mcm
                </Text>
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    onPress={() => setShowExportModal(false)}
                    style={[styles.modalBtn, styles.modalBtnSecondary]}
                  >
                    <Text style={styles.modalBtnSecondaryText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleConfirmExport}
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
    </View>
  );
};

const createStyles = (scheme: 'light' | 'dark' | null) => {
  const isDark = scheme === 'dark';
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
    },
    countHeader: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 4,
    },
    selectionCount: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? '#8E8E93' : '#6B6B70',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
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
    listContentContainer: {
      paddingBottom: Platform.OS === 'ios' ? 100 : 24,
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
      marginBottom: Platform.OS === 'ios' ? 100 : 20,
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
        web: {
          boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
        },
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
