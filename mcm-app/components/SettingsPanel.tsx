import React, { useState } from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { CloseButton, PressableFeedback, useToast } from 'heroui-native';
import { MaterialIcons } from '@expo/vector-icons';
import useFontScale from '@/hooks/useFontScale';
import { useAppSettings, ThemeScheme } from '@/contexts/AppSettingsContext';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Clipboard from 'expo-clipboard';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import UserProfileModal from './UserProfileModal';
import BottomSheet from './BottomSheet';
import spacing from '@/constants/spacing';
import { radii } from '@/constants/uiStyles';

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
  const { toast } = useToast();
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
    <>
      <BottomSheet visible={visible} onClose={onClose}>
        <View style={[styles.container, { backgroundColor: theme.background }]}>
          {/* Header */}
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.text }]}>Ajustes</Text>
            <CloseButton onPress={onClose} />
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
            <View style={[styles.themeSegment, { backgroundColor: segmentBg }]}>
              {THEME_OPTIONS.map((opt) => {
                const isSelected = settings.theme === opt.key;
                return (
                  <PressableFeedback
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
                    <PressableFeedback.Highlight />
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
                  </PressableFeedback>
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
              <PressableFeedback
                onPress={settings.fontScale <= 1 ? undefined : decrease}
                style={[
                  styles.fontBtn,
                  { backgroundColor: segmentBg },
                  settings.fontScale <= 1 && { opacity: 0.35 },
                ]}
                accessibilityLabel="Reducir tamaño de texto"
                accessibilityRole="button"
              >
                <PressableFeedback.Highlight />
                <MaterialIcons
                  name="text-fields"
                  size={20}
                  color={theme.text}
                  style={{ transform: [{ scaleY: 0.75 }] }}
                />
              </PressableFeedback>

              <Text
                style={[
                  styles.fontValue,
                  { color: theme.text, fontSize: 16 * fontScale },
                ]}
              >
                {(settings.fontScale * 100).toFixed(0)}%
              </Text>

              <PressableFeedback
                onPress={settings.fontScale >= 2 ? undefined : increase}
                style={[
                  styles.fontBtn,
                  { backgroundColor: segmentBg },
                  settings.fontScale >= 2 && { opacity: 0.35 },
                ]}
                accessibilityLabel="Aumentar tamaño de texto"
                accessibilityRole="button"
              >
                <PressableFeedback.Highlight />
                <MaterialIcons
                  name="text-fields"
                  size={28}
                  color={theme.text}
                />
              </PressableFeedback>
            </View>
          </View>

          {/* ── Sección: Mi cuenta ── */}
          {featureFlags.showChangeNameButton && (
            <>
              <Text style={[styles.sectionLabel, { color: theme.icon }]}>
                MI CUENTA
              </Text>
              <PressableFeedback
                style={[
                  styles.surface,
                  styles.surfaceClickable,
                  { backgroundColor: surfaceBg },
                ]}
                onPress={() => setEditVisible(true)}
                accessibilityRole="button"
              >
                <PressableFeedback.Highlight />
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
              </PressableFeedback>
            </>
          )}

          {/* ── Sección: Debug ── */}
          <Text
            style={[
              styles.sectionLabel,
              { color: theme.icon, marginTop: spacing.md },
            ]}
          >
            DEPURACIÓN
          </Text>
          <PressableFeedback
            style={[
              styles.surface,
              styles.surfaceClickable,
              { backgroundColor: surfaceBg },
            ]}
            onPress={async () => {
              try {
                const projectId =
                  Constants?.expoConfig?.extra?.eas?.projectId ??
                  Constants?.easConfig?.projectId;
                const { data } = await Notifications.getExpoPushTokenAsync(
                  projectId ? { projectId } : undefined,
                );
                await Clipboard.setStringAsync(data);
                toast.show({
                  variant: 'success',
                  label: 'Expo Token copiado al portapapeles',
                });
              } catch (err) {
                toast.show({
                  variant: 'danger',
                  label: 'Error obteniendo token: ' + String(err),
                });
              }
            }}
            accessibilityRole="button"
          >
            <PressableFeedback.Highlight />
            <View style={[styles.surfaceRow, { flex: 1 }]}>
              <MaterialIcons name="bug-report" size={20} color={theme.icon} />
              <Text style={[styles.surfaceLabel, { color: theme.text }]}>
                Copiar Expo Push Token
              </Text>
            </View>
            <MaterialIcons
              name="content-copy"
              size={20}
              color={theme.icon}
              style={{ opacity: 0.4 }}
            />
          </PressableFeedback>
        </View>
      </BottomSheet>

      <UserProfileModal
        visible={editVisible}
        onClose={() => setEditVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
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

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginLeft: 2,
  } as TextStyle,

  // Generic surface card
  surface: {
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    marginBottom: spacing.md,
    gap: spacing.sm + 2,
  } as ViewStyle,
  surfaceClickable: {
    flexDirection: 'row',
    alignItems: 'center',
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
    borderRadius: radii.sm,
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
