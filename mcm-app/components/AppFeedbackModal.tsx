import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ScrollView,
} from 'react-native';
import BottomSheet from './BottomSheet';
import { Button, CloseButton, TextField, TextArea, useToast } from 'heroui-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getDatabase, ref, push, set } from 'firebase/database';
import { getFirebaseApp } from '@/hooks/firebaseApp';
import { useUserProfile } from '@/contexts/UserProfileContext';

interface AppFeedbackModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type FeedbackCategory = 'bug' | 'suggestion' | 'congratulations';

/** Convierte hex + alpha-byte-hex a rgba() — heroui-native no entiende hex de 8 dígitos */
const hexAlpha = (hex: string, alphaHex: string): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const a = (parseInt(alphaHex, 16) / 255).toFixed(2);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

interface CategoryOption {
  id: FeedbackCategory;
  label: string;
  icon: string;
  color: string;
  placeholder: string;
  submitText: string;
}

const FEEDBACK_CATEGORIES: CategoryOption[] = [
  {
    id: 'bug',
    label: 'Fallito en la App',
    icon: 'bug-report',
    color: '#FF6B6B',
    placeholder:
      'Describe el problema que has encontrado en la aplicación (pantalla, función que no funciona, error, etc.)',
    submitText: 'Reportar fallito',
  },
  {
    id: 'suggestion',
    label: 'Sugerencia de mejora',
    icon: 'lightbulb',
    color: '#4ECDC4',
    placeholder:
      'Cuéntanos tu idea para mejorar la aplicación (nueva función, cambio de diseño, etc.)',
    submitText: 'Enviar sugerencia',
  },
  {
    id: 'congratulations',
    label: 'Felicitaciones',
    icon: 'favorite',
    color: '#FFD93D',
    placeholder:
      '¡Comparte tu experiencia positiva! Nos alegra saber qué te gusta de la app',
    submitText: 'Enviar felicitación',
  },
];

export default function AppFeedbackModal({
  visible,
  onClose,
  onSuccess,
}: AppFeedbackModalProps) {
  const scheme = useColorScheme();
  const theme = Colors[scheme];
  const { profile } = useUserProfile();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] =
    useState<FeedbackCategory | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedCategory) {
      toast.show({ variant: 'danger', label: 'Por favor selecciona una categoría' });
      return;
    }

    if (!feedbackText.trim()) {
      toast.show({ variant: 'danger', label: 'Por favor escribe tu comentario' });
      return;
    }

    setIsSubmitting(true);

    try {
      const db = getDatabase(getFirebaseApp());

      // Crear el path en Firebase: app/feedback/{categoria}
      const feedbackRef = ref(db, `app/feedback/${selectedCategory}`);

      // Crear un nuevo feedback en el array
      const newFeedbackRef = push(feedbackRef);

      await set(newFeedbackRef, {
        text: feedbackText.trim(),
        timestamp: Date.now(),
        platform: Platform.OS,
        status: 'pending', // pending, reviewed, resolved
        reportedAt: new Date().toISOString(),
        category: selectedCategory,
        userName: profile.name || 'Anónimo',
        userLocation: profile.location || 'Sin ubicación',
      });

      // Limpiar y cerrar
      setFeedbackText('');
      setSelectedCategory(null);
      onClose();

      // Notificar al componente padre para mostrar toast
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.show({ variant: 'danger', label: 'No se pudo enviar tu comentario. Inténtalo de nuevo.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (feedbackText.trim() || selectedCategory) {
      toast.show({
        variant: 'warning',
        label: '¿Cancelar el comentario? Se perderá lo escrito.',
        actionLabel: 'Sí, cancelar',
        onActionPress: ({ hide }) => {
          hide();
          setFeedbackText('');
          setSelectedCategory(null);
          onClose();
        },
      });
    } else {
      onClose();
    }
  };

  const selectedCategoryData = selectedCategory
    ? FEEDBACK_CATEGORIES.find((cat) => cat.id === selectedCategory)
    : null;

  return (
    <BottomSheet visible={visible} onClose={handleClose}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        overScrollMode="never"
      >
        <View style={styles.header}>
          <CloseButton onPress={handleClose} />
          <Text style={[styles.title, { color: theme.text }]}>
            ¿Fallitos? 🐛
          </Text>
          <View style={{ width: 36 }} />
        </View>

        <Text style={[styles.subtitle, { color: theme.icon }]}>
          Tu opinión nos ayuda a mejorar la app
        </Text>

        {!selectedCategory ? (
          <>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              ¿Qué quieres contarnos?
            </Text>

            {FEEDBACK_CATEGORIES.map((category) => (
              <Button
                key={category.id}
                variant="outline"
                onPress={() => setSelectedCategory(category.id)}
                style={[
                  styles.categoryButton,
                  {
                    backgroundColor:
                      scheme === 'dark'
                        ? hexAlpha(category.color, '15')
                        : hexAlpha(category.color, '10'),
                    borderColor: hexAlpha(category.color, '40'),
                  },
                ]}
              >
                <View style={styles.categoryContent}>
                  <View style={styles.categoryInfo}>
                    <MaterialIcons
                      name={category.icon as any}
                      size={28}
                      color={category.color}
                    />
                    <Button.Label style={{ color: theme.text }}>
                      {category.label}
                    </Button.Label>
                  </View>
                  <MaterialIcons
                    name="chevron-right"
                    size={20}
                    color={theme.icon}
                  />
                </View>
              </Button>
            ))}
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              onPress={() => setSelectedCategory(null)}
              style={styles.backButton}
            >
              <MaterialIcons name="arrow-back" size={20} color={theme.icon} />
              <Button.Label style={{ color: theme.icon }}>
                Cambiar categoría
              </Button.Label>
            </Button>

            <View style={styles.selectedCategory}>
              <MaterialIcons
                name={selectedCategoryData!.icon as any}
                size={32}
                color={selectedCategoryData!.color}
              />
              <Text
                style={[styles.selectedCategoryText, { color: theme.text }]}
              >
                {selectedCategoryData!.label}
              </Text>
            </View>

            <TextField style={{ marginBottom: 4 }}>
              <TextArea
                placeholder={selectedCategoryData!.placeholder}
                value={feedbackText}
                onChangeText={setFeedbackText}
                maxLength={1000}
              />
            </TextField>

            <Text style={[styles.charCount, { color: theme.icon }]}>
              {feedbackText.length}/1000 caracteres
            </Text>

            <Button
              variant="primary"
              isDisabled={!feedbackText.trim() || isSubmitting}
              onPress={handleSubmit}
              style={styles.submitButton}
            >
              <MaterialIcons
                name={
                  isSubmitting
                    ? 'hourglass-empty'
                    : (selectedCategoryData!.icon as any)
                }
                size={20}
                color="#fff"
              />
              <Button.Label>
                {isSubmitting ? 'Enviando...' : selectedCategoryData!.submitText}
              </Button.Label>
            </Button>
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  categoriesContainer: {
    marginBottom: 24,
  },
  categoryButton: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1.5,
    height: 'auto',
  },
  categoryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  backButton: {
    marginBottom: 16,
  },
  selectedCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  selectedCategoryText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  categoryForm: {
    marginBottom: 20,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 16,
  },
  input: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    marginBottom: 8,
  },
});
