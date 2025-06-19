import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Modal from 'react-native-modal';
import { MaterialIcons } from '@expo/vector-icons';
import useFontScale from '@/hooks/useFontScale';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ visible, onClose }: Props) {
  const { settings, setSettings } = useAppSettings();
  const scheme = useColorScheme();
  const theme = Colors[scheme];
  const fontScale = useFontScale();

  const increase = () => {
    setSettings({ fontScale: Math.min(settings.fontScale + 0.1, 2) });
  };

  const decrease = () => {
    setSettings({ fontScale: Math.max(1, settings.fontScale - 0.1) });
  };

  const toggleTheme = () => {
    const nextTheme =
      settings.theme === 'light'
        ? 'dark'
        : settings.theme === 'dark'
        ? 'system'
        : 'light';
    setSettings({ theme: nextTheme });
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
          <TouchableOpacity onPress={decrease} disabled={settings.fontScale <= 1}>
            <MaterialIcons name="text-fields" size={24} color={theme.text} style={{ transform: [{ scaleY: 0.8 }] }} />
          </TouchableOpacity>
          <Text style={[styles.value, { color: theme.text, fontSize: 16 * fontScale }]}>{(settings.fontScale * 100).toFixed(0)}%</Text>
          <TouchableOpacity onPress={increase}>
            <MaterialIcons name="text-fields" size={32} color={theme.text} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.themeToggle} onPress={toggleTheme}>
          <MaterialIcons
            name={
              settings.theme === 'light'
                ? 'dark-mode'
                : settings.theme === 'dark'
                ? 'brightness-auto'
                : 'light-mode'
            }
            size={28}
            color={theme.text}
          />
        </TouchableOpacity>
      </View>
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
  themeToggle: {
    marginTop: 20,
    alignSelf: 'center',
  },
});
