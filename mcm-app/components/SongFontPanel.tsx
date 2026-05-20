import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
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

const MIN_SIZE = 0.6;
const MAX_SIZE = 2.0;

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
  const theme = Colors[scheme ?? 'light'];

  const defaultFamily = availableFonts[0]?.cssValue ?? currentFontFamily;
  const isSizeModified =
    Math.abs(currentFontSize - DEFAULT_FONT_SIZE_EM) > 0.001;
  const isFontModified = currentFontFamily !== defaultFamily;

  const resetAll = () => {
    onSetFontSize(DEFAULT_FONT_SIZE_EM);
    onSetFontFamily(defaultFamily);
  };
  const resetSize = () => onSetFontSize(DEFAULT_FONT_SIZE_EM);
  const resetFont = () => onSetFontFamily(defaultFamily);

  const increase = () =>
    onSetFontSize(Math.min(MAX_SIZE, currentFontSize + 0.1));
  const decrease = () =>
    onSetFontSize(Math.max(MIN_SIZE, currentFontSize - 0.1));
  const percentage = ((currentFontSize / DEFAULT_FONT_SIZE_EM) * 100).toFixed(
    0,
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Tipo de letra">
      <View
        style={[
          styles.container,
          {
            paddingBottom: Platform.OS === 'web' ? 16 : 0,
          },
        ]}
      >
        {/* ━━━━━━━━━━━━━━ TAMAÑO ━━━━━━━━━━━━━━ */}
        <View style={[styles.card, isDark && styles.cardDark]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>TAMAÑO</Text>
            <View style={styles.cardValueWrap}>
              <Text
                style={[
                  styles.cardValue,
                  {
                    color: isSizeModified
                      ? isDark
                        ? '#FFB74D'
                        : '#C77700'
                      : isDark
                        ? '#8E8E93'
                        : '#8E8E93',
                  },
                ]}
              >
                {isSizeModified ? 'Modificado' : 'Original'}
              </Text>
            </View>
            <PressableFeedback
              style={[
                styles.resetIconBtn,
                !isSizeModified && styles.resetIconBtnHidden,
              ]}
              onPress={resetSize}
              isDisabled={!isSizeModified}
              accessibilityLabel="Restablecer tamaño"
            >
              <PressableFeedback.Highlight />
              <MaterialIcons
                name="refresh"
                size={18}
                color={isDark ? '#AEAEB2' : '#636366'}
              />
            </PressableFeedback>
          </View>

          <View style={styles.sizeRow}>
            <PressableFeedback
              style={[
                styles.sizeStepBtn,
                isDark ? styles.sizeStepBtnDark : null,
                currentFontSize <= MIN_SIZE + 0.001 && styles.sizeStepDisabled,
              ]}
              onPress={decrease}
              isDisabled={currentFontSize <= MIN_SIZE + 0.001}
            >
              <PressableFeedback.Highlight />
              <MaterialIcons
                name="remove"
                size={24}
                color={
                  currentFontSize <= MIN_SIZE + 0.001
                    ? isDark
                      ? '#48484A'
                      : '#C7C7CC'
                    : isDark
                      ? '#EBEBF0'
                      : '#1C1C1E'
                }
              />
            </PressableFeedback>

            <View
              style={[
                styles.sizeDisplay,
                isSizeModified
                  ? isDark
                    ? styles.sizeDisplayActiveDark
                    : styles.sizeDisplayActive
                  : isDark
                    ? styles.sizeDisplayDark
                    : null,
              ]}
            >
              <Text
                style={[
                  styles.sizePercent,
                  {
                    color: isSizeModified
                      ? isDark
                        ? '#F4C11E'
                        : '#7A5A00'
                      : isDark
                        ? '#EBEBF0'
                        : '#1C1C1E',
                  },
                ]}
              >
                {percentage}%
              </Text>
              <View
                style={[
                  styles.previewWrap,
                  {
                    transform: [
                      {
                        scale: Math.min(
                          1.4,
                          Math.max(0.6, currentFontSize / DEFAULT_FONT_SIZE_EM),
                        ),
                      },
                    ],
                  },
                ]}
              >
                <Text
                  style={[
                    styles.previewText,
                    {
                      color: isDark ? '#AEAEB2' : '#636366',
                      ...(getNativeFontFamily(currentFontFamily) && {
                        fontFamily: getNativeFontFamily(currentFontFamily),
                      }),
                    },
                  ]}
                >
                  Aa
                </Text>
              </View>
            </View>

            <PressableFeedback
              style={[
                styles.sizeStepBtn,
                isDark ? styles.sizeStepBtnDark : null,
                currentFontSize >= MAX_SIZE - 0.001 && styles.sizeStepDisabled,
              ]}
              onPress={increase}
              isDisabled={currentFontSize >= MAX_SIZE - 0.001}
            >
              <PressableFeedback.Highlight />
              <MaterialIcons
                name="add"
                size={24}
                color={
                  currentFontSize >= MAX_SIZE - 0.001
                    ? isDark
                      ? '#48484A'
                      : '#C7C7CC'
                    : isDark
                      ? '#EBEBF0'
                      : '#1C1C1E'
                }
              />
            </PressableFeedback>
          </View>
        </View>

        {/* ━━━━━━━━━━━━━━ TIPOGRAFÍA ━━━━━━━━━━━━━━ */}
        <View style={[styles.card, isDark && styles.cardDark]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>FUENTE</Text>
            <View style={styles.cardValueWrap}>
              <Text
                style={[
                  styles.cardValue,
                  {
                    color: isFontModified
                      ? isDark
                        ? '#FFB74D'
                        : '#C77700'
                      : isDark
                        ? '#8E8E93'
                        : '#8E8E93',
                  },
                ]}
              >
                {availableFonts.find((f) => f.cssValue === currentFontFamily)
                  ?.name ?? 'Personalizada'}
              </Text>
            </View>
            <PressableFeedback
              style={[
                styles.resetIconBtn,
                !isFontModified && styles.resetIconBtnHidden,
              ]}
              onPress={resetFont}
              isDisabled={!isFontModified}
              accessibilityLabel="Restablecer fuente"
            >
              <PressableFeedback.Highlight />
              <MaterialIcons
                name="refresh"
                size={18}
                color={isDark ? '#AEAEB2' : '#636366'}
              />
            </PressableFeedback>
          </View>

          <View style={styles.fontGrid}>
            {availableFonts.map((font) => {
              const isActive = font.cssValue === currentFontFamily;
              const nativeFamily = getNativeFontFamily(font.cssValue);
              return (
                <PressableFeedback
                  key={font.cssValue}
                  style={[
                    styles.fontChip,
                    isDark ? styles.fontChipDark : null,
                    isActive &&
                      (isDark
                        ? styles.fontChipActiveDark
                        : styles.fontChipActive),
                  ]}
                  onPress={() => onSetFontFamily(font.cssValue)}
                >
                  <PressableFeedback.Highlight />
                  <Text
                    style={[
                      styles.fontChipPreview,
                      {
                        ...(nativeFamily && { fontFamily: nativeFamily }),
                        color: isActive
                          ? isDark
                            ? '#F4C11E'
                            : '#7A5A00'
                          : isDark
                            ? '#EBEBF0'
                            : '#1C1C1E',
                      },
                    ]}
                  >
                    Aa
                  </Text>
                  <Text
                    style={[
                      styles.fontChipLabel,
                      {
                        color: isActive
                          ? isDark
                            ? '#F4C11E'
                            : '#7A5A00'
                          : isDark
                            ? '#AEAEB2'
                            : '#636366',
                        fontWeight: isActive ? '700' : '500',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {font.name}
                  </Text>
                </PressableFeedback>
              );
            })}
          </View>
        </View>

        {(isSizeModified || isFontModified) && (
          <PressableFeedback
            style={[styles.resetAllBtn, isDark && styles.resetAllBtnDark]}
            onPress={resetAll}
          >
            <PressableFeedback.Highlight />
            <MaterialIcons
              name="refresh"
              size={16}
              color={isDark ? '#AEAEB2' : '#636366'}
            />
            <Text
              style={[
                styles.resetAllText,
                { color: isDark ? '#AEAEB2' : '#636366' },
              ]}
            >
              Restablecer todo
            </Text>
          </PressableFeedback>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 4,
    gap: 12,
  },
  card: {
    backgroundColor: '#F7F7FB',
    borderRadius: radii.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  cardDark: {
    backgroundColor: Colors.dark.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 28,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#8E8E93',
  },
  cardValueWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  cardValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  resetIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetIconBtnHidden: {
    opacity: 0,
  },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sizeStepBtn: {
    width: 56,
    height: 64,
    borderRadius: radii.md,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  sizeStepBtnDark: {
    backgroundColor: '#1C1C1E',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sizeStepDisabled: {
    opacity: 0.4,
  },
  sizeDisplay: {
    flex: 1,
    height: 64,
    borderRadius: radii.md,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  sizeDisplayDark: {
    backgroundColor: '#1C1C1E',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sizeDisplayActive: {
    backgroundColor: '#FFF4DA',
    borderColor: '#F4C11E',
  },
  sizeDisplayActiveDark: {
    backgroundColor: '#3A2D0A',
    borderColor: '#7A5A00',
  },
  sizePercent: {
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  previewWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewText: {
    fontSize: 18,
    fontWeight: '600',
  },
  fontGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  fontChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radii.md,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    minHeight: 64,
  },
  fontChipDark: {
    backgroundColor: '#1C1C1E',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  fontChipActive: {
    backgroundColor: '#FFF4DA',
    borderColor: '#F4C11E',
  },
  fontChipActiveDark: {
    backgroundColor: '#3A2D0A',
    borderColor: '#7A5A00',
  },
  fontChipPreview: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  fontChipLabel: {
    fontSize: 11,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  resetAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: '#F2F2F7',
    gap: 6,
    marginTop: 2,
  },
  resetAllBtnDark: {
    backgroundColor: Colors.dark.card,
  },
  resetAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
