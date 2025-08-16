import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import BottomSheet from './BottomSheet';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getDatabase, ref, push, set } from 'firebase/database';
import { getFirebaseApp } from '@/hooks/firebaseApp';
import { getCategoryFromFirebaseCategory, cleanSongTitle } from '@/utils/songUtils';
import { useUserProfile } from '@/contexts/UserProfileContext';

interface ReportBugsModalProps {
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
  onSuccess?: () => void; // Para mostrar toast desde el componente padre
  onOpenSecretPanel?: () => void; // Para abrir el panel secreto
}

export default function ReportBugsModal({
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
  onOpenSecretPanel,
}: ReportBugsModalProps) {
  const scheme = useColorScheme();
  const theme = Colors[scheme];
  const { profile } = useUserProfile();
  const [bugDescription, setBugDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!bugDescription.trim()) {
      Alert.alert('Error', 'Por favor describe los fallos encontrados');
      return;
    }

    setIsSubmitting(true);

    try {
      const db = getDatabase(getFirebaseApp());

      // Determinar la categoría basándose en la categoría de Firebase
      const category = firebaseCategory
        ? getCategoryFromFirebaseCategory(firebaseCategory)
        : 'catZotros';

      // Limpiar el título de la canción
      const cleanTitle = songTitle ? cleanSongTitle(songTitle) : 'Sin título';

      // Crear el path en Firebase: songs/fallitos/{categoria}/{titulo-de-cancion}
      const fallitosRef = ref(db, `songs/fallitos/${category}/${cleanTitle}`);

      // Crear un nuevo fallito en el array
      const newFallitoRef = push(fallitosRef);

      await set(newFallitoRef, {
        description: bugDescription.trim(),
        timestamp: Date.now(),
        songTitle: songTitle || 'Sin título',
        songFilename: songFilename || 'Sin archivo',
        platform: Platform.OS,
        status: 'pending', // pending, reviewed, fixed
        reportedAt: new Date().toISOString(),
        userName: profile.name,
        userLocation: profile.location,
      });

      // Limpiar y cerrar
      setBugDescription('');
      onClose();

      // Notificar al componente padre para mostrar toast
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error submitting bug report:', error);
      Alert.alert(
        'Error',
        'No se pudo enviar el aviso. ¿Lo intentamos de nuevo?',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (bugDescription.trim()) {
      Alert.alert(
        'Cancelar aviso',
        '¿Estás seguro de que quieres cancelar? Se perderá lo que has escrito.',
        [
          { text: 'Seguir escribiendo', style: 'cancel' },
          {
            text: 'Sí, ciérralo',
            style: 'destructive',
            onPress: () => {
              setBugDescription('');
              onClose();
            },
          },
        ],
      );
    } else {
      onClose();
    }
  };

  return (
    <BottomSheet visible={visible} onClose={handleClose}>
      <ScrollView 
        style={styles.container}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} accessibilityLabel="Cerrar">
            <MaterialIcons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>
            ¿Fallitos? 🐛
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {songTitle && (
          <Text style={[styles.songInfo, { color: theme.icon }]}>
            Avisando de fallitos en la canción: &ldquo;{songTitle}&rdquo;
          </Text>
        )}

        <Text style={[styles.label, { color: theme.text }]}>
          He encontrado estos fallitos...
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
          placeholder="Describe aquí los fallos que has encontrado en esta canción"
          placeholderTextColor={theme.icon}
          value={bugDescription}
          onChangeText={setBugDescription}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          maxLength={500}
          autoFocus={false}
          blurOnSubmit={false}
          returnKeyType="default"
          scrollEnabled={true}
          editable={!isSubmitting}
        />

        <Text style={[styles.charCount, { color: theme.icon }]}>
          {bugDescription.length}/500 caracteres
        </Text>

        <TouchableOpacity
          style={[
            styles.submitButton,
            {
              backgroundColor: bugDescription.trim() ? '#FF6B6B' : theme.icon,
              opacity: isSubmitting ? 0.7 : 1,
            },
          ]}
          onPress={handleSubmit}
          disabled={!bugDescription.trim() || isSubmitting}
        >
          <MaterialIcons
            name={isSubmitting ? 'hourglass-empty' : 'bug-report'}
            size={20}
            color="#fff"
          />
          <Text style={styles.submitButtonText}>
            {isSubmitting ? 'Enviando...' : 'Notificar fallitos'}
          </Text>
        </TouchableOpacity>

        {/* Divisor */}
        <View style={styles.divider}>
          <View style={[styles.line, { backgroundColor: theme.icon }]} />
          <Text style={[styles.dividerText, { color: theme.icon }]}>o</Text>
          <View style={[styles.line, { backgroundColor: theme.icon }]} />
        </View>

        {/* Botón Panel Secreto */}
        <TouchableOpacity
          style={[
            styles.secretButton,
            { backgroundColor: '#4CAF50' }
          ]}
          onPress={() => {
            onClose();
            if (onOpenSecretPanel) {
              onOpenSecretPanel();
            }
          }}
        >
          <MaterialIcons
            name="admin-panel-settings"
            size={20}
            color="#fff"
          />
          <Text style={styles.secretButtonText}>
            Panel Secreto
          </Text>
        </TouchableOpacity>

        <Text style={[styles.disclaimer, { color: theme.icon }]}>
          Con tus avisos nos ayudas a mejorar la calidad del cantoral. Puedes
          incluir detalles como acordes incorrectos o mal colocados, letras
          con errores o problemas de formato.
        </Text>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 60,
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
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
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 240, // Aumentar altura del textarea
    marginBottom: 8,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginBottom: 20,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 16,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  line: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    fontWeight: '500',
  },
  secretButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 16,
  },
  secretButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
