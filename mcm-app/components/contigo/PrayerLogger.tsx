import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ScrollView,
} from 'react-native';
import {
  PrayerDuration,
  Emotion,
  PRAYER_DURATION_LABELS,
  EMOTION_COLORS,
  EMOTION_LABELS,
  EMOTION_EMOJIS,
} from '@/hooks/useContigoHabits';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { radii } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';

const DURATIONS: PrayerDuration[] = [
  'less_than_1',
  '2_to_4',
  '5_to_10',
  '10_to_15',
  'more_than_15',
];

const EMOTIONS: Emotion[] = ['joy', 'sadness', 'anger', 'fear', 'disgust'];

interface PrayerLoggerProps {
  onSave: (duration: PrayerDuration, emotion: Emotion) => void;
  onCancel?: () => void;
}

export default function PrayerLogger({ onSave, onCancel }: PrayerLoggerProps) {
  const [duration, setDuration] = useState<PrayerDuration | null>(null);
  const [emotion, setEmotion] = useState<Emotion | null>(null);
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];
  const isDark = scheme === 'dark';

  const canSave = duration !== null && emotion !== null;

  return (
    <View style={styles.container}>
      {/* Duration */}
      <Text style={[styles.question, { color: theme.text }]}>
        ¿Cuánto tiempo has dedicado hoy a la oración?
      </Text>
      <Text style={[styles.hint, { color: theme.icon }]}>
        Lo importante no es la duración, pero registrarla puede ayudarte.
      </Text>

      <View style={styles.chips}>
        {DURATIONS.map((d) => {
          const selected = duration === d;
          return (
            <TouchableOpacity
              key={d}
              style={[
                styles.chip,
                {
                  backgroundColor: selected
                    ? '#253883'
                    : isDark
                      ? '#ffffff15'
                      : '#00000008',
                  borderColor: selected ? '#253883' : isDark ? '#ffffff30' : '#00000020',
                },
              ]}
              onPress={() => setDuration(d)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: selected ? '#fff' : theme.text },
                ]}
              >
                {PRAYER_DURATION_LABELS[d]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Emotion */}
      <Text style={[styles.question, { color: theme.text, marginTop: spacing.md }]}>
        ¿Cómo te has sentido en la oración?
      </Text>

      <View style={styles.emotions}>
        {EMOTIONS.map((e) => {
          const selected = emotion === e;
          const color = EMOTION_COLORS[e];
          return (
            <TouchableOpacity
              key={e}
              style={[
                styles.emotionBtn,
                {
                  backgroundColor: selected ? color + '30' : 'transparent',
                  borderColor: selected ? color : isDark ? '#ffffff20' : '#00000015',
                  borderWidth: selected ? 2 : 1,
                },
              ]}
              onPress={() => setEmotion(e)}
              activeOpacity={0.7}
            >
              <Text style={styles.emotionEmoji}>{EMOTION_EMOJIS[e]}</Text>
              <Text
                style={[
                  styles.emotionLabel,
                  { color: selected ? color : theme.icon },
                  selected && { fontWeight: '700' },
                ]}
              >
                {EMOTION_LABELS[e]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {onCancel && (
          <TouchableOpacity
            style={[
              styles.btn,
              styles.cancelBtn,
              {
                borderColor: isDark ? '#ffffff20' : '#00000020',
              },
            ]}
            onPress={onCancel}
          >
            <Text style={[styles.btnText, { color: theme.icon }]}>
              Cancelar
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.btn,
            styles.saveBtn,
            { backgroundColor: canSave ? '#253883' : '#25388340', flex: 1 },
          ]}
          onPress={() => canSave && onSave(duration!, emotion!)}
          disabled={!canSave}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.btnText,
              { color: canSave ? '#fff' : '#ffffff80' },
            ]}
          >
            Guardar
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  } as ViewStyle,
  question: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  } as TextStyle,
  hint: {
    fontSize: 12,
    lineHeight: 17,
    opacity: 0.7,
    marginTop: -4,
  } as TextStyle,
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  } as ViewStyle,
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
  } as ViewStyle,
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  } as TextStyle,
  emotions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  } as ViewStyle,
  emotionBtn: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.lg,
    minWidth: 64,
    gap: 4,
  } as ViewStyle,
  emotionEmoji: {
    fontSize: 22,
  } as TextStyle,
  emotionLabel: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  } as TextStyle,
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.sm,
  } as ViewStyle,
  btn: {
    paddingVertical: 12,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  cancelBtn: {
    paddingHorizontal: 16,
    borderWidth: 1,
  } as ViewStyle,
  saveBtn: {} as ViewStyle,
  btnText: {
    fontSize: 14,
    fontWeight: '700',
  } as TextStyle,
});
