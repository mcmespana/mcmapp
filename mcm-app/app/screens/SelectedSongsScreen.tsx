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
  TouchableOpacity,
  StyleSheet,
  Platform,
  Share,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { Provider as PaperProvider, Snackbar } from 'react-native-paper';
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
import { radii } from '@/constants/uiStyles';

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
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
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
        setSnackbarMessage('Lista copiada al portapapeles');
        setSnackbarVisible(true);
      } catch (error) {
        console.error('Error copying to clipboard:', error);
        setSnackbarMessage('Error al copiar la lista');
        setSnackbarVisible(true);
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
      setSnackbarMessage('Playlist exportada');
      setSnackbarVisible(true);
    } catch (err) {
      console.error('Error sharing file', err);
      setShowExportModal(false);
      setSnackbarMessage('Error al exportar');
      setSnackbarVisible(true);
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
            setSnackbarMessage('Selecciona un archivo .mcm');
            setSnackbarVisible(true);
            return;
          }
          const text = await file.text();
          try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) {
              if (parsed.length === 0) {
                setSnackbarMessage('El archivo está vacío');
                setSnackbarVisible(true);
                return;
              }
              parsed.forEach((fn: string) => addSong(fn));
              setSnackbarMessage('Playlist importada');
              setSnackbarVisible(true);
            } else {
              setSnackbarMessage('Formato de archivo inválido');
              setSnackbarVisible(true);
            }
          } catch (parseError) {
            console.error('Error parsing JSON:', parseError);
            setSnackbarMessage('El archivo no es un JSON válido');
            setSnackbarVisible(true);
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
          setSnackbarMessage('Selecciona un archivo .mcm');
          setSnackbarVisible(true);
          return;
        }
        const content = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        try {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            if (parsed.length === 0) {
              setSnackbarMessage('El archivo está vacío');
              setSnackbarVisible(true);
              return;
            }
            parsed.forEach((fn: string) => addSong(fn));
            setSnackbarMessage('Playlist importada');
            setSnackbarVisible(true);
          } else {
            setSnackbarMessage('Formato de archivo inválido');
            setSnackbarVisible(true);
          }
        } catch (parseError) {
          console.error('Error parsing JSON:', parseError);
          setSnackbarMessage('El archivo no es un JSON válido');
          setSnackbarVisible(true);
        }
      }
    } catch (err) {
      console.error('Error importing playlist', err);
      setSnackbarMessage('Error al importar');
      setSnackbarVisible(true);
    }
  }, [addSong]);

  const handleSongPress = (song: Song) => {
    if (!allSongsData) return;
    const completeSong = Object.values(allSongsData)
      .flatMap((cat) => cat.songs)
      .find((s) => s.filename === song.filename);

    if (!completeSong) {
      console.error('Song not found in allSongsData:', song.filename);
      return;
    }

    const allSelected = categorizedSelectedSongs.flatMap((cat) => cat.data);
    const index = allSelected.findIndex(
      (s) => s.filename === completeSong.filename,
    );

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

  useLayoutEffect(() => {
    if (selectedSongs.length > 0) {
      const isDesktopLike =
        Platform.OS === 'web' ||
        Platform.OS === 'windows' ||
        Platform.OS === 'macos';
      navigation.setOptions({
        headerRight: () => (
          <TouchableOpacity
            onPress={handleExport}
            style={styles.headerExportButton}
          >
            <IconSymbol
              name={isDesktopLike ? 'doc.on.doc' : 'square.and.arrow.up'}
              size={22}
              color={
                Platform.OS === 'ios'
                  ? '#1a1a1a'
                  : Platform.OS === 'web'
                    ? '#1a1a1a'
                    : '#fff'
              }
            />
            {isDesktopLike && (
              <Text style={styles.headerExportText}>Copiar</Text>
            )}
          </TouchableOpacity>
        ),
      });
    } else {
      navigation.setOptions({
        headerRight: () => null,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, handleExport, selectedSongs.length]);

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
        <TouchableOpacity
          onPress={handleImportFile}
          style={styles.importButton}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name="file-download"
            size={20}
            color={isDark ? '#7AB3FF' : '#253883'}
          />
          <Text style={styles.importButtonText}>Importar playlist</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <Text style={styles.selectionCount}>
          {selectedSongs.length}{' '}
          {selectedSongs.length === 1 ? 'canción' : 'canciones'}
        </Text>
        <View style={styles.toolbarActions}>
          <TouchableOpacity
            onPress={handleShareFile}
            style={styles.toolbarButton}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name="ios-share"
              size={18}
              color={isDark ? '#7AB3FF' : '#253883'}
            />
            <Text style={styles.toolbarButtonText}>Exportar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleImportFile}
            style={styles.toolbarButton}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name="file-download"
              size={18}
              color={isDark ? '#7AB3FF' : '#253883'}
            />
            <Text style={styles.toolbarButtonText}>Importar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={clearSelection}
            style={styles.toolbarButtonDanger}
            activeOpacity={0.7}
          >
            <MaterialIcons name="delete-outline" size={18} color="#FF453A" />
            <Text style={styles.toolbarButtonDangerText}>Borrar</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={categorizedSelectedSongs}
        renderItem={renderCategory}
        keyExtractor={(item) => item.categoryTitle}
        contentContainerStyle={styles.listContentContainer}
        showsVerticalScrollIndicator={false}
      />

      {/* Export modal */}
      <Modal
        visible={showExportModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowExportModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Exportar playlist</Text>
            <Text style={styles.modalSubtitle}>
              Elige un nombre para tu archivo
            </Text>

            <TextInput
              style={styles.modalInput}
              value={exportFileName}
              onChangeText={setExportFileName}
              placeholder="Playlist 7-ago"
              placeholderTextColor={isDark ? '#636366' : '#AEAEB2'}
              autoFocus={true}
              selectTextOnFocus={true}
            />

            <Text style={styles.modalNote}>Se exportará como archivo .mcm</Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowExportModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalConfirmButton,
                  !exportFileName.trim() && styles.modalConfirmDisabled,
                ]}
                onPress={handleConfirmExport}
                disabled={!exportFileName.trim()}
                activeOpacity={0.7}
              >
                <Text style={styles.modalConfirmText}>Exportar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        action={{
          label: 'OK',
          onPress: () => setSnackbarVisible(false),
        }}
        duration={Snackbar.DURATION_MEDIUM}
        style={styles.snackbar}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
};

function SelectedSongsScreenWithProvider() {
  return (
    <PaperProvider>
      <SelectedSongsScreen />
    </PaperProvider>
  );
}

const createStyles = (scheme: 'light' | 'dark' | null) => {
  const isDark = scheme === 'dark';
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
    },
    toolbar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: isDark ? '#2C2C2E' : '#fff',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    },
    selectionCount: {
      fontSize: 15,
      fontWeight: '600',
      color: isDark ? '#EBEBF0' : '#1C1C1E',
    },
    toolbarActions: {
      flexDirection: 'row',
      gap: 4,
    },
    toolbarButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: radii.sm,
      backgroundColor: isDark ? '#1A2744' : '#E8F0FE',
      gap: 4,
    },
    toolbarButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? '#7AB3FF' : '#253883',
    },
    toolbarButtonDanger: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: radii.sm,
      backgroundColor: isDark ? '#3A1B1B' : '#FFEBEE',
      gap: 4,
    },
    toolbarButtonDangerText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#FF453A',
    },
    headerExportButton: {
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    headerExportText: {
      color: '#1a1a1a',
      fontSize: 15,
      fontWeight: '500',
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
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContainer: {
      backgroundColor: isDark ? '#2C2C2E' : '#fff',
      borderRadius: radii.pill,
      padding: 24,
      width: '100%',
      maxWidth: 380,
      ...Platform.select({
        web: {
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        },
        default: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.25,
          shadowRadius: 16,
          elevation: 12,
        },
      }),
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 4,
      textAlign: 'center',
      color: isDark ? '#EBEBF0' : '#1C1C1E',
      letterSpacing: -0.4,
    },
    modalSubtitle: {
      fontSize: 14,
      color: isDark ? '#8E8E93' : '#8E8E93',
      textAlign: 'center',
      marginBottom: 20,
    },
    modalInput: {
      borderWidth: 1,
      borderColor: isDark ? Colors.dark.card : '#E5E5EA',
      borderRadius: radii.md,
      padding: 14,
      fontSize: 16,
      marginBottom: 8,
      backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
      color: isDark ? '#EBEBF0' : '#1C1C1E',
    },
    modalNote: {
      fontSize: 13,
      color: isDark ? '#636366' : '#8E8E93',
      textAlign: 'center',
      marginBottom: 24,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    modalCancelButton: {
      flex: 1,
      padding: 14,
      borderRadius: radii.md,
      backgroundColor: isDark ? Colors.dark.card : '#F2F2F7',
      alignItems: 'center',
    },
    modalCancelText: {
      color: isDark ? '#AEAEB2' : '#636366',
      fontSize: 16,
      fontWeight: '600',
    },
    modalConfirmButton: {
      flex: 1,
      padding: 14,
      borderRadius: radii.md,
      backgroundColor: '#253883',
      alignItems: 'center',
    },
    modalConfirmDisabled: {
      opacity: 0.5,
    },
    modalConfirmText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    snackbar: {
      backgroundColor: isDark ? Colors.dark.card : '#1C1C1E',
      borderRadius: radii.md,
      marginBottom: Platform.OS === 'ios' ? 90 : 8,
      marginHorizontal: 16,
    },
  });
};

export default SelectedSongsScreenWithProvider;
