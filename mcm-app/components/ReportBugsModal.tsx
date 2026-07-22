import { logger } from '@/utils/logger';
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
} from 'react-native';
import BottomSheet from './BottomSheet';
import AppPrimaryButton from '@/components/ui/AppPrimaryButton';
import AppTextField from '@/components/ui/AppTextField';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { radii } from '@/constants/uiStyles';
import { getDatabase, ref, push, set } from 'firebase/database';
import { getFirebaseApp } from '@/utils/firebaseApp';
import {
  getCategoryFromFirebaseCategory,
  cleanSongTitle,
} from '@/utils/songUtils';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';

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
  onOpenSecretPanel?: () => void;
}

export default function ReportBugsModal({
  visible,
  onClose,
  songTitle,
  songFilename,
  firebaseCategory,
  onSuccess,
  onOpenSecretPanel,
}: ReportBugsModalProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];
  const { profile } = useUserProfile();
  const resolved = useResolvedProfileConfig();
  const [bugDescription, setBugDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // iOS no puede mostrar dos Modal a la vez: si abrimos el panel secreto en el
  // mismo tick que cerramos este sheet, el secreto nunca se monta. Marcamos la
  // intención y la disparamos en onCloseComplete (tras el onDismiss del Modal).
  const openSecretAfterClose = useRef(false);

  const handleSubmit = async () => {
    if (!bugDescription.trim()) return;
    setIsSubmitting(true);
    try {
      const db = getDatabase(getFirebaseApp());
      const category = firebaseCategory
        ? getCategoryFromFirebaseCategory(firebaseCategory)
        : 'catZotros';
      const cleanTitle = songTitle ? cleanSongTitle(songTitle) : 'Sin título';
      const fallitosRef = ref(db, `songs/fallitos/${category}/${cleanTitle}`);
      const newFallitoRef = push(fallitosRef);
      await set(newFallitoRef, {
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
      onCloseComplete={() => {
        if (openSecretAfterClose.current) {
          openSecretAfterClose.current = false;
          onOpenSecretPanel?.();
        }
      }}
      title="Reportar fallitos 🐛"
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
              { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' },
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
          placeholder="Describe los fallos que has encontrado..."
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
          label={isSubmitting ? 'Enviando...' : 'Notificar fallitos'}
          icon="bug-report"
          color="#FF3B30"
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={isSubmitting}
          style={styles.submitBtn}
        />

        {/* Divisor */}
        <View style={styles.divider}>
          <View
            style={[
              styles.dividerLine,
              { backgroundColor: isDark ? '#3A3A3C' : '#E5E5EA' },
            ]}
          />
          <Text style={[styles.dividerLabel, { color: theme.icon }]}>o</Text>
          <View
            style={[
              styles.dividerLine,
              { backgroundColor: isDark ? '#3A3A3C' : '#E5E5EA' },
            ]}
          />
        </View>

        {/* Panel secreto */}
        <TouchableOpacity
          style={[
            styles.secretBtn,
            { borderColor: isDark ? '#3A3A3C' : '#E5E5EA' },
          ]}
          onPress={() => {
            openSecretAfterClose.current = true;
            handleClose();
          }}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name="admin-panel-settings"
            size={18}
            color={theme.icon}
          />
          <Text style={[styles.secretBtnText, { color: theme.icon }]}>
            Panel Secreto
          </Text>
        </TouchableOpacity>

        <Text style={[styles.disclaimer, { color: theme.icon }]}>
          Con tus avisos nos ayudas a mejorar la calidad del cantoral.
        </Text>
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
    fontSize: 13,
    fontStyle: 'italic',
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  sublabel: {
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18,
  },
  textArea: {
    minHeight: 120,
    lineHeight: 22,
  },
  charCount: {
    fontSize: 11,
    textAlign: 'right',
    marginTop: 6,
    marginBottom: 20,
  },
  submitBtn: {
    marginBottom: 4,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  secretBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: radii.md,
    borderWidth: 1.5,
    marginBottom: 20,
  },
  secretBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
