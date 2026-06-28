import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import StarRating from '@/components/StarRating';
import { Colors } from '@/constants/colors';
import { hexAlpha } from '@/utils/colorUtils';
import { h } from '@/utils/haptics';
import type { EvalQuestion } from '@/constants/evaluation';
import ScaleInput from './ScaleInput';

type AnswerValue = number | string | boolean | string[];

/**
 * Renderiza el control de entrada para una pregunta del wizard según su tipo
 * (stars / text / yesno / scale / single / multi). Extraído de
 * EvaluationWizard. La pregunta, el valor y los callbacks vienen del padre.
 */
export default function QuestionInput({
  question,
  value,
  theme,
  accent,
  isDark,
  starColor,
  onAnswer,
  onToggleMulti,
}: {
  question: EvalQuestion;
  value: AnswerValue | undefined;
  theme: (typeof Colors)['light'];
  accent: string;
  isDark: boolean;
  starColor: string;
  onAnswer: (id: string, value: AnswerValue) => void;
  onToggleMulti: (id: string, optionValue: string) => void;
}) {
  return (
    <>
      {question.type === 'stars' && (
        <View style={qStyles.starsWrap}>
          <StarRating
            value={typeof value === 'number' ? value : 0}
            onChange={(n) => onAnswer(question.id, n)}
            color={starColor}
            size={46}
          />
        </View>
      )}

      {question.type === 'text' && (
        <TextInput
          value={typeof value === 'string' ? value : ''}
          onChangeText={(t) => onAnswer(question.id, t)}
          placeholder={question.placeholder}
          placeholderTextColor={theme.icon}
          multiline
          textAlignVertical="top"
          maxLength={1000}
          autoFocus
          style={[
            qStyles.input,
            {
              color: theme.text,
              backgroundColor: isDark ? '#2C2C2E' : '#fff',
              borderColor: String(value ?? '').trim()
                ? hexAlpha(accent, '90')
                : hexAlpha(theme.icon, '35'),
            },
          ]}
        />
      )}

      {question.type === 'yesno' && (
        <View style={qStyles.yesnoRow}>
          {[
            { key: true, label: 'Sí', icon: 'thumb-up' as const },
            { key: false, label: 'No', icon: 'thumb-down' as const },
          ].map((opt) => {
            const selected = value === opt.key;
            return (
              <Pressable
                key={opt.label}
                onPress={() => onAnswer(question.id, opt.key)}
                style={[
                  qStyles.yesnoBtn,
                  {
                    borderColor: selected ? accent : hexAlpha(theme.icon, '30'),
                    backgroundColor: selected
                      ? hexAlpha(accent, '15')
                      : 'transparent',
                  },
                ]}
              >
                <MaterialIcons
                  name={opt.icon}
                  size={22}
                  color={selected ? accent : theme.icon}
                />
                <Text
                  style={[
                    qStyles.yesnoText,
                    { color: selected ? accent : theme.icon },
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {question.type === 'scale' && (
        <ScaleInput
          min={question.min ?? 0}
          max={question.max ?? 10}
          minLabel={question.minLabel}
          maxLabel={question.maxLabel}
          value={typeof value === 'number' ? value : null}
          onChange={(n) => onAnswer(question.id, n)}
          accent={accent}
          theme={theme}
        />
      )}

      {question.type === 'single' &&
        (question.options ?? []).map((opt) => {
          const selected = value === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                h.select();
                onAnswer(question.id, opt.value);
              }}
              style={[
                qStyles.optionRow,
                {
                  borderColor: selected ? accent : hexAlpha(theme.icon, '30'),
                  backgroundColor: selected
                    ? hexAlpha(accent, '12')
                    : 'transparent',
                },
              ]}
            >
              <MaterialIcons
                name={
                  selected ? 'radio-button-checked' : 'radio-button-unchecked'
                }
                size={22}
                color={selected ? accent : theme.icon}
              />
              <Text style={[qStyles.optionLabel, { color: theme.text }]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}

      {question.type === 'multi' &&
        (question.options ?? []).map((opt) => {
          const arr = Array.isArray(value) ? (value as string[]) : [];
          const selected = arr.includes(opt.value);
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                h.select();
                onToggleMulti(question.id, opt.value);
              }}
              style={[
                qStyles.optionRow,
                {
                  borderColor: selected ? accent : hexAlpha(theme.icon, '30'),
                  backgroundColor: selected
                    ? hexAlpha(accent, '12')
                    : 'transparent',
                },
              ]}
            >
              <MaterialIcons
                name={selected ? 'check-box' : 'check-box-outline-blank'}
                size={22}
                color={selected ? accent : theme.icon}
              />
              <Text style={[qStyles.optionLabel, { color: theme.text }]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
    </>
  );
}

const qStyles = StyleSheet.create({
  starsWrap: { alignItems: 'flex-start' },
  input: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    minHeight: 130,
    lineHeight: 23,
  },
  yesnoRow: { flexDirection: 'row', gap: 12 },
  yesnoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  yesnoText: { fontSize: 16, fontWeight: '700' },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  optionLabel: { flex: 1, fontSize: 16, fontWeight: '600' },
});
