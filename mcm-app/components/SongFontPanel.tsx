import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import BottomSheet from './BottomSheet';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface FontOption {
  name: string;
  cssValue: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  availableFonts: FontOption[];
  currentFontSize: number;
  currentFontFamily: string;
  onSetFontSize: (size: number) => void;
  onSetFontFamily: (family: string) => void;
}

export default function SongFontPanel({
  visible,
  onClose,
  availableFonts,
  currentFontSize,
  currentFontFamily,
  onSetFontSize,
  onSetFontFamily,
}: Props) {
  const scheme = useColorScheme();
  const theme = Colors[scheme];

  const increase = () => onSetFontSize(currentFontSize + 0.1);
  const decrease = () => onSetFontSize(Math.max(0.6, currentFontSize - 0.1));

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.row}>
        <TouchableOpacity onPress={decrease}>
          <MaterialIcons name="text-fields" size={24} color={theme.text} style={{ transform: [{ scaleY: 0.8 }] }} />
        </TouchableOpacity>
        <Text style={[styles.value, { color: theme.text }]}>{(currentFontSize * 100).toFixed(0)}%</Text>
        <TouchableOpacity onPress={increase}>
          <MaterialIcons name="text-fields" size={32} color={theme.text} />
        </TouchableOpacity>
      </View>
      <View style={styles.fontList}>
        {availableFonts.map((font) => (
          <TouchableOpacity
            key={font.cssValue}
            style={[styles.fontButton, { backgroundColor: font.cssValue === currentFontFamily ? theme.tint : theme.background }]}
            onPress={() => onSetFontFamily(font.cssValue)}
          >
            <Text style={[styles.fontText, { fontFamily: font.cssValue, color: font.cssValue === currentFontFamily ? '#fff' : theme.text }]}>{font.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  value: { fontWeight: 'bold', fontSize: 16 },
  fontList: {},
  fontButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 10,
  },
  fontText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
