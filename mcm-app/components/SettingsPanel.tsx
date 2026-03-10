import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Modal from 'react-native-modal';
import { MaterialIcons } from '@expo/vector-icons';
import useFontScale from '@/hooks/useFontScale';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import UserProfileModal from './UserProfileModal';
import spacing from '@/constants/spacing';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ visible, onClose }: Props) {
  const { settings, setSettings } = useAppSettings();
  const scheme = useColorScheme();
  const theme = Colors[scheme];
  const fontScale = useFontScale();
  const featureFlags = useFeatureFlags();
  const [editVisible, setEditVisible] = useState(false);

  const isDark = scheme === 'dark';
  const cardBg = isDark ? '#ffffff0D' : '#f5f7f8';
  const iconCircleBg = isDark ? '#ffffff15' : '#ffffff';

  const toggleDarkMode = () => {
    setSettings({ theme: isDark ? 'light' : 'dark' });
  };

  const increase = () => {
    setSettings({ fontScale: Math.min(settings.fontScale + 0.1, 2) });
  };

  const decrease = () => {
    setSettings({ fontScale: Math.max(1, settings.fontScale - 0.1) });
  };

  const fontProgress = Math.min(
    100,
    Math.max(0, ((settings.fontScale - 1) / 1) * 100),
  );

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      style={styles.modal}
      swipeDirection="down"
      onSwipeComplete={onClose}
      backdropOpacity={0.4}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Handle */}
        <View style={styles.handleRow}>
          <View
            style={[styles.handle, { backgroundColor: theme.icon + '30' }]}
          />
        </View>

        {/* Title row */}
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.text }]}>
            Ajustes Rápidos
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeButton, { backgroundColor: cardBg }]}
          >
            <MaterialIcons name="close" size={20} color={theme.icon} />
          </TouchableOpacity>
        </View>

        {/* Dark Mode Toggle */}
        <View style={[styles.settingCard, { backgroundColor: cardBg }]}>
          <View style={styles.settingCardLeft}>
            <View
              style={[styles.iconCircle, { backgroundColor: iconCircleBg }]}
            >
              <MaterialIcons name="dark-mode" size={22} color={theme.icon} />
            </View>
            <View>
              <Text style={[styles.settingTitle, { color: theme.text }]}>
                Modo Oscuro
              </Text>
              <Text style={[styles.settingSubtitle, { color: theme.icon }]}>
                Alternar tema visual
              </Text>
            </View>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleDarkMode}
            trackColor={{ false: theme.icon + '30', true: colors.primary }}
            thumbColor="#ffffff"
          />
        </View>

        {/* Font Size */}
        <View style={[styles.settingCard, { backgroundColor: cardBg }]}>
          <View style={styles.fontHeader}>
            <View
              style={[styles.iconCircle, { backgroundColor: iconCircleBg }]}
            >
              <MaterialIcons
                name="text-fields"
                size={22}
                color={theme.icon}
              />
            </View>
            <Text style={[styles.settingTitle, { color: theme.text }]}>
              Tamaño de Fuente
            </Text>
          </View>
          <View style={styles.fontControls}>
            <TouchableOpacity
              onPress={decrease}
              disabled={settings.fontScale <= 1}
              style={{ opacity: settings.fontScale <= 1 ? 0.3 : 1 }}
            >
              <Text
                style={[styles.fontLabel, { fontSize: 14, color: theme.icon }]}
              >
                A
              </Text>
            </TouchableOpacity>
            <View
              style={[styles.fontTrack, { backgroundColor: theme.icon + '18' }]}
            >
              <View
                style={[
                  styles.fontFill,
                  {
                    backgroundColor: colors.primary + '50',
                    width: `${fontProgress}%`,
                  },
                ]}
              />
            </View>
            <TouchableOpacity
              onPress={increase}
              disabled={settings.fontScale >= 2}
              style={{ opacity: settings.fontScale >= 2 ? 0.3 : 1 }}
            >
              <Text
                style={[styles.fontLabel, { fontSize: 24, color: theme.text }]}
              >
                A
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Change Name */}
        {featureFlags.showChangeNameButton && (
          <TouchableOpacity
            style={[styles.settingCard, { backgroundColor: cardBg }]}
            onPress={() => setEditVisible(true)}
          >
            <View style={styles.settingCardLeft}>
              <View
                style={[styles.iconCircle, { backgroundColor: iconCircleBg }]}
              >
                <MaterialIcons name="person" size={22} color={theme.icon} />
              </View>
              <Text style={[styles.settingTitle, { color: theme.text }]}>
                ¿Cambiamos tu nombre?
              </Text>
            </View>
            <MaterialIcons
              name="chevron-right"
              size={22}
              color={theme.icon}
              style={{ opacity: 0.4 }}
            />
          </TouchableOpacity>
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
  modal: { justifyContent: 'flex-end', margin: 0 },
  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  handleRow: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.xs,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingCard: {
    borderRadius: 16,
    padding: spacing.md + 2,
    marginBottom: spacing.md,
  },
  settingCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm + 4,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  settingSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  fontHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    marginBottom: spacing.md,
  },
  fontControls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    gap: spacing.md,
  },
  fontLabel: {
    fontWeight: '600',
  },
  fontTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fontFill: {
    height: '100%',
    borderRadius: 3,
  },
});
