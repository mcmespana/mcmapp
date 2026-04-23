import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { CloseButton, PressableFeedback, useToast } from 'heroui-native';
import { MaterialIcons } from '@expo/vector-icons';
import useFontScale from '@/hooks/useFontScale';
import { useAppSettings, ThemeScheme } from '@/contexts/AppSettingsContext';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import Constants from 'expo-constants';
import * as Clipboard from 'expo-clipboard';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';
import { useProfileConfigContext } from '@/contexts/ProfileConfigContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import type { ProfileType } from '@/types/profileConfig';
import BottomSheet from './BottomSheet';
import spacing from '@/constants/spacing';
import { radii } from '@/constants/uiStyles';
import { hexAlpha } from '@/utils/colorUtils';

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
  const resolved = useResolvedProfileConfig();
  const { rawConfig } = useProfileConfigContext();
  const { profile, setProfile } = useUserProfile();
  const { toast } = useToast();
  const [profileSelectorOpen, setProfileSelectorOpen] = useState(false);
  const [delegationSelectorOpen, setDelegationSelectorOpen] = useState(false);

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
  const accentColor = scheme === 'dark' ? colors.info : colors.primary;

  const delegationLabel = useMemo(() => {
    if (!profile.delegationId) return 'Sin delegación';
    const found = rawConfig.delegationList.find(
      (d) => d.id === profile.delegationId,
    );
    return found?.label ?? resolved.delegationLabel ?? 'Sin delegación';
  }, [
    profile.delegationId,
    rawConfig.delegationList,
    resolved.delegationLabel,
  ]);

  const profileLabel = profile.profileType
    ? (rawConfig.profiles[profile.profileType]?.label ?? resolved.profileLabel)
    : 'Sin elegir';

  const handleSelectProfile = (profileType: ProfileType) => {
    setProfile({ profileType, onboardingCompleted: true });
    setProfileSelectorOpen(false);
  };

  const handleSelectDelegation = (delegationId: string | null) => {
    setProfile({
      delegationId,
      onboardingCompleted: true,
    });
    setDelegationSelectorOpen(false);
  };

  return (
    <>
      <BottomSheet visible={visible} onClose={onClose}>
        <View style={[styles.container, { backgroundColor: theme.background }]}>
          {/* Header */}
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.text }]}>Ajustes</Text>
            <CloseButton onPress={onClose} />
          </View>

          {/* ── Sección: Tu perfil MCM ── */}
          <Text style={[styles.sectionLabel, { color: theme.icon }]}>
            TU PERFIL EN MCM
          </Text>

          <PressableFeedback
            style={[
              styles.surface,
              styles.surfaceClickable,
              { backgroundColor: surfaceBg },
            ]}
            onPress={() => setProfileSelectorOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Cambiar perfil"
          >
            <PressableFeedback.Highlight />
            <View style={[styles.surfaceRow, { flex: 1 }]}>
              <MaterialIcons name="person" size={20} color={theme.icon} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.surfaceLabel, { color: theme.text }]}>
                  Perfil
                </Text>
                <Text style={[styles.surfaceHint, { color: theme.icon }]}>
                  {profileLabel}
                </Text>
              </View>
            </View>
            <MaterialIcons
              name="chevron-right"
              size={20}
              color={theme.icon}
              style={{ opacity: 0.4 }}
            />
          </PressableFeedback>

          <PressableFeedback
            style={[
              styles.surface,
              styles.surfaceClickable,
              { backgroundColor: surfaceBg },
            ]}
            onPress={() => setDelegationSelectorOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Cambiar delegación"
          >
            <PressableFeedback.Highlight />
            <View style={[styles.surfaceRow, { flex: 1 }]}>
              <MaterialIcons name="place" size={20} color={theme.icon} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.surfaceLabel, { color: theme.text }]}>
                  Delegación
                </Text>
                <Text style={[styles.surfaceHint, { color: theme.icon }]}>
                  {delegationLabel}
                </Text>
              </View>
            </View>
            <MaterialIcons
              name="chevron-right"
              size={20}
              color={theme.icon}
              style={{ opacity: 0.4 }}
            />
          </PressableFeedback>

          {/* ── Sección: Apariencia ── */}
          <Text
            style={[
              styles.sectionLabel,
              { color: theme.icon, marginTop: spacing.md },
            ]}
          >
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
                const Notifications = await import('expo-notifications');
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

      <BottomSheet
        visible={profileSelectorOpen}
        onClose={() => setProfileSelectorOpen(false)}
      >
        <View style={[styles.container, { backgroundColor: theme.background }]}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.text }]}>Perfil</Text>
            <CloseButton onPress={() => setProfileSelectorOpen(false)} />
          </View>
          {(Object.keys(rawConfig.profiles) as ProfileType[]).map((key) => {
            const p = rawConfig.profiles[key];
            const selected = profile.profileType === key;
            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.optionRow,
                  { backgroundColor: surfaceBg },
                  selected && {
                    borderColor: accentColor,
                    backgroundColor: hexAlpha(accentColor, '15'),
                  },
                ]}
                onPress={() => handleSelectProfile(key)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionLabel, { color: theme.text }]}>
                    {p.label}
                  </Text>
                  <Text
                    style={[styles.optionDesc, { color: theme.icon }]}
                    numberOfLines={2}
                  >
                    {p.description}
                  </Text>
                </View>
                {selected && (
                  <MaterialIcons
                    name="check-circle"
                    size={20}
                    color={accentColor}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </BottomSheet>

      <BottomSheet
        visible={delegationSelectorOpen}
        onClose={() => setDelegationSelectorOpen(false)}
      >
        <View
          style={[
            styles.container,
            styles.delegationContainer,
            { backgroundColor: theme.background },
          ]}
        >
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.text }]}>
              Delegación
            </Text>
            <CloseButton onPress={() => setDelegationSelectorOpen(false)} />
          </View>
          <FlatList
            data={rawConfig.delegationList}
            keyExtractor={(d) => d.id}
            renderItem={({ item }) => {
              const selected = profile.delegationId === item.id;
              return (
                <TouchableOpacity
                  style={[
                    styles.optionRowCompact,
                    { backgroundColor: surfaceBg },
                    selected && {
                      borderColor: accentColor,
                      backgroundColor: hexAlpha(accentColor, '15'),
                    },
                  ]}
                  onPress={() => handleSelectDelegation(item.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <Text
                    style={[styles.optionLabel, { color: theme.text, flex: 1 }]}
                  >
                    {item.label}
                  </Text>
                  {selected && (
                    <MaterialIcons
                      name="check-circle"
                      size={20}
                      color={accentColor}
                    />
                  )}
                </TouchableOpacity>
              );
            }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          />
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
  } as ViewStyle,
  delegationContainer: {
    maxHeight: '90%',
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
  surfaceHint: {
    fontSize: 12,
    marginTop: 2,
    opacity: 0.75,
  } as TextStyle,

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

  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    marginBottom: spacing.sm,
  } as ViewStyle,
  optionRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
  } as ViewStyle,
  optionLabel: {
    fontSize: 15,
    fontWeight: '700',
  } as TextStyle,
  optionDesc: {
    fontSize: 12,
    marginTop: 2,
    opacity: 0.8,
    lineHeight: 16,
  } as TextStyle,
});
