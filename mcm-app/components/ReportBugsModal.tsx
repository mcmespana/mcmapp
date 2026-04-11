import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, ScrollView } from 'react-native';
import BottomSheet from './BottomSheet';
import {
  Button,
  CloseButton,
  TextField,
  TextArea,
  useToast,
} from 'heroui-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getDatabase, ref, push, set } from 'firebase/database';
import { getFirebaseApp } from '@/hooks/firebaseApp';
import {
  getCategoryFromFirebaseCategory,
  cleanSongTitle,
} from '@/utils/songUtils';
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
  const { toast } = useToast();
  const [bugDescription, setBugDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!bugDescription.trim()) {
      toast.show({
        variant: 'danger',
        label: 'Por favor describe los fallos encontrados',
      });
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
        userName: profile.name || 'Anónimo',
        userLocation: profile.location || 'Sin ubicación',
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
      toast.show({
        variant: 'danger',
        label: 'No se pudo enviar el aviso. Inténtalo de nuevo.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (bugDescription.trim()) {
      toast.show({
        variant: 'warning',
        label: '¿Cancelar el aviso? Se perderá lo escrito.',
        actionLabel: 'Sí, cerrar',
        onActionPress: ({ hide }) => {
          hide();
          setBugDescription('');
          onClose();
        },
      });
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
          <CloseButton onPress={handleClose} />
          <Text style={[styles.title, { color: theme.text }]}>
            ¿Fallitos? 🐛
          </Text>
          <View style={{ width: 36 }} />
        </View>

        {songTitle && (
          <Text style={[styles.songInfo, { color: theme.icon }]}>
            Avisando de fallitos en la canción: &ldquo;{songTitle}&rdquo;
          </Text>
        )}

        <Text style={[styles.label, { color: theme.text }]}>
          He encontrado estos fallitos...
        </Text>

        <TextField style={{ marginBottom: 8 }}>
          <TextArea
            placeholder="Describe aquí los fallos que has encontrado en esta canción"
            value={bugDescription}
            onChangeText={setBugDescription}
            maxLength={500}
            autoFocus={false}
            blurOnSubmit={false}
            returnKeyType="default"
            scrollEnabled={true}
            editable={!isSubmitting}
          />
        </TextField>

        <Text style={[styles.charCount, { color: theme.icon }]}>
          {bugDescription.length}/500 caracteres
        </Text>

        <Button
          variant="danger"
          isDisabled={!bugDescription.trim() || isSubmitting}
          onPress={handleSubmit}
          style={styles.submitButton}
        >
          <MaterialIcons
            name={isSubmitting ? 'hourglass-empty' : 'bug-report'}
            size={20}
            color="#fff"
          />
          <Button.Label>
            {isSubmitting ? 'Enviando...' : 'Notificar fallitos'}
          </Button.Label>
        </Button>

        {/* Divisor */}
        <View style={styles.divider}>
          <View style={[styles.line, { backgroundColor: theme.icon }]} />
          <Text style={[styles.dividerText, { color: theme.icon }]}>o</Text>
          <View style={[styles.line, { backgroundColor: theme.icon }]} />
        </View>

        {/* Botón Panel Secreto */}
        <Button
          variant="secondary"
          onPress={() => {
            onClose();
            if (onOpenSecretPanel) onOpenSecretPanel();
          }}
          style={styles.secretButton}
        >
          <MaterialIcons name="admin-panel-settings" size={20} color="#fff" />
          <Button.Label>Panel Secreto</Button.Label>
        </Button>

        <Text style={[styles.disclaimer, { color: theme.icon }]}>
          Con tus avisos nos ayudas a mejorar la calidad del cantoral. Puedes
          incluir detalles como acordes incorrectos o mal colocados, letras con
          errores o problemas de formato.
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
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginBottom: 20,
  },
  submitButton: {
    marginBottom: 16,
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
    marginBottom: 16,
  },
});
