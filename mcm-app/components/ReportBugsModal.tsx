import { logger } from '@/utils/logger';
import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, ScrollView } from 'react-native';
import BottomSheet from './BottomSheet';
import AppPrimaryButton from '@/components/ui/AppPrimaryButton';
import AppTextField from '@/components/ui/AppTextField';
import { MaterialIcons } from '@/components/ui/icons';
import { Colors, themeColors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { radii } from '@/constants/uiStyles';
import { pushWithRetry } from '@/services/firebaseWrites';
import {
  getCategoryFromFirebaseCategory,
  cleanSongTitle,
} from '@/utils/songUtils';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';
import typography from '@/constants/typography';

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
  onSuccess?: () => void;
}

export default function ReportBugsModal({
  visible,
  onClose,
  songTitle,
  songFilename,
  firebaseCategory,
  onSuccess,
}: ReportBugsModalProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];
  const { profile } = useUserProfile();
  const resolved = useResolvedProfileConfig();
  const [bugDescription, setBugDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!bugDescription.trim()) return;
    setIsSubmitting(true);
    try {
      const category = firebaseCategory
        ? getCategoryFromFirebaseCategory(firebaseCategory)
        : 'catZotros';
      const cleanTitle = songTitle ? cleanSongTitle(songTitle) : 'Sin título';
      await pushWithRetry(`songs/fallitos/${category}/${cleanTitle}`, {
        description: bugDescription.trim(),
        timestamp: Date.now(),
        songTitle: songTitle || 'Sin título',
        songFilename: songFilename || 'Sin archivo',
        platform: Platform.OS,
        status: 'pending',
        reportedAt: new Date().toISOString(),
        userName: profile.name || 'Anónimo',
        userProfileType: profile.profileType ?? 'sin-perfil',
        userDelegation: resolved.delegationLabel || 'Sin delegación',
      });
      setBugDescription('');
      onClose();
      if (onSuccess) onSuccess();
    } catch (error) {
      logger.error('Error submitting bug report:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setBugDescription('');
    onClose();
  };

  const canSubmit = bugDescription.trim().length > 0 && !isSubmitting;

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      title="Reportar fallitos"
      paddingHorizontal={0}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        {songTitle && (
          <View
            style={[
              styles.songBadge,
              { backgroundColor: themeColors(isDark).background },
            ]}
          >
            <MaterialIcons name="music-note" size={14} color={theme.icon} />
            <Text
              style={[styles.songBadgeText, { color: theme.icon }]}
              numberOfLines={1}
            >
              {songTitle}
            </Text>
          </View>
        )}

        <Text style={[styles.label, { color: theme.text }]}>¿Qué falla?</Text>
        <Text style={[styles.sublabel, { color: theme.icon }]}>
          Acordes incorrectos, letra con errores, formato roto...
        </Text>

        <AppTextField
          accentWhenFilled
          style={styles.textArea}
          accessibilityLabel="¿Qué falla?"
          value={bugDescription}
          onChangeText={setBugDescription}
          maxLength={500}
          multiline
          numberOfLines={5}
          returnKeyType="default"
          editable={!isSubmitting}
        />
        <Text style={[styles.charCount, { color: theme.icon }]}>
          {bugDescription.length}/500
        </Text>

        {/* Botón principal */}
        <AppPrimaryButton
          label={isSubmitting ? 'Enviando...' : 'Enviar'}
          icon="bug-report"
          color="#FF3B30"
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={isSubmitting}
          style={styles.submitBtn}
        />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 48,
  },
  songBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
    marginBottom: 20,
  },
  songBadgeText: {
    ...typography.caption,
    fontStyle: 'italic',
    flex: 1,
  },
  label: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: 4,
  },
  sublabel: {
    ...typography.caption,
    marginBottom: 12,
    lineHeight: 18,
  },
  textArea: {
    minHeight: 120,
    lineHeight: 22,
  },
  charCount: {
    ...typography.micro,
    textAlign: 'right',
    marginTop: 6,
    marginBottom: 20,
  },
  submitBtn: {
    marginBottom: 4,
  },
});
