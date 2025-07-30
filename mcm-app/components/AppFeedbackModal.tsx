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
import { useUserProfile } from '@/contexts/UserProfileContext';

interface AppFeedbackModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type FeedbackCategory = 'bug' | 'suggestion' | 'congratulations';

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
  const [selectedCategory, setSelectedCategory] =
    useState<FeedbackCategory | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedCategory) {
      Alert.alert('Error', 'Por favor selecciona una categoría');
      return;
    }

    if (!feedbackText.trim()) {
      Alert.alert('Error', 'Por favor escribe tu comentario');
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
        userName: profile.name,
        userLocation: profile.location,
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
      Alert.alert(
        'Error',
        'No se pudo enviar tu comentario. ¿Lo intentamos de nuevo?',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (feedbackText.trim() || selectedCategory) {
      Alert.alert(
        'Cancelar',
        '¿Estás seguro de que quieres cancelar? Se perderá lo que has escrito.',
        [
          { text: 'Seguir escribiendo', style: 'cancel' },
          {
            text: 'Cancelar',
            style: 'destructive',
            onPress: () => {
              setFeedbackText('');
              setSelectedCategory(null);
              onClose();
            },
          },
        ],
      );
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
          <TouchableOpacity onPress={handleClose} accessibilityLabel="Cerrar">
            <MaterialIcons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>
            ¿Fallitos? 🐛
          </Text>
          <View style={{ width: 24 }} />
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
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryButton,
                  {
                    backgroundColor:
                      scheme === 'dark'
                        ? `${category.color}15`
                        : `${category.color}10`,
                    borderColor: category.color + '40',
                    borderWidth: 1.5,
                  },
                ]}
                onPress={() => setSelectedCategory(category.id)}
              >
                <View style={styles.categoryContent}>
                  <View style={styles.categoryInfo}>
                    <MaterialIcons
                      name={category.icon as any}
                      size={28}
                      color={category.color}
                    />
                    <Text style={[styles.categoryLabel, { color: theme.text }]}>
                      {category.label}
                    </Text>
                  </View>
                  <MaterialIcons
                    name="chevron-right"
                    size={20}
                    color={theme.icon}
                  />
                </View>
              </TouchableOpacity>
            ))}
          </>
        ) : (
          <>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setSelectedCategory(null)}
            >
              <MaterialIcons name="arrow-back" size={20} color={theme.icon} />
              <Text style={[styles.backText, { color: theme.icon }]}>
                Cambiar categoría
              </Text>
            </TouchableOpacity>

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

            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: scheme === 'dark' ? '#2C2C2E' : '#F2F2F7',
                  color: theme.text,
                  borderColor: theme.icon + '30',
                },
              ]}
              placeholder={selectedCategoryData!.placeholder}
              placeholderTextColor={theme.icon}
              value={feedbackText}
              onChangeText={setFeedbackText}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
              maxLength={1000}
            />

            <Text style={[styles.charCount, { color: theme.icon }]}>
              {feedbackText.length}/1000 caracteres
            </Text>

            <TouchableOpacity
              style={[
                styles.submitButton,
                {
                  backgroundColor: feedbackText.trim()
                    ? selectedCategoryData!.color
                    : theme.icon,
                  opacity: isSubmitting ? 0.7 : 1,
                },
              ]}
              onPress={handleSubmit}
              disabled={!feedbackText.trim() || isSubmitting}
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
              <Text style={styles.submitButtonText}>
                {isSubmitting
                  ? 'Enviando...'
                  : selectedCategoryData!.submitText}
              </Text>
            </TouchableOpacity>
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
    borderWidth: 1,
    borderColor: '#E0E0E0',
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
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backText: {
    marginLeft: 8,
    fontSize: 16,
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
  textInput: {
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    fontSize: 16,
    minHeight: 150,
    maxHeight: 250,
    textAlignVertical: 'top',
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
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
