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

export default function TransposePanel({
  visible,
  onClose,
  currentTranspose,
  onSetTranspose,
}: Props) {
  const scheme = useColorScheme();
  const theme = Colors[scheme];

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} accessibilityLabel="Cerrar">
          <MaterialIcons name="close" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>
      <Text style={[styles.title, { color: theme.text }]}>Cambiar semitonos</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#d1f2d1', borderColor: '#9bd49b' }]}
          onPress={() => onSetTranspose(currentTranspose + 1)}
        >
          <Text style={[styles.buttonText, { color: '#2d5a2d' }]}>+1</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#d1f2d1', borderColor: '#9bd49b' }]}
          onPress={() => onSetTranspose(currentTranspose + 2)}
        >
          <Text style={[styles.buttonText, { color: '#2d5a2d' }]}>+2</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#f8d7da', borderColor: '#f1b0b7' }]}
          onPress={() => onSetTranspose(currentTranspose - 1)}
        >
          <Text style={[styles.buttonText, { color: '#721c24' }]}>-1</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#f8d7da', borderColor: '#f1b0b7' }]}
          onPress={() => onSetTranspose(currentTranspose - 2)}
        >
          <Text style={[styles.buttonText, { color: '#721c24' }]}>-2</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[styles.reset, { 
          backgroundColor: '#e9ecef', 
          borderWidth: 1,
          borderColor: '#ced4da',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: 2
        }]}
        onPress={() => onSetTranspose(0)}
      >
        <Text style={[styles.resetText, { color: '#495057', fontWeight: '600' }]}>Tono Original</Text>
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
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 85,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  buttonText: { 
    fontSize: 16,
    fontWeight: '600',
  },
  reset: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetText: { fontWeight: 'bold' },
});
