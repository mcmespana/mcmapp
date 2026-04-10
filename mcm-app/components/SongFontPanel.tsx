import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { MaterialIcons } from '@expo/vector-icons';
import BottomSheet from './BottomSheet';
import { Colors } from '@/constants/colors';
import { radii } from '@/constants/uiStyles';
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
      <Text style={[styles.title, { color: theme.text }]}>Tipo de letra</Text>

      <View style={styles.sizeSection}>
        <PressableFeedback
          onPress={decrease}
          style={[styles.sizeButton, isDark && styles.sizeButtonDark]}
        >
          <PressableFeedback.Highlight />
          <MaterialIcons name="remove" size={22} color={theme.text} />
        </PressableFeedback>
        <PressableFeedback onPress={reset} style={styles.sizeDisplay}>
          <PressableFeedback.Highlight />
          <Text style={[styles.sizeValue, { color: theme.text }]}>
            {percentage}%
          </Text>
          <Text style={styles.sizeLabel}>Tamaño</Text>
        </PressableFeedback>
        <PressableFeedback
          onPress={increase}
          style={[styles.sizeButton, isDark && styles.sizeButtonDark]}
        >
          <PressableFeedback.Highlight />
          <MaterialIcons name="add" size={22} color={theme.text} />
        </PressableFeedback>
      </View>

      <View style={styles.fontList}>
        {availableFonts.map((font) => {
          const isActive = font.cssValue === currentFontFamily;
          return (
            <PressableFeedback
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
            >
              <PressableFeedback.Highlight />
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
            </PressableFeedback>
          );
        })}
      </View>

      <PressableFeedback
        style={[styles.resetButton, isDark && styles.resetButtonDark]}
        onPress={reset}
      >
        <PressableFeedback.Highlight />
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
      </PressableFeedback>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
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
    borderRadius: radii.md,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sizeButtonDark: {
    backgroundColor: Colors.dark.card,
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
    borderRadius: radii.md,
    backgroundColor: '#F2F2F7',
  },
  fontButtonDark: {
    backgroundColor: Colors.dark.card,
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
