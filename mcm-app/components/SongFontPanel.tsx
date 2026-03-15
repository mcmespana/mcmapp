import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import BottomSheet from './BottomSheet';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { DEFAULT_FONT_SIZE_EM } from '@/contexts/SettingsContext';
import { getNativeFontFamily } from '@/utils/fontUtils';

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
  const isDark = scheme === 'dark';
  const theme = Colors[scheme];

  const reset = () => {
    onSetFontSize(DEFAULT_FONT_SIZE_EM);
    if (availableFonts[0]) {
      onSetFontFamily(availableFonts[0].cssValue);
    }
  };

  const increase = () => onSetFontSize(currentFontSize + 0.1);
  const decrease = () => onSetFontSize(Math.max(0.6, currentFontSize - 0.1));
  const percentage = ((currentFontSize / DEFAULT_FONT_SIZE_EM) * 100).toFixed(
    0,
  );

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.handleArea}>
        <View style={styles.handle} />
      </View>
      <Text style={[styles.title, { color: theme.text }]}>Tipo de letra</Text>

      <View style={styles.sizeSection}>
        <TouchableOpacity
          onPress={decrease}
          style={[styles.sizeButton, isDark && styles.sizeButtonDark]}
        >
          <MaterialIcons name="remove" size={22} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={reset} style={styles.sizeDisplay}>
          <Text style={[styles.sizeValue, { color: theme.text }]}>
            {percentage}%
          </Text>
          <Text style={styles.sizeLabel}>Tamaño</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={increase}
          style={[styles.sizeButton, isDark && styles.sizeButtonDark]}
        >
          <MaterialIcons name="add" size={22} color={theme.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.fontList}>
        {availableFonts.map((font) => {
          const isActive = font.cssValue === currentFontFamily;
          return (
            <TouchableOpacity
              key={font.cssValue}
              style={[
                styles.fontButton,
                isDark && styles.fontButtonDark,
                isActive &&
                  (isDark
                    ? styles.fontButtonActiveDark
                    : styles.fontButtonActive),
              ]}
              onPress={() => onSetFontFamily(font.cssValue)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.fontText,
                  {
                    ...(getNativeFontFamily(font.cssValue) && {
                      fontFamily: getNativeFontFamily(font.cssValue),
                    }),
                    color: isActive
                      ? isDark
                        ? '#7AB3FF'
                        : '#253883'
                      : isDark
                        ? '#EBEBF0'
                        : '#1C1C1E',
                    fontWeight: isActive ? '600' : '400',
                  },
                ]}
              >
                {font.name}
              </Text>
              {isActive && (
                <MaterialIcons
                  name="check"
                  size={20}
                  color={isDark ? '#7AB3FF' : '#253883'}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.resetButton, isDark && styles.resetButtonDark]}
        onPress={reset}
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
          Restablecer
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
  sizeSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    gap: 16,
  },
  sizeButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sizeButtonDark: {
    backgroundColor: '#3A3A3C',
  },
  sizeDisplay: {
    alignItems: 'center',
    minWidth: 80,
  },
  sizeValue: {
    fontSize: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  sizeLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  fontList: {
    gap: 8,
    marginBottom: 16,
  },
  fontButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
  },
  fontButtonDark: {
    backgroundColor: '#3A3A3C',
  },
  fontButtonActive: {
    backgroundColor: '#E8F0FE',
    borderWidth: 1.5,
    borderColor: '#BDD4F7',
  },
  fontButtonActiveDark: {
    backgroundColor: '#1A2744',
    borderWidth: 1.5,
    borderColor: '#2A3D66',
  },
  fontText: {
    fontSize: 16,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    gap: 8,
  },
  resetButtonDark: {
    backgroundColor: '#3A3A3C',
  },
  resetText: {
    fontWeight: '600',
    fontSize: 15,
  },
});
