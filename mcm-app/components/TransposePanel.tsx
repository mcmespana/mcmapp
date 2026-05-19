import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet from './BottomSheet';
import { Colors } from '@/constants/colors';
import { radii } from '@/constants/uiStyles';
import { useColorScheme } from '@/hooks/useColorScheme';

interface Props {
  visible: boolean;
  onClose: () => void;
  currentTranspose: number;
  onSetTranspose: (value: number) => void;
  /** Cejilla original de la canción (del cantoral). */
  originalCapo?: number;
  /** Override de cejilla para esta sesión/playlist. null = sin override. */
  currentCapoOverride?: number | null;
  onSetCapoOverride?: (capo: number | null) => void;
}

const TONE_STEPS: { value: number; label: string }[] = [
  { value: -2, label: '−2' },
  { value: -1, label: '−1' },
  { value: 1, label: '+1' },
  { value: 2, label: '+2' },
];

export default function TransposePanel({
  visible,
  onClose,
  currentTranspose,
  onSetTranspose,
  originalCapo,
  currentCapoOverride,
  onSetCapoOverride,
}: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = Colors[scheme];
  const insets = useSafeAreaInsets();

  const showCapoSection = onSetCapoOverride !== undefined;
  const isCapoOverridden =
    currentCapoOverride !== null && currentCapoOverride !== undefined;
  const effectiveCapo = isCapoOverridden
    ? (currentCapoOverride as number)
    : (originalCapo ?? 0);
  const isTransposed = currentTranspose !== 0;

  const handleCapoMinus = () => {
    if (!onSetCapoOverride) return;
    const next = effectiveCapo - 1;
    if (next < 0) return;
    onSetCapoOverride(next === (originalCapo ?? 0) ? null : next);
  };
  const handleCapoPlus = () => {
    if (!onSetCapoOverride) return;
    const next = effectiveCapo + 1;
    onSetCapoOverride(next === (originalCapo ?? 0) ? null : next);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View
        style={[
          styles.container,
          {
            paddingBottom:
              Math.max(insets.bottom, 12) + (Platform.OS === 'web' ? 8 : 4),
          },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Ajustes de canción
          </Text>
        </View>

        {/* ━━━━━━━━━━━━━━ TONO ━━━━━━━━━━━━━━ */}
        <View style={[styles.card, isDark && styles.cardDark]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>TONO</Text>
            <View style={styles.cardValueWrap}>
              <Text
                style={[
                  styles.cardValue,
                  {
                    color: isTransposed
                      ? isDark
                        ? '#FFB74D'
                        : '#C77700'
                      : isDark
                        ? '#8E8E93'
                        : '#8E8E93',
                  },
                ]}
              >
                {isTransposed
                  ? `${currentTranspose > 0 ? '+' : ''}${currentTranspose} semitonos`
                  : 'Original'}
              </Text>
            </View>
            <PressableFeedback
              style={[
                styles.resetIconBtn,
                !isTransposed && styles.resetIconBtnHidden,
              ]}
              onPress={() => onSetTranspose(0)}
              disabled={!isTransposed}
              accessibilityLabel="Restablecer tono"
            >
              <PressableFeedback.Highlight />
              <MaterialIcons
                name="refresh"
                size={18}
                color={isDark ? '#AEAEB2' : '#636366'}
              />
            </PressableFeedback>
          </View>

          <View style={styles.toneRow}>
            {TONE_STEPS.map((step) => {
              const isUp = step.value > 0;
              return (
                <PressableFeedback
                  key={step.value}
                  style={[
                    styles.toneBtn,
                    isUp
                      ? isDark
                        ? styles.toneBtnUpDark
                        : styles.toneBtnUp
                      : isDark
                        ? styles.toneBtnDownDark
                        : styles.toneBtnDown,
                  ]}
                  onPress={() => onSetTranspose(currentTranspose + step.value)}
                >
                  <PressableFeedback.Highlight />
                  <Text
                    style={[
                      styles.toneBtnText,
                      {
                        color: isUp
                          ? isDark
                            ? '#81C784'
                            : '#2E7D32'
                          : isDark
                            ? '#E57373'
                            : '#C62828',
                      },
                    ]}
                  >
                    {step.label}
                  </Text>
                </PressableFeedback>
              );
            })}
          </View>
        </View>

        {/* ━━━━━━━━━━━━━━ CEJILLA ━━━━━━━━━━━━━━ */}
        {showCapoSection && (
          <View style={[styles.card, isDark && styles.cardDark]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>CEJILLA</Text>
              <View style={styles.cardValueWrap}>
                <Text
                  style={[
                    styles.cardValue,
                    {
                      color: isCapoOverridden
                        ? isDark
                          ? '#FFB74D'
                          : '#C77700'
                        : isDark
                          ? '#8E8E93'
                          : '#8E8E93',
                    },
                  ]}
                >
                  {isCapoOverridden
                    ? originalCapo && originalCapo > 0
                      ? `Original: ${originalCapo}`
                      : 'Original: sin cejilla'
                    : originalCapo && originalCapo > 0
                      ? `Original: ${originalCapo}`
                      : 'Sin cejilla'}
                </Text>
              </View>
              <PressableFeedback
                style={[
                  styles.resetIconBtn,
                  !isCapoOverridden && styles.resetIconBtnHidden,
                ]}
                onPress={() => onSetCapoOverride!(null)}
                disabled={!isCapoOverridden}
                accessibilityLabel="Restablecer cejilla"
              >
                <PressableFeedback.Highlight />
                <MaterialIcons
                  name="refresh"
                  size={18}
                  color={isDark ? '#AEAEB2' : '#636366'}
                />
              </PressableFeedback>
            </View>

            <View style={styles.capoRow}>
              <PressableFeedback
                style={[
                  styles.capoStepBtn,
                  isDark ? styles.toneBtnDownDark : styles.toneBtnDown,
                  effectiveCapo <= 0 && styles.capoStepBtnDisabled,
                ]}
                onPress={handleCapoMinus}
                disabled={effectiveCapo <= 0}
              >
                <PressableFeedback.Highlight />
                <MaterialIcons
                  name="remove"
                  size={26}
                  color={
                    effectiveCapo <= 0
                      ? isDark
                        ? '#48484A'
                        : '#C7C7CC'
                      : isDark
                        ? '#E57373'
                        : '#C62828'
                  }
                />
              </PressableFeedback>

              <View
                style={[
                  styles.capoDisplay,
                  isCapoOverridden
                    ? isDark
                      ? styles.capoDisplayOverriddenDark
                      : styles.capoDisplayOverridden
                    : isDark
                      ? styles.capoDisplayDark
                      : null,
                ]}
              >
                <Text
                  style={[
                    styles.capoDisplayValue,
                    {
                      color: isCapoOverridden
                        ? isDark
                          ? '#F4C11E'
                          : '#7A5A00'
                        : isDark
                          ? '#EBEBF0'
                          : '#1C1C1E',
                    },
                  ]}
                >
                  {effectiveCapo === 0
                    ? 'Sin cejilla'
                    : `Cejilla ${effectiveCapo}`}
                </Text>
                <Text
                  style={[
                    styles.capoDisplayBadge,
                    !isCapoOverridden && styles.capoDisplayBadgeHidden,
                  ]}
                >
                  modificada
                </Text>
              </View>

              <PressableFeedback
                style={[
                  styles.capoStepBtn,
                  isDark ? styles.toneBtnUpDark : styles.toneBtnUp,
                ]}
                onPress={handleCapoPlus}
              >
                <PressableFeedback.Highlight />
                <MaterialIcons
                  name="add"
                  size={26}
                  color={isDark ? '#81C784' : '#2E7D32'}
                />
              </PressableFeedback>
            </View>
          </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
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
    backgroundColor: 'transparent',
  },
  resetIconBtnHidden: {
    opacity: 0,
  },
  toneRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toneBtn: {
    flex: 1,
    height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toneBtnUp: {
    backgroundColor: '#E8F5E9',
  },
  toneBtnUpDark: {
    backgroundColor: '#1B3A1B',
  },
  toneBtnDown: {
    backgroundColor: '#FFEBEE',
  },
  toneBtnDownDark: {
    backgroundColor: '#3A1B1B',
  },
  toneBtnText: {
    fontSize: 17,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  capoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  capoStepBtn: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capoStepBtnDisabled: {
    opacity: 0.35,
  },
  capoDisplay: {
    flex: 1,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  capoDisplayDark: {
    backgroundColor: '#1C1C1E',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  capoDisplayOverridden: {
    backgroundColor: '#FFF4DA',
    borderColor: '#F4C11E',
  },
  capoDisplayOverriddenDark: {
    backgroundColor: '#3A2D0A',
    borderColor: '#7A5A00',
  },
  capoDisplayValue: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  capoDisplayBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9D5C00',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  capoDisplayBadgeHidden: {
    opacity: 0,
  },
});
