import React, { useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { getDatabase, push, ref, set } from 'firebase/database';

import BottomSheet from './BottomSheet';
import { Colors } from '@/constants/colors';
import { radii } from '@/constants/uiStyles';
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
  icon: keyof typeof MaterialIcons.glyphMap;
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
      'Describe el problema que has encontrado en la aplicación (pantalla, función que no funciona, error...)',
    submitText: 'Reportar fallito',
  },
  {
    id: 'suggestion',
    label: 'Sugerencia de mejora',
    icon: 'lightbulb',
    color: '#4ECDC4',
    placeholder:
      'Cuéntanos tu idea para mejorar la aplicación (nueva función, cambio de diseño...)',
    submitText: 'Enviar sugerencia',
  },
  {
    id: 'congratulations',
    label: 'Felicitaciones',
    icon: 'favorite',
    color: '#FFD93D',
    placeholder:
      'Comparte tu experiencia positiva. ¡Nos alegra saber qué te gusta de la app!',
    submitText: 'Enviar felicitación',
  },
];

export default function AppFeedbackModal({
  visible,
  onClose,
  onSuccess,
}: AppFeedbackModalProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = Colors[scheme];
  const { profile } = useUserProfile();
  const [selectedCategory, setSelectedCategory] = useState<FeedbackCategory | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async () => {
    if (!selectedCategory) {
      setErrorMsg('Por favor selecciona una categoría');
      return;
    }
    if (!feedbackText.trim()) {
      setErrorMsg('Por favor escribe tu comentario');
      return;
    }
    setErrorMsg('');
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
        userName: profile.name || 'Anónimo',
        userLocation: profile.location || 'Sin ubicación',
      });

      setFeedbackText('');
      setSelectedCategory(null);
      onClose();
      onSuccess?.();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      setErrorMsg('No se pudo enviar. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFeedbackText('');
    setSelectedCategory(null);
    setErrorMsg('');
    onClose();
  };

  const selectedCategoryData = selectedCategory
    ? FEEDBACK_CATEGORIES.find((c) => c.id === selectedCategory)
    : null;

  const canSubmit = !!selectedCategory && feedbackText.trim().length > 0 && !isSubmitting;

  return (
    <BottomSheet visible={visible} onClose={handleClose}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        overScrollMode="never"
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <MaterialIcons name="close" size={22} color={theme.icon} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>Feedback 💬</Text>
          <View style={styles.headerSpacer} />
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
                  styles.categoryBtn,
                  {
                    backgroundColor: isDark
                      ? hexAlpha(category.color, '15')
                      : hexAlpha(category.color, '10'),
                    borderColor: hexAlpha(category.color, '40'),
                  },
                ]}
                onPress={() => { setSelectedCategory(category.id); setErrorMsg(''); }}
                activeOpacity={0.7}
              >
                <MaterialIcons name={category.icon} size={28} color={category.color} />
                <Text style={[styles.categoryBtnText, { color: theme.text }]}>
                  {category.label}
                </Text>
                <MaterialIcons name="chevron-right" size={20} color={theme.icon} style={styles.categoryArrow} />
              </TouchableOpacity>
            ))}
          </>
        ) : (
          <>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => { setSelectedCategory(null); setErrorMsg(''); }}
              activeOpacity={0.7}
            >
              <MaterialIcons name="arrow-back" size={18} color={theme.icon} />
              <Text style={[styles.backBtnText, { color: theme.icon }]}>
                Cambiar categoría
              </Text>
            </TouchableOpacity>

            <View style={[styles.selectedCategoryRow, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}>
              <MaterialIcons
                name={selectedCategoryData!.icon}
                size={26}
                color={selectedCategoryData!.color}
              />
              <Text style={[styles.selectedCategoryText, { color: theme.text }]}>
                {selectedCategoryData!.label}
              </Text>
            </View>

            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
                  color: theme.text,
                  borderColor: feedbackText.trim()
                    ? '#34C759'
                    : isDark ? '#3A3A3C' : '#E5E5EA',
                },
              ]}
              placeholder={selectedCategoryData!.placeholder}
              placeholderTextColor={theme.icon}
              value={feedbackText}
              onChangeText={(t) => { setFeedbackText(t); setErrorMsg(''); }}
              maxLength={1000}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              editable={!isSubmitting}
            />
            <Text style={[styles.charCount, { color: theme.icon }]}>
              {feedbackText.length}/1000
            </Text>

            {errorMsg ? (
              <View style={styles.errorRow}>
                <MaterialIcons name="error-outline" size={15} color="#FF3B30" />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[
                styles.submitBtn,
                {
                  backgroundColor: canSubmit
                    ? selectedCategoryData!.color
                    : isDark ? '#3A3A3C' : '#E5E5EA',
                },
              ]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <MaterialIcons
                  name={selectedCategoryData!.icon}
                  size={18}
                  color={canSubmit ? '#fff' : theme.icon}
                />
              )}
              <Text
                style={[
                  styles.submitBtnText,
                  { color: canSubmit ? '#fff' : theme.icon },
                ]}
              >
                {isSubmitting ? 'Enviando...' : selectedCategoryData!.submitText}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 48,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 32,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  categoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: radii.lg,
    marginBottom: 10,
    borderWidth: 1.5,
  },
  categoryBtnText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  categoryArrow: {
    marginLeft: 'auto',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    paddingVertical: 4,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
  selectedCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.md,
    marginBottom: 16,
  },
  selectedCategoryText: {
    fontSize: 15,
    fontWeight: '600',
  },
  textArea: {
    borderWidth: 1.5,
    borderRadius: radii.md,
    padding: 14,
    fontSize: 15,
    minHeight: 120,
    lineHeight: 22,
  },
  charCount: {
    fontSize: 11,
    textAlign: 'right',
    marginTop: 6,
    marginBottom: 16,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 13,
    fontWeight: '500',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: radii.md,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
