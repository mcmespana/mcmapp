import { logger } from '@/utils/logger';
import React, { useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { getDatabase, push, ref, set } from 'firebase/database';

import BottomSheet from './BottomSheet';
import AppPrimaryButton from '@/components/ui/AppPrimaryButton';
import AppTextField from '@/components/ui/AppTextField';
import SectionHeader from '@/components/ui/SectionHeader';
import { Colors, FeedbackCategoryColors } from '@/constants/colors';
import { radii } from '@/constants/uiStyles';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';
import { getFirebaseApp } from '@/utils/firebaseApp';
import { useColorScheme } from '@/hooks/useColorScheme';
import { hexAlpha } from '@/utils/colorUtils';

// Apple system color used inside the modal — not part of the MCM brand
// palette, but matches iOS native conventions for "destructive text".
const APPLE_SYSTEM_RED = '#FF3B30';

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
    color: FeedbackCategoryColors.bug,
    placeholder:
      'Describe el problema que has encontrado en la aplicación (pantalla, función que no funciona, error...)',
    submitText: 'Reportar fallito',
  },
  {
    id: 'suggestion',
    label: 'Sugerencia de mejora',
    icon: 'lightbulb',
    color: FeedbackCategoryColors.idea,
    placeholder:
      'Cuéntanos tu idea para mejorar la aplicación (nueva función, cambio de diseño...)',
    submitText: 'Enviar sugerencia',
  },
  {
    id: 'congratulations',
    label: 'Felicitaciones',
    icon: 'favorite',
    color: FeedbackCategoryColors.praise,
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
  const theme = Colors[scheme ?? 'light'];
  const { profile } = useUserProfile();
  const resolved = useResolvedProfileConfig();
  const [selectedCategory, setSelectedCategory] =
    useState<FeedbackCategory | null>(null);
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
        userProfileType: profile.profileType ?? 'sin-perfil',
        userDelegation: resolved.delegationLabel || 'Sin delegación',
      });

      setFeedbackText('');
      setSelectedCategory(null);
      onClose();
      onSuccess?.();
    } catch (error) {
      logger.error('Error submitting feedback:', error);
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

  const canSubmit =
    !!selectedCategory && feedbackText.trim().length > 0 && !isSubmitting;

  const headerLeft = selectedCategory ? (
    <TouchableOpacity
      onPress={() => {
        setSelectedCategory(null);
        setErrorMsg('');
      }}
      accessibilityRole="button"
      accessibilityLabel="Cambiar categoría"
      style={{ padding: 4 }}
      activeOpacity={0.7}
    >
      <MaterialIcons name="arrow-back" size={22} color={theme.text} />
    </TouchableOpacity>
  ) : undefined;

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      title="Feedback 💬"
      headerLeft={headerLeft}
      paddingHorizontal={0}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        overScrollMode="never"
        contentContainerStyle={styles.content}
      >
        <Text style={[styles.subtitle, { color: theme.icon }]}>
          Tu opinión nos ayuda a mejorar la app
        </Text>

        {!selectedCategory ? (
          <>
            <SectionHeader label="¿Qué quieres contarnos?" />

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
                onPress={() => {
                  setSelectedCategory(category.id);
                  setErrorMsg('');
                }}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name={category.icon}
                  size={28}
                  color={category.color}
                />
                <Text style={[styles.categoryBtnText, { color: theme.text }]}>
                  {category.label}
                </Text>
                <MaterialIcons
                  name="chevron-right"
                  size={20}
                  color={theme.icon}
                  style={styles.categoryArrow}
                />
              </TouchableOpacity>
            ))}
          </>
        ) : (
          <>
            <View
              style={[
                styles.selectedCategoryRow,
                {
                  backgroundColor: isDark
                    ? Colors.dark.background
                    : hexAlpha(theme.icon, '14'),
                },
              ]}
            >
              <MaterialIcons
                name={selectedCategoryData!.icon}
                size={26}
                color={selectedCategoryData!.color}
              />
              <Text
                style={[styles.selectedCategoryText, { color: theme.text }]}
              >
                {selectedCategoryData!.label}
              </Text>
            </View>

            <AppTextField
              accentWhenFilled
              style={styles.textArea}
              placeholder={selectedCategoryData!.placeholder}
              value={feedbackText}
              onChangeText={(t) => {
                setFeedbackText(t);
                setErrorMsg('');
              }}
              maxLength={1000}
              multiline
              numberOfLines={5}
              editable={!isSubmitting}
            />
            <Text style={[styles.charCount, { color: theme.icon }]}>
              {feedbackText.length}/1000
            </Text>

            {errorMsg ? (
              <View style={styles.errorRow}>
                <MaterialIcons
                  name="error-outline"
                  size={15}
                  color={APPLE_SYSTEM_RED}
                />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            <AppPrimaryButton
              label={
                isSubmitting ? 'Enviando...' : selectedCategoryData!.submitText
              }
              icon={selectedCategoryData!.icon}
              color={selectedCategoryData!.color}
              onPress={handleSubmit}
              disabled={!canSubmit}
              loading={isSubmitting}
            />
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
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
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
    color: APPLE_SYSTEM_RED,
    fontSize: 13,
    fontWeight: '500',
  },
});
