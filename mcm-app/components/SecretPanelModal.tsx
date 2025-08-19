import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import BottomSheet from './BottomSheet';
import Modal from 'react-native-modal';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getDatabase, ref, set, push, get } from 'firebase/database';
import { getFirebaseApp } from '@/hooks/firebaseApp';
import {
  getCategoryFromFirebaseCategory,
  cleanSongTitle,
} from '@/utils/songUtils';

// Custom BottomSheet para el SecretPanel que ocupa más espacio
const FullBottomSheet = ({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) => {
  const scheme = useColorScheme();
  const theme = Colors[scheme];

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      style={styles.fullModal}
      swipeDirection="down"
      onSwipeComplete={onClose}
      backdropOpacity={0.3}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      animationInTiming={300}
      animationOutTiming={250}
      backdropTransitionInTiming={300}
      backdropTransitionOutTiming={250}
      useNativeDriverForBackdrop={true}
      hideModalContentWhileAnimating={false}
      avoidKeyboard={true}
      scrollOffset={0}
      scrollOffsetMax={0}
      propagateSwipe={true}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View
          style={[
            styles.fullModalContainer,
            { backgroundColor: theme.background },
          ]}
        >
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

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
  const theme = Colors[scheme];

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Campos editables
  const [editTitle, setEditTitle] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editKey, setEditKey] = useState('');
  const [editCapo, setEditCapo] = useState('');
  const [editInfo, setEditInfo] = useState('');
  const [editContent, setEditContent] = useState('');

  // Cargar datos iniciales cuando se abre el modal
  useEffect(() => {
    if (visible) {
      setEditTitle(songTitle || '');
      setEditAuthor(songAuthor || '');
      setEditKey(songKey || '');
      setEditCapo(songCapo?.toString() || '0');
      setEditInfo(songInfo || '');
      setEditContent(songContent || '');
      setIsAuthenticated(false);
      setPassword('');
    }
  }, [
    visible,
    songTitle,
    songAuthor,
    songKey,
    songCapo,
    songInfo,
    songContent,
  ]);

  const handlePasswordSubmit = () => {
    if (password.toLowerCase() === 'coco') {
      setIsAuthenticated(true);
      setPassword('');
    } else {
      Alert.alert(
        '🔒 Acceso Denegado',
        'Contraseña incorrecta. Este panel es solo para usuarios autorizados.',
      );
      setPassword('');
    }
  };

  const handleSaveChanges = async () => {
    console.log('=== INICIO handleSaveChanges ===');
    console.log('songTitle:', songTitle);
    console.log('songFilename:', songFilename);
    console.log('firebaseCategory:', firebaseCategory);

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
      const changes = {};
      const fieldsToCheck = [
        'title',
        'author',
        'key',
        'capo',
        'info',
        'content',
      ];

      fieldsToCheck.forEach((field) => {
        if (originalValues[field] !== newValues[field]) {
          changes[`${field}Old`] = originalValues[field];
          changes[`${field}New`] = newValues[field];
          console.log(
            `🔄 Campo '${field}' cambió:`,
            `"${originalValues[field]}" → "${newValues[field]}"`,
          );
        }
      });

      console.log(
        '📊 Total de cambios detectados:',
        Object.keys(changes).length / 2,
      );

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

      console.log('Buscando en categoría:', category);
      console.log('Ruta completa:', `songs/data/${category}/songs`);

      // 1. Leer todas las canciones de la categoría para encontrar la canción específica
      const songsRef = ref(db, `songs/data/${category}/songs`);
      const songsSnapshot = await get(songsRef);

      console.log('songsSnapshot exists:', songsSnapshot.exists());

      if (!songsSnapshot.exists()) {
        console.error(
          'No se encontró la ruta:',
          `songs/data/${category}/songs`,
        );
        console.error('firebaseCategory recibido:', firebaseCategory);
        throw new Error(
          `No se encontró la categoría de canciones en: songs/data/${category}/songs`,
        );
      }

      const songs = songsSnapshot.val();
      let songIndex = -1;

      // Buscar la canción por filename
      songs.forEach((song, index) => {
        if (song && song.filename === songFilename) {
          songIndex = index;
        }
      });

      if (songIndex === -1) {
        throw new Error('No se encontró la canción en la base de datos');
      }

      // 2. Actualizar solo los campos que cambiaron en Firebase
      const songUpdateRef = ref(
        db,
        `songs/data/${category}/songs/${songIndex}`,
      );

      // Crear objeto con solo los campos que cambiaron
      const fieldsToUpdate = {};
      Object.keys(changes).forEach((key) => {
        if (key.endsWith('New')) {
          const fieldName = key.replace('New', '');
          fieldsToUpdate[fieldName] = newValues[fieldName];
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
          };
          return fieldLabels[fieldName] || fieldName;
        });

      Alert.alert(
        '✅ Canción Actualizada',
        `Se han guardado los cambios en: ${changedFields.join(', ')}.\n\nSolo se actualizaron los campos modificados.`,
        [{ text: 'Perfecto', style: 'default' }],
      );
    } catch (error) {
      console.error('Error updating song:', error);
      Alert.alert(
        'Error',
        `No se pudieron guardar los cambios: ${error.message}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    console.log('handleClose called, isAuthenticated:', isAuthenticated);
    if (isAuthenticated) {
      Alert.alert(
        'Salir del Panel Secreto',
        '¿Estás seguro? Los cambios no guardados se perderán.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Salir',
            style: 'destructive',
            onPress: () => {
              setIsAuthenticated(false);
              onClose();
            },
          },
        ],
      );
    } else {
      onClose();
    }
  };

  // Pantalla de autenticación
  if (!isAuthenticated) {
    return (
      <BottomSheet visible={visible} onClose={onClose}>
        <View style={styles.authContainer}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Cerrar">
              <MaterialIcons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: theme.text }]}>
              🔒 Panel Secreto
            </Text>
            <View style={{ width: 24 }} />
          </View>

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
                  backgroundColor: theme.background,
                  color: theme.text,
                  borderColor: theme.icon,
                },
              ]}
              placeholder="Introduce la palabra secreta"
              placeholderTextColor={theme.icon}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoFocus
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
  return (
    <FullBottomSheet visible={visible} onClose={handleClose}>
      <View style={styles.fullContainer}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              console.log('Close button pressed');
              handleClose();
            }}
            accessibilityLabel="Cerrar"
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <MaterialIcons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>
            🛠️ Editor Avanzado
          </Text>
          <View style={{ width: 24 }} />
        </View>

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
                backgroundColor: theme.background,
                color: theme.text,
                borderColor: theme.icon,
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
                backgroundColor: theme.background,
                color: theme.text,
                borderColor: theme.icon,
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
                    backgroundColor: theme.background,
                    color: theme.text,
                    borderColor: theme.icon,
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
                    backgroundColor: theme.background,
                    color: theme.text,
                    borderColor: theme.icon,
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
                backgroundColor: theme.background,
                color: theme.text,
                borderColor: theme.icon,
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
                backgroundColor: theme.background,
                color: theme.text,
                borderColor: theme.icon,
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
    </FullBottomSheet>
  );
}

const styles = StyleSheet.create({
  // Estilos para el FullBottomSheet personalizado
  fullModal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  fullModalContainer: {
    padding: 20,
    paddingBottom: 40,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '95%',
    height: '95%',
  },
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
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    zIndex: 10,
    elevation: 10,
  },
  closeButton: {
    padding: 5,
    borderRadius: 20,
    zIndex: 20,
    elevation: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
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
    borderRadius: 8,
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
    borderRadius: 8,
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
    borderRadius: 8,
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
    borderRadius: 8,
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
});
