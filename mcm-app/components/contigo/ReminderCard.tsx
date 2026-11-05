// La tarjeta de un recordatorio (evangelio, oración o revisión): interruptor,
// hasta tres horas, días de la semana, el texto del aviso y cómo se verá.
// La pinta `app/(tabs)/contigo/recordatorios.tsx`, una por hábito.

import React, { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { MaterialIcons } from '@/components/ui/icons';
import AppTextField from '@/components/ui/AppTextField';
import { HABITS, type WarmTheme } from '@/components/contigo/theme';
import ReminderTimeChip from '@/components/contigo/ReminderTimeChip';
import { CONTIGO_REMINDER_TEXTS } from '@/constants/contigoReminderTexts';
import typography from '@/constants/typography';
import spacing from '@/constants/spacing';
import { radii, shadows } from '@/constants/uiStyles';
import { h } from '@/utils/haptics';
import {
  CUSTOM_TEXT,
  CUSTOM_TEXT_MAX,
  MAX_TIMES,
  daysSummary,
  reminderMessage,
  type HabitReminder,
  type ReminderHabit,
} from '@/utils/contigoReminders';

const ORDINALS = ['1.º', '2.º', '3.º'];
const DAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DAY_NAMES = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
];

/** Color de primer plano y tinte de cada hábito (los de `warm()`). */
function tone(W: WarmTheme, habit: ReminderHabit) {
  if (habit === 'evangelio') return { fg: W.blue, bg: W.blueLight };
  if (habit === 'revision') return { fg: W.purple, bg: W.purpleLight };
  // El dorado como TEXTO es `accentText` (el `accent` no llega a 4,5:1).
  return { fg: W.accentText, bg: W.accentLight };
}

export interface ReminderCardProps {
  habit: ReminderHabit;
  reminder: HabitReminder;
  W: WarmTheme;
  isDark: boolean;
  onToggle: (enabled: boolean) => void;
  onTime: (index: number, value: string) => void;
  onAddTime: () => void;
  onRemoveTime: (index: number) => void;
  onDay: (day: number) => void;
  onText: (textIndex: number, customText?: string) => void;
}

