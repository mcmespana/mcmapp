import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import BottomSheet from './BottomSheet';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface Props {
  visible: boolean;
  onClose: () => void;
  currentTranspose: number;
  onSetTranspose: (value: number) => void;
}

export default function TransposePanel({ visible, onClose, currentTranspose, onSetTranspose }: Props) {
  const scheme = useColorScheme();
  const theme = Colors[scheme];

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} accessibilityLabel="Cerrar">
          <MaterialIcons name="close" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>
      <Text style={[styles.title, { color: theme.text }]}>Cambio tono</Text>
      <View style={styles.row}>
        <TouchableOpacity style={styles.button} onPress={() => onSetTranspose(currentTranspose + 1)}>
          <Text style={styles.buttonText}>+1/2</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => onSetTranspose(currentTranspose + 2)}>
          <Text style={styles.buttonText}>+1</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.row}>
        <TouchableOpacity style={styles.button} onPress={() => onSetTranspose(currentTranspose - 1)}>
          <Text style={styles.buttonText}>-1/2</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => onSetTranspose(currentTranspose - 2)}>
          <Text style={styles.buttonText}>-1</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={[styles.reset, { backgroundColor: theme.tint }]} onPress={() => onSetTranspose(0)}>
        <Text style={[styles.resetText, { color: '#fff' }]}>Tono Original</Text>
      </TouchableOpacity>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#e9ecef',
  },
  buttonText: { fontSize: 16 },
  reset: { marginTop: 10, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  resetText: { fontWeight: 'bold' },
});
