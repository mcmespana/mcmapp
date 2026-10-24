// La hoja de una persona al mantener pulsado (plan 04): quién y cuándo, los
// cuatro estados con el actual marcado y lo que significa cada uno, el motivo
// (solo con marca, 255 caracteres), «Ficha y teléfonos» y «Quitar la marca».
// Cerrarla de cualquier forma guarda lo escrito.

import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import BottomSheet from '@/components/BottomSheet';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import type {
  Mark,
  PersonSummary,
  SetMark,
} from '@/services/comunica/contract';
import { NOTE_MAX } from '@/services/comunica/contract';
import { h } from '@/utils/haptics';
import { MARK_HELP, MARK_LABEL, MARK_ORDER } from '@/utils/comunica/marks';
import { MarkIcon } from '../comun/MarkControl';
import { MARK_FILL } from '../comun/theme';
import { useComunicaTheme } from '../comun/useComunicaTheme';

interface Props {
  person: PersonSummary | null;
  when: string;
  mark: Mark;
  note: string;
  onMark: (m: Mark) => void;
  onNote: (note: string) => void;
  onClose: () => void;
  onOpenFicha?: () => void;
}

export default function MarkSheet({
  person,
  when,
  mark,
  note,
  onMark,
  onNote,
  onClose,
  onOpenFicha,
}: Props) {
  const t = useComunicaTheme();
  // El motivo va directo al borrador a cada letra: cerrar la hoja de cualquier
  // forma ya lo deja guardado.
  const close = onClose;

  return (
    <BottomSheet
      visible={!!person}
      onClose={close}
      title={person ? `${person.firstName} ${person.lastName}` : ''}
    >
      <View style={styles.body}>
        <Text style={[styles.when, { color: t.textSecondary }]}>{when}</Text>
        <View accessibilityRole="radiogroup" style={styles.options}>
          {MARK_ORDER.map((m: SetMark) => {
            const selected = mark === m;
            return (
              <PressableFeedback
                key={m}
                onPress={() => {
                  h.select();
                  onMark(m);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${MARK_LABEL[m]}. ${MARK_HELP[m]}`}
                style={[
                  styles.option,
                  {
                    borderColor: selected ? MARK_FILL[m] : t.separator,
                    backgroundColor: selected ? t.backgroundSunken : t.card,
                  },
                ]}
              >
                <PressableFeedback.Highlight />
                <MarkIcon mark={m} />
                <View style={styles.optionText}>
                  <Text style={[styles.optionLabel, { color: t.text }]}>
                    {MARK_LABEL[m]}
                  </Text>
                  <Text style={[styles.optionHelp, { color: t.textSecondary }]}>
                    {MARK_HELP[m]}
                  </Text>
                </View>
                {selected ? (
                  <IconSymbol name="checkmark" size={18} color={t.accentText} />
                ) : null}
              </PressableFeedback>
            );
          })}
        </View>

        {mark ? (
          <TextInput
            value={note}
            onChangeText={onNote}
            maxLength={NOTE_MAX}
            placeholder="Añadir un motivo (opcional)"
            placeholderTextColor={t.textMuted}
            accessibilityLabel="Motivo"
            multiline
            style={[
              styles.note,
              { color: t.text, backgroundColor: t.backgroundSunken },
            ]}
          />
        ) : null}

        <View style={styles.links}>
          {onOpenFicha ? (
            <PressableFeedback
              onPress={() => {
                close();
                onOpenFicha();
              }}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={[styles.link, { color: t.accentText }]}>
                Ficha y teléfonos ›
              </Text>
            </PressableFeedback>
          ) : (
            <View />
          )}
          {mark ? (
            <PressableFeedback
              onPress={() => {
                h.remove();
                onMark(null);
              }}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={[styles.link, { color: t.dangerText }]}>
                Quitar la marca
              </Text>
            </PressableFeedback>
          ) : null}
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12, paddingBottom: 16 },
  when: { ...typography.subhead },
  options: { gap: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: 2,
  },
  optionText: { flex: 1, gap: 2 },
  optionLabel: { ...typography.body, fontWeight: '600' },
  optionHelp: { ...typography.caption },
  note: {
    ...typography.body,
    minHeight: 72,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  links: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  link: { ...typography.button },
});
