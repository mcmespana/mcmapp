import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Modal from 'react-native-modal';
import { MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';
import { useSettings } from '@/contexts/SettingsContext';

interface FontOption {
  name: string;
  cssValue: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  availableFonts: FontOption[];
  onSetFontSize?: (sizeEm: number) => void;
  onSetFontFamily?: (fontFamily: string) => void;
}

export default function SongTypographyPanel({ visible, onClose, availableFonts, onSetFontSize, onSetFontFamily }: Props) {
  const { settings, setSettings } = useSettings();
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];

  const increase = () => {
    const newSize = settings.fontSize + 0.1;
    setSettings({ fontSize: newSize });
    onSetFontSize?.(newSize);
  };

  const decrease = () => {
    const newSize = Math.max(0.6, settings.fontSize - 0.1);
    setSettings({ fontSize: newSize });
    onSetFontSize?.(newSize);
  };

  const changeFamily = (fontFamily: string) => {
    setSettings({ fontFamily });
    onSetFontFamily?.(fontFamily);
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
          <TouchableOpacity onPress={decrease}>
            <MaterialIcons name="text-fields" size={24} color={theme.text} style={{ transform: [{ scaleY: 0.8 }] }} />
          </TouchableOpacity>
          <Text style={[styles.value, { color: theme.text }]}>{(settings.fontSize * 100).toFixed(0)}%</Text>
          <TouchableOpacity onPress={increase}>
            <MaterialIcons name="text-fields" size={32} color={theme.text} />
          </TouchableOpacity>
        </View>
        {availableFonts.map(font => (
          <TouchableOpacity key={font.cssValue} style={styles.fontOption} onPress={() => changeFamily(font.cssValue)}>
            <Text style={[styles.fontOptionText, { color: theme.text, fontFamily: font.cssValue }]}>{font.name}</Text>
          </TouchableOpacity>
        ))}
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
    marginBottom: 20,
  },
  value: { fontWeight: 'bold' },
  fontOption: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  fontOptionText: {
    fontSize: 16,
  },
});