export default function ReminderCard({
  habit,
  reminder,
  W,
  isDark,
  onToggle,
  onTime,
  onAddTime,
  onRemoveTime,
  onDay,
  onText,
}: ReminderCardProps) {
  const [picking, setPicking] = useState(false);
  const { fg, bg } = tone(W, habit);
  const meta = HABITS[habit];
  const texts = CONTIGO_REMINDER_TEXTS[habit];
  const isCustom = reminder.textIndex === CUSTOM_TEXT;
  const subtitle = reminder.enabled
    ? `${reminder.times.join(' · ')} · ${daysSummary(reminder.days)}`
    : 'Sin recordatorio';

  return (
    <View
      style={[
        styles.card,
        shadows.card,
        { backgroundColor: W.bgCard, borderColor: W.border },
      ]}
    >
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: bg }]}>
          <MaterialIcons name={meta.icon as never} size={26} color={fg} />
        </View>
        <View style={styles.headText}>
          <Text style={[styles.name, { color: W.text }]}>{meta.label}</Text>
          <Text style={[styles.sub, { color: W.textSec }]}>{subtitle}</Text>
        </View>
        <Switch
          value={reminder.enabled}
          onValueChange={(v) => {
            h.toggle();
            onToggle(v);
          }}
          trackColor={{ false: W.bgDeep, true: fg }}
          accessibilityLabel={`Recordatorio de ${meta.label}`}
        />
      </View>

      {reminder.enabled ? (
        <View style={styles.body}>
          <View>
            <Text style={[styles.label, { color: W.textSec }]}>Cuándo</Text>
            <View style={styles.times}>
              {reminder.times.map((t, i) => (
                <ReminderTimeChip
                  key={`${i}-${t}`}
                  value={t}
                  ordinal={ORDINALS[i]}
                  tint={fg}
                  tintBg={bg}
                  textColor={W.text}
                  isDark={isDark}
                  onChange={(v) => onTime(i, v)}
                  onRemove={
                    reminder.times.length > 1
                      ? () => onRemoveTime(i)
                      : undefined
                  }
                />
              ))}
              {reminder.times.length < MAX_TIMES ? (
                <PressableFeedback
                  onPress={() => {
                    h.add();
                    onAddTime();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Añadir otro aviso"
                  style={[styles.add, { borderColor: W.border }]}
                >
                  <MaterialIcons name="add" size={18} color={fg} />
                  <Text style={[styles.addText, { color: fg }]}>
                    Otro aviso
                  </Text>
                </PressableFeedback>
              ) : null}
            </View>
            {reminder.times.length > 1 ? (
              <Text style={[styles.hint, { color: W.textSec }]}>
                Los siguientes solo suenan si aún no lo has hecho.
              </Text>
            ) : null}
          </View>

          <View>
            <Text style={[styles.label, { color: W.textSec }]}>Qué días</Text>
            <View style={styles.days}>
              {DAY_LETTERS.map((letter, i) => {
                const day = i + 1;
                const on = reminder.days.includes(day);
                return (
                  <PressableFeedback
                    key={day}
                    onPress={() => {
                      h.select();
                      onDay(day);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={DAY_NAMES[i]}
                    accessibilityState={{ selected: on }}
                    hitSlop={4}
                    style={[
                      styles.day,
                      on
                        ? { backgroundColor: fg, borderColor: fg }
                        : { borderColor: W.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        { color: on ? W.bgCard : W.textSec },
                      ]}
                    >
                      {letter}
                    </Text>
                  </PressableFeedback>
                );
              })}
            </View>
          </View>

          <View>
            <Text style={[styles.label, { color: W.textSec }]}>
              Qué te decimos
            </Text>
            <View style={[styles.msg, { backgroundColor: W.bg }]}>
              <Text style={[styles.quote, { color: W.text }]}>
                {reminderMessage(habit, reminder, 0).body}
              </Text>
              <PressableFeedback
                onPress={() => setPicking((p) => !p)}
                accessibilityRole="button"
                accessibilityState={{ expanded: picking }}
                style={styles.change}
              >
                <Text style={[styles.changeText, { color: W.accentText }]}>
                  {picking ? 'Listo' : 'Cambiar'}
                </Text>
              </PressableFeedback>
              {picking ? (
                <View style={styles.options}>
                  {texts.first.map((text, i) => (
                    <Option
                      key={i}
                      label={text}
                      selected={reminder.textIndex === i}
                      fg={fg}
                      W={W}
                      onPress={() => onText(i)}
                    />
                  ))}
                  <Option
                    label="Escribir el mío"
                    selected={isCustom}
                    fg={fg}
                    W={W}
                    onPress={() => onText(CUSTOM_TEXT, reminder.customText)}
                  />
                  {isCustom ? (
                    <AppTextField
                      value={reminder.customText}
                      onChangeText={(t) => onText(CUSTOM_TEXT, t)}
                      placeholder="Escribe lo que te gustaría leer"
                      multiline
                      maxLength={CUSTOM_TEXT_MAX}
                      accentColor={fg}
                      accessibilityLabel="Tu mensaje"
                    />
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>

          <View style={[styles.preview, { backgroundColor: W.bgDeep }]}>
            <Text style={[styles.label, { color: W.textSec }]}>
              Así te llegará
            </Text>
            {reminder.times.map((t, i) => {
              const m = reminderMessage(habit, reminder, i);
              return (
                <View
                  key={`${i}-${t}`}
                  style={[styles.notif, { backgroundColor: W.bgCard }]}
                >
                  <Text style={[styles.notifTitle, { color: W.text }]}>
                    {m.title}
                  </Text>
                  <Text style={[styles.notifBody, { color: W.text }]}>
                    {m.body}
                  </Text>
                  <Text style={[styles.notifMeta, { color: W.textSec }]}>
                    {t}
                    {i > 0 ? ' · solo si no lo has hecho' : ''}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Option({
  label,
  selected,
  fg,
  W,
  onPress,
}: {
  label: string;
  selected: boolean;
  fg: string;
  W: WarmTheme;
  onPress: () => void;
}) {
  return (
    <PressableFeedback
      onPress={() => {
        h.select();
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[
        styles.option,
        { backgroundColor: W.bgCard },
        selected ? { borderColor: fg } : { borderColor: 'transparent' },
      ]}
    >
      <View
        style={[
          styles.radio,
          selected
            ? { borderColor: fg, borderWidth: 6 }
            : { borderColor: W.border },
        ]}
      />
      <Text style={[styles.optionText, { color: W.text }]}>{label}</Text>
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: { flex: 1, minWidth: 0 },
  name: { ...typography.h3 },
  sub: { ...typography.subhead },
  body: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  label: { ...typography.overline, marginBottom: spacing.sm },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pillFull,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addText: { ...typography.button },
  hint: { ...typography.caption, marginTop: spacing.sm },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  day: {
    width: 40,
    height: 40,
    borderRadius: radii.pillFull,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { ...typography.button },
  msg: { borderRadius: radii.lg, padding: spacing.md, gap: spacing.sm },
  quote: { ...typography.body, fontWeight: '600' },
  change: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  changeText: { ...typography.button },
  options: { gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 2,
    padding: spacing.sm + 4,
    borderRadius: radii.md,
    borderWidth: 2,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: radii.pillFull,
    borderWidth: 2,
    marginTop: 1,
  },
  optionText: { ...typography.subhead, flex: 1 },
  preview: { borderRadius: radii.lg, padding: spacing.md, gap: spacing.sm },
  notif: { borderRadius: radii.md, padding: spacing.sm + 4, gap: 2 },
  notifTitle: { ...typography.subhead, fontWeight: '700' },
  notifBody: { ...typography.subhead },
  notifMeta: { ...typography.footnote, marginTop: spacing.xs },
});
