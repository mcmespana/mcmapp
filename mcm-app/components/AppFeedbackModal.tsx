import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  Button,
  CloseButton,
  TextArea,
  TextField,
  useToast,
} from 'heroui-native';
import { getDatabase, push, ref, set } from 'firebase/database';

import BottomSheet from './BottomSheet';
import { Colors } from '@/constants/colors';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { getFirebaseApp } from '@/hooks/firebaseApp';
import { useColorScheme } from '@/hooks/useColorScheme';
import { hexAlpha } from '@/utils/colorUtils';

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
    label: 'Fallito en la app',
    icon: 'bug-report',
    color: '#FF6B6B',
    placeholder:
      'Describe el problema que has encontrado en la aplicacion (pantalla, funcion que no funciona, error, etc.)',
    submitText: 'Reportar fallito',
  },
  {
    id: 'suggestion',
    label: 'Sugerencia de mejora',
    icon: 'lightbulb',
    color: '#4ECDC4',
    placeholder:
      'Cuentanos tu idea para mejorar la aplicacion (nueva funcion, cambio de diseno, etc.)',
    submitText: 'Enviar sugerencia',
  },
  {
    id: 'congratulations',
    label: 'Felicitaciones',
    icon: 'favorite',
    color: '#FFD93D',
    placeholder:
      'Comparte tu experiencia positiva. Nos alegra saber que te gusta de la app.',
    submitText: 'Enviar felicitacion',
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
      toast.show({
        variant: 'danger',
        label: 'Por favor selecciona una categoria',
      });
      return;
    }

    if (!feedbackText.trim()) {
      toast.show({
        variant: 'danger',
        label: 'Por favor escribe tu comentario',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const db = getDatabase(getFirebaseApp());
      const feedbackRef = ref(db, `app/feedback/${selectedCategory}`);
      const newFeedbackRef = push(feedbackRef);

      await set(newFeedbackRef, {
        text: feedbackText.trim(),
        timestamp: Date.now(),
        platform: Platform.OS,
        status: 'pending',
        reportedAt: new Date().toISOString(),
        category: selectedCategory,
        userName: profile.name || 'Anonimo',
        userLocation: profile.location || 'Sin ubicacion',
      });

      setFeedbackText('');
      setSelectedCategory(null);
      onClose();
      onSuccess?.();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.show({
        variant: 'danger',
        label: 'No se pudo enviar tu comentario. Intentalo de nuevo.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (feedbackText.trim() || selectedCategory) {
      toast.show({
        variant: 'warning',
        label: 'Cancelar el comentario? Se perdera lo escrito.',
        actionLabel: 'Si, cancelar',
        onActionPress: ({ hide }) => {
          hide();
          setFeedbackText('');
          setSelectedCategory(null);
          onClose();
        },
      });
      return;
    }

    onClose();
  };

  const selectedCategoryData = selectedCategory
    ? FEEDBACK_CATEGORIES.find((category) => category.id === selectedCategory)
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
          <Text style={[styles.title, { color: theme.text }]}>Fallitos?</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text style={[styles.subtitle, { color: theme.icon }]}>
          Tu opinion nos ayuda a mejorar la app
        </Text>

        {!selectedCategory ? (
          <>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Que quieres contarnos?
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
                      name={
                        category.icon as keyof typeof MaterialIcons.glyphMap
                      }
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
                Cambiar categoria
              </Button.Label>
            </Button>

            <View style={styles.selectedCategory}>
              <MaterialIcons
                name={
                  selectedCategoryData!
                    .icon as keyof typeof MaterialIcons.glyphMap
                }
                size={32}
                color={selectedCategoryData!.color}
              />
              <Text
                style={[styles.selectedCategoryText, { color: theme.text }]}
              >
                {selectedCategoryData!.label}
              </Text>
            </View>

            <TextField style={styles.fieldWrapper}>
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
                    : (selectedCategoryData!
                        .icon as keyof typeof MaterialIcons.glyphMap)
                }
                size={20}
                color="#fff"
              />
              <Button.Label>
                {isSubmitting
                  ? 'Enviando...'
                  : selectedCategoryData!.submitText}
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
  headerSpacer: {
    width: 36,
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
  fieldWrapper: {
    marginBottom: 4,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 16,
  },
  submitButton: {
    marginBottom: 8,
  },
});
