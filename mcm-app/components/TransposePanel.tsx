import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import BottomSheet from './BottomSheet';
import { Colors } from '@/constants/colors';
import { radii } from '@/constants/uiStyles';
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
  const isDark = scheme === 'dark';
  const theme = Colors[scheme];

  const TransposeButton = ({
    label,
    value,
    variant,
  }: {
    label: string;
    value: number;
    variant: 'up' | 'down';
  }) => (
    <TouchableOpacity
      style={[
        styles.transposeButton,
        isDark && styles.transposeButtonDark,
        variant === 'up' &&
          (isDark ? styles.transposeUpDark : styles.transposeUp),
        variant === 'down' &&
          (isDark ? styles.transposeDownDark : styles.transposeDown),
      ]}
      onPress={() => onSetTranspose(value)}
      activeOpacity={0.7}
    >
      <MaterialIcons
        name={variant === 'up' ? 'arrow-upward' : 'arrow-downward'}
        size={18}
        color={
          variant === 'up'
            ? isDark
              ? '#81C784'
              : '#2E7D32'
            : isDark
              ? '#E57373'
              : '#C62828'
        }
      />
      <Text
        style={[
          styles.transposeButtonText,
          {
            color:
              variant === 'up'
                ? isDark
                  ? '#81C784'
                  : '#2E7D32'
                : isDark
                  ? '#E57373'
                  : '#C62828',
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.handleArea}>
        <View style={styles.handle} />
      </View>
      <Text style={[styles.title, { color: theme.text }]}>Cambiar tono</Text>

      <View style={styles.currentDisplay}>
        <Text style={styles.currentLabel}>Transposición actual</Text>
        <Text
          style={[
            styles.currentValue,
            {
              color:
                currentTranspose === 0
                  ? isDark
                    ? '#8E8E93'
                    : '#636366'
                  : currentTranspose > 0
                    ? isDark
                      ? '#81C784'
                      : '#2E7D32'
                    : isDark
                      ? '#E57373'
                      : '#C62828',
            },
          ]}
        >
          {currentTranspose === 0
            ? 'Original'
            : `${currentTranspose > 0 ? '+' : ''}${currentTranspose} semitonos`}
        </Text>
      </View>

      <View style={styles.buttonsGrid}>
        <View style={styles.buttonsRow}>
          <TransposeButton
            label="+1"
            value={currentTranspose + 1}
            variant="up"
          />
          <TransposeButton
            label="+2"
            value={currentTranspose + 2}
            variant="up"
          />
        </View>
        <View style={styles.buttonsRow}>
          <TransposeButton
            label="-1"
            value={currentTranspose - 1}
            variant="down"
          />
          <TransposeButton
            label="-2"
            value={currentTranspose - 2}
            variant="down"
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.resetButton, isDark && styles.resetButtonDark]}
        onPress={() => onSetTranspose(0)}
        activeOpacity={0.7}
      >
        <MaterialIcons
          name="refresh"
          size={18}
          color={isDark ? '#AEAEB2' : '#636366'}
        />
        <Text
          style={[styles.resetText, { color: isDark ? '#AEAEB2' : '#636366' }]}
        >
          Tono original
        </Text>
      </TouchableOpacity>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  handleArea: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(128,128,128,0.3)',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  currentDisplay: {
    alignItems: 'center',
    marginBottom: 20,
  },
  currentLabel: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 4,
  },
  currentValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  buttonsGrid: {
    gap: 10,
    marginBottom: 16,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  transposeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radii.md,
    gap: 8,
  },
  transposeButtonDark: {},
  transposeUp: {
    backgroundColor: '#E8F5E9',
  },
  transposeUpDark: {
    backgroundColor: '#1B3A1B',
  },
  transposeDown: {
    backgroundColor: '#FFEBEE',
  },
  transposeDownDark: {
    backgroundColor: '#3A1B1B',
  },
  transposeButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radii.md,
    backgroundColor: '#F2F2F7',
    gap: 8,
  },
  resetButtonDark: {
    backgroundColor: Colors.dark.card,
  },
  resetText: {
    fontWeight: '600',
    fontSize: 15,
  },
});
