// components/contigo/PrayerLogger.tsx — Duration + Emotion selector for prayer registration
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';
import { radii } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';
import type { PrayerDuration, Emotion } from '@/types/contigo';
import { DURATIONS, EMOTIONS } from '@/types/contigo';

interface Props {
  onSave: (duration: PrayerDuration, emotion: Emotion) => void;
  onCancel?: () => void;
}

export default function PrayerLogger({ onSave, onCancel }: Props) {
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedDuration, setSelectedDuration] =
    useState<PrayerDuration | null>(null);
  const [selectedEmotion, setSelectedEmotion] = useState<Emotion | null>(null);

  const handleDurationSelect = (dur: PrayerDuration) => {
    setSelectedDuration(dur);
    setStep(2);
  };

  const handleEmotionSelect = (emo: Emotion) => {
    setSelectedEmotion(emo);
  };

  const handleSave = () => {
    if (selectedDuration && selectedEmotion) {
      onSave(selectedDuration, selectedEmotion);
    }
  };

  return (
    <View style={styles.container}>
      {step === 1 ? (
        <>
          <Text style={[styles.question, { color: theme.text }]}>
            ¿Cuánto tiempo has dedicado hoy a la oración?
          </Text>
          <Text style={[styles.hint, { color: theme.icon }]}>
            Lo importante no es la duración, pero te puede ayudar registrarlo
          </Text>
          <View style={styles.chipsRow}>
            {DURATIONS.map((dur) => (
              <TouchableOpacity
                key={dur.key}
                style={[
                  styles.chip,
                  {
                    backgroundColor:
                      selectedDuration === dur.key
                        ? '#6B3FA0'
                        : scheme === 'dark'
                          ? 'rgba(255,255,255,0.08)'
                          : 'rgba(0,0,0,0.05)',
                    borderColor:
                      selectedDuration === dur.key ? '#6B3FA0' : 'transparent',
                  },
                ]}
                onPress={() => handleDurationSelect(dur.key)}
                accessibilityLabel={dur.label}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: selectedDuration === dur.key ? '#fff' : theme.text,
                    },
                  ]}
                >
                  {dur.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : (
        <>
          <Text style={[styles.question, { color: theme.text }]}>
            ¿Cómo te has sentido en la oración?
          </Text>
          <View style={styles.emotionsRow}>
            {EMOTIONS.map((emo) => (
              <TouchableOpacity
                key={emo.key}
                style={[
                  styles.emotionBtn,
                  {
                    backgroundColor:
                      selectedEmotion === emo.key
                        ? emo.color + '25'
                        : scheme === 'dark'
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(0,0,0,0.03)',
                    borderColor:
                      selectedEmotion === emo.key ? emo.color : 'transparent',
                    borderWidth: selectedEmotion === emo.key ? 2 : 0,
                  },
                ]}
                onPress={() => handleEmotionSelect(emo.key)}
                accessibilityLabel={emo.label}
              >
                <Text style={styles.emotionEmoji}>{emo.emoji}</Text>
                <Text
                  style={[
                    styles.emotionLabel,
                    {
                      color:
                        selectedEmotion === emo.key ? emo.color : theme.icon,
                    },
                  ]}
                >
                  {emo.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Back + Save buttons */}
          <View style={styles.buttonsRow}>
            <TouchableOpacity
              style={[styles.backBtn, { borderColor: theme.icon + '30' }]}
              onPress={() => setStep(1)}
            >
              <MaterialIcons name="arrow-back" size={16} color={theme.icon} />
              <Text style={[styles.backBtnText, { color: theme.icon }]}>
                Atrás
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.saveBtn,
                {
                  backgroundColor: selectedEmotion
                    ? '#6B3FA0'
                    : theme.icon + '20',
                },
              ]}
              onPress={handleSave}
              disabled={!selectedEmotion}
            >
              <MaterialIcons name="check" size={18} color="#fff" />
              <Text style={styles.saveBtnText}>Guardar</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {onCancel && (
        <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
          <Text style={[styles.cancelText, { color: theme.icon }]}>
            Cancelar
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  question: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  hint: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    opacity: 0.7,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emotionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm + 2,
  },
  emotionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 72,
    borderRadius: radii.lg,
    gap: 4,
  },
  emotionEmoji: {
    fontSize: 26,
  },
  emotionLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1.5,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: radii.pill,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  cancelBtn: {
    alignSelf: 'center',
    padding: spacing.sm,
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
