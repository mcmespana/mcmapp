import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PressableFeedback } from 'heroui-native';
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
  /** Cejilla original de la canción (del cantoral). */
  originalCapo?: number;
  /** Override de cejilla para esta sesión/playlist. null = sin override. */
  currentCapoOverride?: number | null;
  onSetCapoOverride?: (capo: number | null) => void;
}

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
  const theme = Colors[scheme ?? 'light'];

  const TransposeButton = ({
    label,
    value,
    variant,
  }: {
    label: string;
    value: number;
    variant: 'up' | 'down';
  }) => (
    <PressableFeedback
      style={[
        styles.transposeButton,
        isDark && styles.transposeButtonDark,
        variant === 'up' &&
          (isDark ? styles.transposeUpDark : styles.transposeUp),
        variant === 'down' &&
          (isDark ? styles.transposeDownDark : styles.transposeDown),
      ]}
      onPress={() => onSetTranspose(value)}
    >
      <PressableFeedback.Highlight />
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
    </PressableFeedback>
  );

  // Cejilla efectiva a mostrar: override si existe, original si no.
  const effectiveCapo =
    currentCapoOverride !== null && currentCapoOverride !== undefined
      ? currentCapoOverride
      : (originalCapo ?? 0);
  const isCapoOverridden =
    currentCapoOverride !== null && currentCapoOverride !== undefined;
  const showCapoSection = onSetCapoOverride !== undefined;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
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

      <PressableFeedback
        style={[styles.resetButton, isDark && styles.resetButtonDark]}
        onPress={() => onSetTranspose(0)}
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
          Tono original
        </Text>
      </PressableFeedback>

      {showCapoSection && (
        <>
          <View style={[styles.divider, isDark && styles.dividerDark]} />

          <Text style={[styles.capoSectionTitle, { color: theme.text }]}>
            Cejilla para esta sesión
          </Text>

          {originalCapo !== undefined && originalCapo > 0 && !isCapoOverridden && (
            <Text style={styles.capoOriginalHint}>
              Original: cejilla {originalCapo}
            </Text>
          )}
          {isCapoOverridden && originalCapo !== undefined && originalCapo > 0 && (
            <Text style={styles.capoOriginalHint}>
              Original: cejilla {originalCapo} · sesión: cejilla{' '}
              {currentCapoOverride}
            </Text>
          )}

          <View style={styles.capoStepper}>
            <PressableFeedback
              style={[
                styles.capoStepBtn,
                isDark && styles.capoStepBtnDark,
                effectiveCapo <= 0 && styles.capoStepBtnDisabled,
              ]}
              onPress={() => {
                if (effectiveCapo > 0)
                  onSetCapoOverride(effectiveCapo - 1 === 0 ? null : effectiveCapo - 1);
              }}
              disabled={effectiveCapo <= 0}
            >
              <PressableFeedback.Highlight />
              <MaterialIcons
                name="remove"
                size={22}
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

            <View style={styles.capoValueWrap}>
              <Text
                style={[
                  styles.capoValue,
                  {
                    color: isCapoOverridden
                      ? isDark
                        ? '#F4C11E'
                        : '#7A5A00'
                      : isDark
                        ? '#8E8E93'
                        : '#636366',
                  },
                ]}
              >
                {effectiveCapo === 0 ? 'Sin cejilla' : `Cejilla ${effectiveCapo}`}
              </Text>
              {isCapoOverridden && (
                <Text style={styles.capoOverrideBadge}>modificada</Text>
              )}
            </View>

            <PressableFeedback
              style={[styles.capoStepBtn, isDark && styles.capoStepBtnDark]}
              onPress={() => onSetCapoOverride(effectiveCapo + 1)}
            >
              <PressableFeedback.Highlight />
              <MaterialIcons
                name="add"
                size={22}
                color={isDark ? '#81C784' : '#2E7D32'}
              />
            </PressableFeedback>
          </View>

          {isCapoOverridden && (
            <PressableFeedback
              style={[styles.resetButton, isDark && styles.resetButtonDark]}
              onPress={() => onSetCapoOverride(null)}
            >
              <PressableFeedback.Highlight />
              <MaterialIcons
                name="refresh"
                size={18}
                color={isDark ? '#AEAEB2' : '#636366'}
              />
              <Text
                style={[
                  styles.resetText,
                  { color: isDark ? '#AEAEB2' : '#636366' },
                ]}
              >
                Cejilla original
              </Text>
            </PressableFeedback>
          )}
        </>
      )}
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
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginVertical: 16,
  },
  dividerDark: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  capoSectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  capoOriginalHint: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 12,
  },
  capoStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  capoStepBtn: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  capoStepBtnDark: {
    backgroundColor: Colors.dark.card,
  },
  capoStepBtnDisabled: {
    opacity: 0.4,
  },
  capoValueWrap: {
    flex: 1,
    alignItems: 'center',
  },
  capoValue: {
    fontSize: 17,
    fontWeight: '700',
  },
  capoOverrideBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9D5C00',
    backgroundColor: '#FFF4DA',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
    overflow: 'hidden',
  },
});
