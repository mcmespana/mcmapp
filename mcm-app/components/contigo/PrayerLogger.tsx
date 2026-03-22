import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  PrayerDuration,
  Emotion,
  EMOTION_CONFIG,
  DURATION_CONFIG,
} from '@/hooks/useContigoHabits';

interface Props {
  onSave: (duration: PrayerDuration, emotion: Emotion) => void;
  onCancel?: () => void;
}

export default function PrayerLogger({ onSave, onCancel }: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const [step, setStep] = useState<1 | 2>(1);
  const [duration, setDuration] = useState<PrayerDuration | null>(null);
  const [emotion, setEmotion] = useState<Emotion | null>(null);

  const handleSave = () => {
    if (duration && emotion) {
      onSave(duration, emotion);
    }
  };

  return (
    <View style={styles.container}>
      {step === 1 ? (
        <>
          <Text
            style={[
              styles.question,
              { color: isDark ? '#FFF' : '#1A1A2E' },
            ]}
          >
            ¿Cuánto tiempo has dedicado hoy a la oración?
          </Text>
          <Text
            style={[
              styles.hint,
              { color: isDark ? '#888' : '#999' },
            ]}
          >
            Lo importante no es la duración, pero te puede ayudar
            registrarlo
          </Text>

          <View style={styles.chipsGrid}>
            {(Object.keys(DURATION_CONFIG) as PrayerDuration[]).map(
              (key) => {
                const selected = duration === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected
                          ? '#E15C62'
                          : isDark
                            ? '#3A3A3C'
                            : '#F5F5F5',
                        borderColor: selected
                          ? '#E15C62'
                          : isDark
                            ? '#555'
                            : '#E0E0E0',
                      },
                    ]}
                    onPress={() => setDuration(key)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color: selected
                            ? '#FFF'
                            : isDark
                              ? '#CCC'
                              : '#555',
                        },
                      ]}
                    >
                      {DURATION_CONFIG[key].label}
                    </Text>
                  </TouchableOpacity>
                );
              },
            )}
          </View>

          <View style={styles.buttonRow}>
            {onCancel && (
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary]}
                onPress={onCancel}
              >
                <Text style={styles.btnSecondaryText}>Cancelar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.btn,
                styles.btnPrimary,
                !duration && styles.btnDisabled,
              ]}
              onPress={() => duration && setStep(2)}
              disabled={!duration}
            >
              <Text style={styles.btnPrimaryText}>Siguiente</Text>
              <MaterialIcons name="arrow-forward" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <Text
            style={[
              styles.question,
              { color: isDark ? '#FFF' : '#1A1A2E' },
            ]}
          >
            ¿Cómo te has sentido en la oración?
          </Text>

          <View style={styles.emotionGrid}>
            {(Object.keys(EMOTION_CONFIG) as Emotion[]).map((key) => {
              const config = EMOTION_CONFIG[key];
              const selected = emotion === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.emotionBtn,
                    {
                      backgroundColor: selected
                        ? config.color + '20'
                        : isDark
                          ? '#3A3A3C'
                          : '#FAFAFA',
                      borderColor: selected
                        ? config.color
                        : isDark
                          ? '#555'
                          : '#E8E8E8',
                      borderWidth: selected ? 2 : 1,
                    },
                  ]}
                  onPress={() => setEmotion(key)}
                >
                  <MaterialIcons
                    name={config.icon as any}
                    size={32}
                    color={selected ? config.color : isDark ? '#888' : '#AAA'}
                  />
                  <Text
                    style={[
                      styles.emotionLabel,
                      {
                        color: selected
                          ? config.color
                          : isDark
                            ? '#BBB'
                            : '#666',
                        fontWeight: selected ? '700' : '500',
                      },
                    ]}
                  >
                    {config.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary]}
              onPress={() => setStep(1)}
            >
              <MaterialIcons
                name="arrow-back"
                size={18}
                color="#666"
              />
              <Text style={styles.btnSecondaryText}>Atrás</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.btn,
                styles.btnPrimary,
                { backgroundColor: '#4CAF50' },
                !emotion && styles.btnDisabled,
              ]}
              onPress={handleSave}
              disabled={!emotion}
            >
              <MaterialIcons name="check" size={18} color="#FFF" />
              <Text style={styles.btnPrimaryText}>Guardar</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  question: {
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emotionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
    marginBottom: 24,
    justifyContent: 'center',
  },
  emotionBtn: {
    width: '29%',
    aspectRatio: 0.9,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    minWidth: 90,
  },
  emotionLabel: {
    fontSize: 13,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  btnPrimary: {
    backgroundColor: '#E15C62',
  },
  btnPrimaryText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  btnSecondary: {
    backgroundColor: '#F0F0F0',
  },
  btnSecondaryText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.4,
  },
});
