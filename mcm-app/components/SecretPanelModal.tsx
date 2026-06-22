import { logger } from '@/utils/logger';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ScrollView,
  Platform,
  Dimensions,
} from 'react-native';
import BottomSheet from './BottomSheet';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/constants/colors';
import { radii } from '@/constants/uiStyles';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useSettings } from '@/contexts/SettingsContext';
import { toYouTubeEmbedUrl } from '@/utils/youtube';
import { getDatabase, ref, set, push, get } from 'firebase/database';
import { getFirebaseApp } from '@/utils/firebaseApp';

/** Enlace multimedia (YouTube o audio) editable en el panel. */
interface MediaLink {
  label: string;
  url: string;
}

interface SecretPanelModalProps {
  visible: boolean;
  onClose: () => void;
  songTitle?: string;
  songFilename?: string;
  songAuthor?: string;
  songKey?: string;
  songCapo?: number;
  songInfo?: string;
  songContent?: string;
  firebaseCategory?: string;
  onSuccess?: () => void;
}

export default function SecretPanelModal({
  visible,
  onClose,
  songTitle,
  songFilename,
  songAuthor,
  songKey,
  songCapo,
  songInfo,
  songContent,
  firebaseCategory,
  onSuccess,
}: SecretPanelModalProps) {
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];
  const { isAdmin, setIsAdmin } = useSettings();

  // Si ya es admin (introdujo la contraseña antes), saltamos el paso de login.
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Campos editables (texto/contenido)
  const [editTitle, setEditTitle] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editKey, setEditKey] = useState('');
  const [editCapo, setEditCapo] = useState('');
  const [editInfo, setEditInfo] = useState('');
  const [editContent, setEditContent] = useState('');

  // Campos multimedia (solo admin; aún no se muestran al usuario final).
  const [editAlbum, setEditAlbum] = useState('');
  const [editSource, setEditSource] = useState('');
  const [editRhythm, setEditRhythm] = useState('');
  const [editLiturgicalTime, setEditLiturgicalTime] = useState('');
  const [editVideoInput, setEditVideoInput] = useState('');
  const [editYoutubeLinks, setEditYoutubeLinks] = useState<MediaLink[]>([]);
  const [editAudioLinks, setEditAudioLinks] = useState<MediaLink[]>([]);

  // Valores originales de multimedia (para detectar cambios al guardar).
  const [originalMedia, setOriginalMedia] = useState<{
    album: string;
    source: string;
    rhythm: string;
    liturgicalTime: string;
    videoEmbed: string;
    youtubeLinks: MediaLink[];
    audioLinks: MediaLink[];
  }>({
    album: '',
    source: '',
    rhythm: '',
    liturgicalTime: '',
    videoEmbed: '',
    youtubeLinks: [],
    audioLinks: [],
  });

  // URL de embed resultante de lo que el admin escribe (preview en vivo).
  const videoEmbedUrl = toYouTubeEmbedUrl(editVideoInput);

  // Cargar datos iniciales cuando se abre el modal
  useEffect(() => {
    if (visible) {
      setEditTitle(songTitle || '');
      setEditAuthor(songAuthor || '');
      setEditKey(songKey || '');
      setEditCapo(songCapo?.toString() || '0');
      setEditInfo(songInfo || '');
      setEditContent(songContent || '');
      // Si ya es admin, no pedimos contraseña otra vez.
      setIsAuthenticated(isAdmin);
      setPassword('');
    }
  }, [
    visible,
    isAdmin,
    songTitle,
    songAuthor,
    songKey,
    songCapo,
    songInfo,
    songContent,
  ]);

  // Cargar los campos multimedia desde Firebase (no viajan en los params de
  // navegación). Se prefijan en el formulario para que el admin los edite.
  useEffect(() => {
    if (!visible || !firebaseCategory || !songFilename) return;
    let cancelled = false;

    const normalizeLinks = (raw: any): MediaLink[] => {
      if (!Array.isArray(raw)) return [];
      return raw
        .filter((x) => x && (x.url || x.label))
        .map((x) => ({ label: x.label || '', url: x.url || '' }));
    };

    const loadMedia = async () => {
      try {
        const db = getDatabase(getFirebaseApp());
        const songsRef = ref(db, `songs/data/${firebaseCategory}/songs`);
        const snapshot = await get(songsRef);
        if (cancelled || !snapshot.exists()) return;
        const songs = snapshot.val();
        const song = Array.isArray(songs)
          ? songs.find((s: any) => s && s.filename === songFilename)
          : undefined;
        if (cancelled || !song) return;

        const media = {
          album: song.album || '',
          source: song.source || '',
          rhythm: song.rhythm || '',
          liturgicalTime: song.liturgicalTime || '',
          videoEmbed: song.videoEmbed || '',
          youtubeLinks: normalizeLinks(song.youtubeLinks),
          audioLinks: normalizeLinks(song.audioLinks),
        };
        setOriginalMedia(media);
        setEditAlbum(media.album);
        setEditSource(media.source);
        setEditRhythm(media.rhythm);
        setEditLiturgicalTime(media.liturgicalTime);
        setEditVideoInput(media.videoEmbed);
        setEditYoutubeLinks(media.youtubeLinks);
        setEditAudioLinks(media.audioLinks);
      } catch (error) {
        logger.error('Error cargando multimedia de la canción:', error);
      }
    };

    loadMedia();
    return () => {
      cancelled = true;
    };
  }, [visible, firebaseCategory, songFilename]);

  const handlePasswordSubmit = () => {
    if (password.toLowerCase() === 'coco') {
      setIsAuthenticated(true);
      setIsAdmin(true); // Persistimos el modo admin en el dispositivo.
      setPassword('');
    } else {
      Alert.alert(
        '🔒 Acceso Denegado',
        'Contraseña incorrecta. Este panel es solo para usuarios autorizados.',
      );
      setPassword('');
    }
  };

  // Helpers de listas de enlaces (YouTube / audio).
  const addLink = (setter: React.Dispatch<React.SetStateAction<MediaLink[]>>) =>
    setter((prev) => [...prev, { label: '', url: '' }]);

  const removeLink = (
    setter: React.Dispatch<React.SetStateAction<MediaLink[]>>,
    index: number,
  ) => setter((prev) => prev.filter((_, i) => i !== index));

  const updateLink = (
    setter: React.Dispatch<React.SetStateAction<MediaLink[]>>,
    index: number,
    field: keyof MediaLink,
    value: string,
  ) =>
    setter((prev) =>
      prev.map((link, i) => (i === index ? { ...link, [field]: value } : link)),
    );

  // Limpia enlaces vacíos antes de comparar/guardar.
  const cleanLinks = (links: MediaLink[]): MediaLink[] =>
    links
      .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
      .filter((l) => l.url.length > 0);

  const linksEqual = (a: MediaLink[], b: MediaLink[]): boolean =>
    JSON.stringify(a) === JSON.stringify(b);

  const handleSaveChanges = async () => {
    if (!editTitle.trim()) {
      Alert.alert('Error', 'El título es obligatorio');
      return;
    }

    if (!firebaseCategory || !songFilename) {
      Alert.alert('Error', 'No se pudo identificar la canción en Firebase');
      return;
    }

    setIsSubmitting(true);

    try {
      const db = getDatabase(getFirebaseApp());

      // Valores originales
      const originalValues = {
        title: songTitle || '',
        author: songAuthor || '',
        key: songKey || '',
        capo: songCapo || 0,
        info: songInfo || '',
        content: songContent || '',
      };

      // Valores editados
      const newValues = {
        title: editTitle.trim(),
        author: editAuthor.trim(),
        key: editKey.trim(),
        capo: parseInt(editCapo) || 0,
        info: editInfo.trim(),
        content: editContent.trim(),
      };

      // Detectar cambios específicos
      const changes: Record<string, any> = {};
      const fieldsToCheck = [
        'title',
        'author',
        'key',
        'capo',
        'info',
        'content',
      ] as const;

      fieldsToCheck.forEach((field) => {
        if ((originalValues as any)[field] !== (newValues as any)[field]) {
          changes[`${field}Old`] = (originalValues as any)[field];
          changes[`${field}New`] = (newValues as any)[field];
        }
      });

      // ── Campos multimedia (album, source, rhythm, liturgicalTime, videoEmbed) ──
      const newMedia = {
        album: editAlbum.trim(),
        source: editSource.trim(),
        rhythm: editRhythm.trim(),
        liturgicalTime: editLiturgicalTime.trim(),
        videoEmbed: toYouTubeEmbedUrl(editVideoInput),
      };
      (
        ['album', 'source', 'rhythm', 'liturgicalTime', 'videoEmbed'] as const
      ).forEach((field) => {
        if ((originalMedia as any)[field] !== (newMedia as any)[field]) {
          changes[`${field}Old`] = (originalMedia as any)[field];
          changes[`${field}New`] = (newMedia as any)[field];
        }
      });

      // ── Enlaces repetibles (youtubeLinks, audioLinks) ──
      const cleanedYoutube = cleanLinks(editYoutubeLinks);
      const cleanedAudio = cleanLinks(editAudioLinks);
      if (!linksEqual(cleanedYoutube, cleanLinks(originalMedia.youtubeLinks))) {
        changes.youtubeLinksOld = cleanLinks(originalMedia.youtubeLinks);
        changes.youtubeLinksNew = cleanedYoutube;
      }
      if (!linksEqual(cleanedAudio, cleanLinks(originalMedia.audioLinks))) {
        changes.audioLinksOld = cleanLinks(originalMedia.audioLinks);
        changes.audioLinksNew = cleanedAudio;
      }

      // Mapa de valores nuevos para aplicar al árbol songs/data.
      const newValuesForApply: Record<string, any> = {
        ...newValues,
        ...newMedia,
        youtubeLinks: cleanedYoutube,
        audioLinks: cleanedAudio,
      };

      // Si no hay cambios, no hacer nada
      if (Object.keys(changes).length === 0) {
        Alert.alert(
          '💭 Sin cambios detectados',
          'No se han realizado modificaciones en ningún campo de la canción.\n\nNada que guardar en Firebase.',
          [{ text: 'Entendido', style: 'default' }],
        );
        setIsSubmitting(false);
        return;
      }

      // La categoría de Firebase ya viene en el formato correcto (ej: "adoracion")
      const category = firebaseCategory;

      // 1. Leer todas las canciones de la categoría para encontrar la canción específica
      const songsRef = ref(db, `songs/data/${category}/songs`);
      const songsSnapshot = await get(songsRef);

      if (!songsSnapshot.exists()) {
        logger.error('No se encontró la ruta:', `songs/data/${category}/songs`);
        throw new Error(
          `No se encontró la categoría de canciones en: songs/data/${category}/songs`,
        );
      }

      const songs = songsSnapshot.val();
      let songIndex = -1;

      // Buscar la canción por filename
      songs.forEach((song: any, index: number) => {
        if (song && song.filename === songFilename) {
          songIndex = index;
        }
      });

      if (songIndex === -1) {
        throw new Error('No se encontró la canción en la base de datos');
      }

      // 2. Actualizar solo los campos que cambiaron en Firebase
      // Crear objeto con solo los campos que cambiaron
      const fieldsToUpdate: Record<string, any> = {};
      Object.keys(changes).forEach((key) => {
        if (key.endsWith('New')) {
          const fieldName = key.replace('New', '');
          fieldsToUpdate[fieldName] = newValuesForApply[fieldName];
        }
      });

      // Actualizar solo los campos que cambiaron
      if (Object.keys(fieldsToUpdate).length > 0) {
        await Promise.all(
          Object.entries(fieldsToUpdate).map(([field, value]) =>
            set(
              ref(db, `songs/data/${category}/songs/${songIndex}/${field}`),
              value,
            ),
          ),
        );
      }

      // 3. Guardar rastro de cambios en ediciones (solo los campos que cambiaron)
      const edicionesRef = ref(db, 'songs/ediciones');
      const nuevaEdicionRef = push(edicionesRef);

      const edicionData = {
        filename: songFilename,
        category: firebaseCategory, // ej: "adoracion"
        songIndex: songIndex,
        ...changes, // Solo los campos que cambiaron (titleOld, titleNew, etc.)
        editedAt: new Date().toISOString(),
        timestamp: Date.now(),
        platform: Platform.OS,
        status: 'applied', // Ya se aplicó directamente
      };

      await set(nuevaEdicionRef, edicionData);

      // 4. Actualizar el timestamp general
      await set(ref(db, 'songs/updatedAt'), Date.now().toString());

      // Cerrar modal y notificar éxito
      setIsAuthenticated(false);
      onClose();

      if (onSuccess) {
        onSuccess();
      }

      // Crear lista de campos cambiados para el mensaje
      const changedFields = Object.keys(changes)
        .filter((key) => key.endsWith('New'))
        .map((key) => {
          const fieldName = key.replace('New', '');
          const fieldLabels = {
            title: 'Título',
            author: 'Autor',
            key: 'Tonalidad',
            capo: 'Capo',
            info: 'Info',
            content: 'Contenido',
            album: 'Álbum',
            source: 'Fuente',
            rhythm: 'Ritmo',
            liturgicalTime: 'Tiempo litúrgico',
            videoEmbed: 'Vídeo',
            youtubeLinks: 'Enlaces YouTube',
            audioLinks: 'Enlaces de audio',
          };
          return (
            (fieldLabels as Record<string, string>)[fieldName] || fieldName
          );
        });

      Alert.alert(
        '✅ Canción Actualizada',
        `Se han guardado los cambios en: ${changedFields.join(', ')}.\n\nSolo se actualizaron los campos modificados.`,
        [{ text: 'Perfecto', style: 'default' }],
      );
    } catch (error) {
      logger.error('Error updating song:', error);
      Alert.alert(
        'Error',
        `No se pudieron guardar los cambios: ${(error as Error).message}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsAuthenticated(false);
    onClose();
  };

  // Pantalla de autenticación
  if (!isAuthenticated) {
    const isDark = scheme === 'dark';
    return (
      <BottomSheet
        visible={visible}
        onClose={onClose}
        title="🔒 Panel Secreto"
        paddingHorizontal={0}
      >
        <View style={styles.authContainer}>
          <View style={styles.mysteriousContent}>
            <MaterialIcons
              name="security"
              size={64}
              color={theme.icon}
              style={{ alignSelf: 'center', marginBottom: 20 }}
            />

            <Text style={[styles.mysteriousText, { color: theme.text }]}>
              Solo para usuarios autorizados...
            </Text>

            <Text style={[styles.mysteriousSubtext, { color: theme.icon }]}>
              Este panel permite editar directamente los datos de las canciones
              en Firebase.
            </Text>

            <TextInput
              style={[
                styles.passwordInput,
                {
                  backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
                  color: theme.text,
                  borderColor: password.trim() ? '#4CAF50' : theme.icon,
                },
              ]}
              placeholder="Introduce la palabra secreta"
              placeholderTextColor={theme.icon}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              onSubmitEditing={handlePasswordSubmit}
              returnKeyType="done"
            />

            <TouchableOpacity
              style={[
                styles.authButton,
                {
                  backgroundColor: password.trim() ? '#4CAF50' : theme.icon,
                  opacity: password.trim() ? 1 : 0.6,
                },
              ]}
              onPress={handlePasswordSubmit}
              disabled={!password.trim()}
              activeOpacity={0.8}
            >
              <MaterialIcons name="vpn-key" size={20} color="#fff" />
              <Text style={styles.authButtonText}>Acceder</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheet>
    );
  }

  // Panel de edición
  const isDark = scheme === 'dark';
  const inputBg = isDark ? '#2C2C2E' : '#F2F2F7';
  const inputBorder = isDark ? '#3A3A3C' : '#E5E5EA';

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      title="🛠️ Editor Avanzado"
      height={Dimensions.get('window').height * 0.9}
    >
      <View style={styles.fullContainer}>
        {songTitle && (
          <Text style={[styles.songInfo, { color: theme.icon }]}>
            Editando: &ldquo;{songTitle}&rdquo;
          </Text>
        )}

        <ScrollView
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          {/* Título */}
          <Text style={[styles.label, { color: theme.text }]}>Título *</Text>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: inputBg,
                color: theme.text,
                borderColor: editTitle.trim() ? '#34C759' : inputBorder,
              },
            ]}
            placeholder="Título de la canción"
            placeholderTextColor={theme.icon}
            value={editTitle}
            onChangeText={setEditTitle}
            editable={!isSubmitting}
          />

          {/* Autor */}
          <Text style={[styles.label, { color: theme.text }]}>Autor</Text>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: inputBg,
                color: theme.text,
                borderColor: editAuthor.trim() ? '#34C759' : inputBorder,
              },
            ]}
            placeholder="Autor de la canción"
            placeholderTextColor={theme.icon}
            value={editAuthor}
            onChangeText={setEditAuthor}
            editable={!isSubmitting}
          />

          {/* Key y Capo en fila */}
          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <Text style={[styles.label, { color: theme.text }]}>Key</Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: inputBg,
                    color: theme.text,
                    borderColor: editKey.trim() ? '#34C759' : inputBorder,
                  },
                ]}
                placeholder="Ej: G, Am, C"
                placeholderTextColor={theme.icon}
                value={editKey}
                onChangeText={setEditKey}
                editable={!isSubmitting}
              />
            </View>
            <View style={styles.halfWidth}>
              <Text style={[styles.label, { color: theme.text }]}>Capo</Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: inputBg,
                    color: theme.text,
                    borderColor: editCapo.trim() ? '#34C759' : inputBorder,
                  },
                ]}
                placeholder="0"
                placeholderTextColor={theme.icon}
                value={editCapo}
                onChangeText={setEditCapo}
                keyboardType="numeric"
                editable={!isSubmitting}
              />
            </View>
          </View>

          {/* Info */}
          <Text style={[styles.label, { color: theme.text }]}>
            Info adicional
          </Text>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: inputBg,
                color: theme.text,
                borderColor: editInfo.trim() ? '#34C759' : inputBorder,
              },
            ]}
            placeholder="Información adicional sobre la canción"
            placeholderTextColor={theme.icon}
            value={editInfo}
            onChangeText={setEditInfo}
            multiline
            numberOfLines={2}
            editable={!isSubmitting}
          />

          {/* Content */}
          <Text style={[styles.label, { color: theme.text }]}>
            Contenido de la canción *
          </Text>
          <TextInput
            style={[
              styles.textInput,
              styles.contentInput,
              {
                backgroundColor: inputBg,
                color: theme.text,
                borderColor: editContent.trim() ? '#34C759' : inputBorder,
              },
            ]}
            placeholder="Contenido completo de la canción (ChordPro format)"
            placeholderTextColor={theme.icon}
            value={editContent}
            onChangeText={setEditContent}
            multiline
            numberOfLines={10}
            textAlignVertical="top"
            scrollEnabled={true}
            editable={!isSubmitting}
          />

          {/* ── Sección multimedia (solo admin; no visible aún al usuario) ── */}
          <View style={styles.sectionDivider} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            🎬 Multimedia
          </Text>
          <Text style={[styles.sectionHint, { color: theme.icon }]}>
            Estos campos aún no se muestran al usuario final. Sirven para que el
            administrador los vaya rellenando.
          </Text>

          {/* Álbum y Ritmo en fila */}
          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <Text style={[styles.label, { color: theme.text }]}>Álbum</Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: inputBg,
                    color: theme.text,
                    borderColor: editAlbum.trim() ? '#34C759' : inputBorder,
                  },
                ]}
                placeholder="Ej: ¡Alégrate!, 2004"
                placeholderTextColor={theme.icon}
                value={editAlbum}
                onChangeText={setEditAlbum}
                editable={!isSubmitting}
              />
            </View>
            <View style={styles.halfWidth}>
              <Text style={[styles.label, { color: theme.text }]}>Ritmo</Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: inputBg,
                    color: theme.text,
                    borderColor: editRhythm.trim() ? '#34C759' : inputBorder,
                  },
                ]}
                placeholder="Ej: 4x4"
                placeholderTextColor={theme.icon}
                value={editRhythm}
                onChangeText={setEditRhythm}
                editable={!isSubmitting}
              />
            </View>
          </View>

          {/* Tiempo litúrgico */}
          <Text style={[styles.label, { color: theme.text }]}>
            Tiempo litúrgico
          </Text>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: inputBg,
                color: theme.text,
                borderColor: editLiturgicalTime.trim()
                  ? '#34C759'
                  : inputBorder,
              },
            ]}
            placeholder="Ej: Adviento, Cuaresma, Pascua…"
            placeholderTextColor={theme.icon}
            value={editLiturgicalTime}
            onChangeText={setEditLiturgicalTime}
            editable={!isSubmitting}
          />

          {/* Fuente */}
          <Text style={[styles.label, { color: theme.text }]}>Fuente</Text>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: inputBg,
                color: theme.text,
                borderColor: editSource.trim() ? '#34C759' : inputBorder,
              },
            ]}
            placeholder="Ej: doceacordes.es"
            placeholderTextColor={theme.icon}
            value={editSource}
            onChangeText={setEditSource}
            editable={!isSubmitting}
          />

          {/* Vídeo embebido */}
          <Text style={[styles.label, { color: theme.text }]}>
            Vídeo de YouTube
          </Text>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: inputBg,
                color: theme.text,
                borderColor: editVideoInput.trim() ? '#34C759' : inputBorder,
              },
            ]}
            placeholder="Pega una URL normal de YouTube"
            placeholderTextColor={theme.icon}
            value={editVideoInput}
            onChangeText={setEditVideoInput}
            autoCapitalize="none"
            keyboardType="url"
            editable={!isSubmitting}
          />
          {editVideoInput.trim() ? (
            <Text style={[styles.embedPreview, { color: theme.icon }]}>
              Se guardará como: {videoEmbedUrl}
            </Text>
          ) : null}

          {/* Enlaces de YouTube (repetibles) */}
          <Text style={[styles.label, { color: theme.text }]}>
            Enlaces de YouTube
          </Text>
          {editYoutubeLinks.map((link, index) => (
            <View key={`yt-${index}`} style={styles.linkRow}>
              <TextInput
                style={[
                  styles.textInput,
                  styles.linkLabelInput,
                  {
                    backgroundColor: inputBg,
                    color: theme.text,
                    borderColor: inputBorder,
                  },
                ]}
                placeholder="Etiqueta (opcional)"
                placeholderTextColor={theme.icon}
                value={link.label}
                onChangeText={(t) =>
                  updateLink(setEditYoutubeLinks, index, 'label', t)
                }
                editable={!isSubmitting}
              />
              <TextInput
                style={[
                  styles.textInput,
                  styles.linkUrlInput,
                  {
                    backgroundColor: inputBg,
                    color: theme.text,
                    borderColor: link.url.trim() ? '#34C759' : inputBorder,
                  },
                ]}
                placeholder="URL"
                placeholderTextColor={theme.icon}
                value={link.url}
                onChangeText={(t) =>
                  updateLink(setEditYoutubeLinks, index, 'url', t)
                }
                autoCapitalize="none"
                keyboardType="url"
                editable={!isSubmitting}
              />
              <TouchableOpacity
                style={styles.linkRemoveBtn}
                onPress={() => removeLink(setEditYoutubeLinks, index)}
                disabled={isSubmitting}
              >
                <MaterialIcons name="close" size={20} color={theme.icon} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            style={[styles.addLinkBtn, { borderColor: inputBorder }]}
            onPress={() => addLink(setEditYoutubeLinks)}
            disabled={isSubmitting}
          >
            <MaterialIcons name="add" size={18} color={theme.text} />
            <Text style={[styles.addLinkText, { color: theme.text }]}>
              Añadir enlace de YouTube
            </Text>
          </TouchableOpacity>

          {/* Enlaces de audio (repetibles) */}
          <Text style={[styles.label, { color: theme.text }]}>
            Enlaces de audio
          </Text>
          {editAudioLinks.map((link, index) => (
            <View key={`au-${index}`} style={styles.linkRow}>
              <TextInput
                style={[
                  styles.textInput,
                  styles.linkLabelInput,
                  {
                    backgroundColor: inputBg,
                    color: theme.text,
                    borderColor: inputBorder,
                  },
                ]}
                placeholder="Etiqueta (opcional)"
                placeholderTextColor={theme.icon}
                value={link.label}
                onChangeText={(t) =>
                  updateLink(setEditAudioLinks, index, 'label', t)
                }
                editable={!isSubmitting}
              />
              <TextInput
                style={[
                  styles.textInput,
                  styles.linkUrlInput,
                  {
                    backgroundColor: inputBg,
                    color: theme.text,
                    borderColor: link.url.trim() ? '#34C759' : inputBorder,
                  },
                ]}
                placeholder="URL"
                placeholderTextColor={theme.icon}
                value={link.url}
                onChangeText={(t) =>
                  updateLink(setEditAudioLinks, index, 'url', t)
                }
                autoCapitalize="none"
                keyboardType="url"
                editable={!isSubmitting}
              />
              <TouchableOpacity
                style={styles.linkRemoveBtn}
                onPress={() => removeLink(setEditAudioLinks, index)}
                disabled={isSubmitting}
              >
                <MaterialIcons name="close" size={20} color={theme.icon} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            style={[styles.addLinkBtn, { borderColor: inputBorder }]}
            onPress={() => addLink(setEditAudioLinks)}
            disabled={isSubmitting}
          >
            <MaterialIcons name="add" size={18} color={theme.text} />
            <Text style={[styles.addLinkText, { color: theme.text }]}>
              Añadir enlace de audio
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.saveButton,
              {
                backgroundColor:
                  editTitle.trim() && editContent.trim()
                    ? '#4CAF50'
                    : theme.icon,
                opacity: isSubmitting ? 0.7 : 1,
              },
            ]}
            onPress={handleSaveChanges}
            disabled={!editTitle.trim() || !editContent.trim() || isSubmitting}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name={isSubmitting ? 'hourglass-empty' : 'save'}
              size={20}
              color="#fff"
            />
            <Text style={styles.saveButtonText}>
              {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
            </Text>
          </TouchableOpacity>

          <Text style={[styles.disclaimer, { color: theme.icon }]}>
            🔮 Este panel registra ediciones que serán revisadas y aplicadas en
            la base de datos. Asegúrate de que los cambios sean correctos antes
            de enviar.
          </Text>
        </ScrollView>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  // Estilos originales
  container: {
    minHeight: '90%',
    paddingBottom: 20,
  },
  fullContainer: {
    flex: 1,
    height: '100%',
    maxHeight: '100%',
  },
  authContainer: {
    minHeight: '60%',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  songInfo: {
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 20,
    textAlign: 'center',
  },
  mysteriousContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    paddingHorizontal: 20,
  },
  mysteriousText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  mysteriousSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 20,
  },
  passwordInput: {
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: radii.sm,
  },
  authButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 0,
  },
  scrollContent: {
    paddingBottom: 40,
    flexGrow: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  contentInput: {
    minHeight: 200,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    flex: 0.48,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: radii.sm,
    marginTop: 20,
    marginBottom: 16,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#8E8E93',
    opacity: 0.4,
    marginTop: 24,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 12,
  },
  sectionHint: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
    marginBottom: 4,
  },
  embedPreview: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: -4,
    marginBottom: 8,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  linkLabelInput: {
    flex: 0.9,
    marginBottom: 0,
  },
  linkUrlInput: {
    flex: 1.4,
    marginBottom: 0,
  },
  linkRemoveBtn: {
    padding: 6,
  },
  addLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  addLinkText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
});
