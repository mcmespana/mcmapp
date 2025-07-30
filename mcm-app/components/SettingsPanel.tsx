import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Modal from 'react-native-modal';
import { MaterialIcons } from '@expo/vector-icons';
import useFontScale from '@/hooks/useFontScale';
import { useAppSettings, ThemeScheme } from '@/contexts/AppSettingsContext';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import UserProfileModal from './UserProfileModal';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ visible, onClose }: Props) {
  const { settings, setSettings } = useAppSettings();
  const scheme = useColorScheme();
  const theme = Colors[scheme];
  const fontScale = useFontScale();
  const [editVisible, setEditVisible] = useState(false);

  const increase = () => {
    setSettings({ fontScale: Math.min(settings.fontScale + 0.1, 2) });
  };

  const decrease = () => {
    setSettings({ fontScale: Math.max(1, settings.fontScale - 0.1) });
  };

  const setTheme = (theme: ThemeScheme) => {
    setSettings({ theme });
  };

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      style={styles.modal}
      swipeDirection="down"
      onSwipeComplete={onClose}
      backdropOpacity={0.3}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.row}>
          <TouchableOpacity
            onPress={decrease}
            disabled={settings.fontScale <= 1}
          >
            <MaterialIcons
              name="text-fields"
              size={24}
              color={theme.text}
              style={{ transform: [{ scaleY: 0.8 }] }}
            />
          </TouchableOpacity>
          <Text
            style={[
              styles.value,
              { color: theme.text, fontSize: 16 * fontScale },
            ]}
          >
            {(settings.fontScale * 100).toFixed(0)}%
          </Text>
          <TouchableOpacity onPress={increase}>
            <MaterialIcons name="text-fields" size={32} color={theme.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.themeToggleRow}>
          <TouchableOpacity
            onPress={() => setTheme('light')}
            style={[
              styles.themeButton,
              settings.theme === 'light' && styles.themeSelected,
            ]}
          >
            <MaterialIcons name="light-mode" size={28} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTheme('dark')}
            style={[
              styles.themeButton,
              settings.theme === 'dark' && styles.themeSelected,
            ]}
          >
            <MaterialIcons name="dark-mode" size={28} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTheme('system')}
            style={[
              styles.themeButton,
              settings.theme === 'system' && styles.themeSelected,
            ]}
          >
            <MaterialIcons
              name="brightness-auto"
              size={28}
              color={theme.text}
            />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.nameButton}
          onPress={() => setEditVisible(true)}
        >
          <MaterialIcons name="person" size={24} color={theme.text} />
          <Text style={[styles.nameButtonText, { color: theme.text }]}>
            Cambia tu nombre
          </Text>
        </TouchableOpacity>
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
    padding: 20,
    paddingBottom: 40,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  value: {
    fontWeight: 'bold',
  },
  themeToggleRow: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  themeButton: {
    opacity: 0.6,
  },
  themeSelected: {
    opacity: 1,
  },
  nameButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
  },
  nameButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
  },
});
