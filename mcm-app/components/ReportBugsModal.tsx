import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import BottomSheet from './BottomSheet';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { radii } from '@/constants/uiStyles';
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
  const theme = Colors[scheme];
  const { profile } = useUserProfile();
  const [bugDescription, setBugDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        userLocation: profile.location || 'Sin ubicación',
      });
      setBugDescription('');
      onClose();
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error submitting bug report:', error);
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
    <BottomSheet visible={visible} onClose={handleClose}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
          <Text style={[styles.title, { color: theme.text }]}>
            Reportar fallitos 🐛
          </Text>
          <View style={styles.headerSpacer} />
        </View>

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

        <TextInput
          style={[
            styles.textArea,
            {
              backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
              color: theme.text,
              borderColor: bugDescription.trim()
                ? '#34C759'
                : isDark
                  ? '#3A3A3C'
                  : '#E5E5EA',
            },
          ]}
          placeholder="Describe los fallos que has encontrado..."
          placeholderTextColor={theme.icon}
          value={bugDescription}
          onChangeText={setBugDescription}
          maxLength={500}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          returnKeyType="default"
          editable={!isSubmitting}
        />
        <Text style={[styles.charCount, { color: theme.icon }]}>
          {bugDescription.length}/500
        </Text>

        {/* Botón principal */}
        <TouchableOpacity
          style={[
            styles.submitBtn,
            {
              backgroundColor: canSubmit
                ? '#FF3B30'
                : isDark
                  ? '#3A3A3C'
                  : '#E5E5EA',
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
              name="bug-report"
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
            {isSubmitting ? 'Enviando...' : 'Notificar fallitos'}
          </Text>
        </TouchableOpacity>

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
            handleClose();
            if (onOpenSecretPanel) onOpenSecretPanel();
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
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
    marginBottom: 20,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: radii.md,
    marginBottom: 4,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
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
