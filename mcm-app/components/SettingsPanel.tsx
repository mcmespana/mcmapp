import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Modal from 'react-native-modal';
import { MaterialIcons } from '@expo/vector-icons';
import useFontScale from '@/hooks/useFontScale';
import { useAppSettings, ThemeScheme } from '@/contexts/AppSettingsContext';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import UserProfileModal from './UserProfileModal';
import spacing from '@/constants/spacing';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const THEME_OPTIONS: {
  key: ThemeScheme;
  icon: string;
  label: string;
}[] = [
  { key: 'light', icon: 'light-mode', label: 'Claro' },
  { key: 'dark', icon: 'dark-mode', label: 'Oscuro' },
  { key: 'system', icon: 'brightness-auto', label: 'Auto' },
];

export default function SettingsPanel({ visible, onClose }: Props) {
  const { settings, setSettings } = useAppSettings();
  const scheme = useColorScheme();
  const theme = Colors[scheme];
  const fontScale = useFontScale();
  const featureFlags = useFeatureFlags();
  const [editVisible, setEditVisible] = useState(false);

  const increase = () => {
    setSettings({ fontScale: Math.min(settings.fontScale + 0.1, 2) });
  };

  const decrease = () => {
    setSettings({ fontScale: Math.max(1, settings.fontScale - 0.1) });
  };

  const surfaceBg =
    scheme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)';
  const segmentBg =
    scheme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)';

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      style={styles.modal}
      swipeDirection="down"
      onSwipeComplete={onClose}
      backdropOpacity={0.35}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Handle */}
        <View style={styles.handleRow}>
          <View
            style={[styles.handle, { backgroundColor: theme.icon + '40' }]}
          />
        </View>

        {/* Header */}
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.text }]}>Ajustes</Text>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: surfaceBg }]}
            accessibilityLabel="Cerrar"
            accessibilityRole="button"
          >
            <MaterialIcons name="close" size={18} color={theme.icon} />
          </TouchableOpacity>
        </View>

        {/* ── Sección: Apariencia ── */}
        <Text style={[styles.sectionLabel, { color: theme.icon }]}>
          APARIENCIA
        </Text>

        {/* Theme segmented control */}
        <View style={[styles.surface, { backgroundColor: surfaceBg }]}>
          <View style={styles.surfaceRow}>
            <MaterialIcons name="palette" size={20} color={theme.icon} />
            <Text style={[styles.surfaceLabel, { color: theme.text }]}>
              Tema
            </Text>
          </View>
          <View
            style={[styles.themeSegment, { backgroundColor: segmentBg }]}
          >
            {THEME_OPTIONS.map((opt) => {
              const isSelected = settings.theme === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.themeOption,
                    isSelected && {
                      backgroundColor: colors.primary,
                      shadowColor: colors.primary,
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.35,
                      shadowRadius: 4,
                      elevation: 3,
                    },
                  ]}
                  onPress={() => setSettings({ theme: opt.key })}
                  accessibilityLabel={`Tema ${opt.label}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                >
                  <MaterialIcons
                    name={opt.icon as any}
                    size={17}
                    color={isSelected ? '#fff' : theme.icon}
                  />
                  <Text
                    style={[
                      styles.themeOptionText,
                      { color: isSelected ? '#fff' : theme.icon },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Font size */}
        <View style={[styles.surface, { backgroundColor: surfaceBg }]}>
          <View style={styles.surfaceRow}>
            <MaterialIcons name="text-fields" size={20} color={theme.icon} />
            <Text style={[styles.surfaceLabel, { color: theme.text }]}>
              Tamaño de texto
            </Text>
          </View>
          <View style={styles.fontRow}>
            <TouchableOpacity
              onPress={decrease}
              disabled={settings.fontScale <= 1}
              style={[
                styles.fontBtn,
                { backgroundColor: segmentBg },
                settings.fontScale <= 1 && { opacity: 0.35 },
              ]}
              accessibilityLabel="Reducir tamaño de texto"
              accessibilityRole="button"
            >
              <MaterialIcons
                name="text-fields"
                size={20}
                color={theme.text}
                style={{ transform: [{ scaleY: 0.75 }] }}
              />
            </TouchableOpacity>

            <Text
              style={[
                styles.fontValue,
                { color: theme.text, fontSize: 16 * fontScale },
              ]}
            >
              {(settings.fontScale * 100).toFixed(0)}%
            </Text>

            <TouchableOpacity
              onPress={increase}
              disabled={settings.fontScale >= 2}
              style={[
                styles.fontBtn,
                { backgroundColor: segmentBg },
                settings.fontScale >= 2 && { opacity: 0.35 },
              ]}
              accessibilityLabel="Aumentar tamaño de texto"
              accessibilityRole="button"
            >
              <MaterialIcons
                name="text-fields"
                size={28}
                color={theme.text}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Sección: Mi cuenta (futura) ── */}
        {featureFlags.showChangeNameButton && (
          <>
            <Text style={[styles.sectionLabel, { color: theme.icon }]}>
              MI CUENTA
            </Text>
            <TouchableOpacity
              style={[styles.surface, { backgroundColor: surfaceBg }]}
              onPress={() => setEditVisible(true)}
              accessibilityRole="button"
            >
              <View style={[styles.surfaceRow, { flex: 1 }]}>
                <MaterialIcons name="person" size={20} color={theme.icon} />
                <Text style={[styles.surfaceLabel, { color: theme.text }]}>
                  ¿Cambiamos tu nombre?
                </Text>
              </View>
              <MaterialIcons
                name="chevron-right"
                size={20}
                color={theme.icon}
                style={{ opacity: 0.4 }}
              />
            </TouchableOpacity>
          </>
        )}
      </View>

      <UserProfileModal
        visible={editVisible}
        onClose={() => setEditVisible(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { justifyContent: 'flex-end', margin: 0 } as ViewStyle,
  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  } as ViewStyle,

  handleRow: {
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  } as ViewStyle,
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  } as ViewStyle,

  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  } as ViewStyle,
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  } as TextStyle,
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginLeft: 2,
  } as TextStyle,

  // Generic surface card
  surface: {
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    marginBottom: spacing.md,
    gap: spacing.sm + 2,
  } as ViewStyle,
  surfaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  } as ViewStyle,
  surfaceLabel: {
    fontSize: 15,
    fontWeight: '600',
  } as TextStyle,

  // Theme segmented control
  themeSegment: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    gap: 3,
  } as ViewStyle,
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 8,
  } as ViewStyle,
  themeOptionText: {
    fontSize: 12,
    fontWeight: '700',
  } as TextStyle,

  // Font size
  fontRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  } as ViewStyle,
  fontBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  fontValue: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 16,
  } as TextStyle,
});
