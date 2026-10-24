// Avisos de comportamiento en la ficha (plan 05, regla 20; `ficha.php`
// l.719-848 y `PASAR-LISTA-CAMPOS-CRM.md` §6). La sección sale siempre (el
// primero tiene que poder ponerse); el número no se guarda, sale de ordenar
// por fecha e id; escala ámbar → naranja → rojo; el recordatorio ANTES de
// poner el último. «Añadir un aviso» va por la cola: sale al momento, en su
// sitio y numerado, con su `UploadStatus`.

import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import BottomSheet from '@/components/BottomSheet';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { NOTICE_REASON_MAX } from '@/services/comunica/contract';
import { useGruposWrites } from '@/hooks/comunica/useGrupos';
import { onColor } from '@/utils/colorUtils';
import { h } from '@/utils/haptics';
import { longDay } from '@/utils/comunica/dates';
import { addDays } from '@/utils/comunica/madrid';
import {
  noticeTier,
  noticeWarning,
  type NumberedNotice,
} from '@/utils/comunica/notices';
import { shortDate } from '@/utils/comunica/sessions';
import AreaSwitch from '../comun/AreaSwitch';
import { confirmAction } from '../comun/confirm';
import { NOTICE_FILL } from '../comun/theme';
import StatusChip from '../comun/StatusChip';
import UploadStatus, { type UploadState } from '../comun/UploadStatus';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import { FichaSection } from './FichaParts';

interface Props {
  personId: string;
  firstName: string;
  notices: NumberedNotice[];
  limit: number;
  /** Estado en la cola de cada aviso pendiente (por `outboxKey`). */
  uploadOf: (key: string) => UploadState | undefined;
  onRetry: (key: string) => void;
  today: string;
  /** Desde la pantalla de marcar: la sesión de la que se viene. */
  sessionId?: string;
}

export default function FichaNotices({
  personId,
  firstName,
  notices,
  limit,
  uploadOf,
  onRetry,
  today,
  sessionId,
}: Props) {
  const t = useComunicaTheme();
  const [adding, setAdding] = useState(false);
  const count = notices.length;
  const warning = noticeWarning(count, limit);

  const scale =
    count > 0 ? (
      <View
        style={styles.scale}
        accessible
        accessibilityLabel={`${count} de ${limit} avisos`}
      >
        {Array.from({ length: Math.max(limit, count) }, (_, i) => {
          const n = i + 1;
          return (
            <View
              key={n}
              style={[
                styles.pip,
                n <= count
                  ? { backgroundColor: NOTICE_FILL[noticeTier(n)] }
                  : {
                      borderWidth: 1.5,
                      // El hueco del ÚLTIMO, en rojo: el que no quieres llenar.
                      borderColor: n === limit ? NOTICE_FILL[3] : t.textMuted,
                    },
              ]}
            />
          );
        })}
        <Text style={[styles.caption, { color: t.textSecondary }]}>
          {count} de {limit}
        </Text>
      </View>
    ) : null;

  return (
    <FichaSection title="Avisos de comportamiento" right={scale}>
      <View style={[styles.card, { backgroundColor: t.card }]}>
        {count === 0 ? (
          <Text style={[styles.body, { color: t.textSecondary }]}>
            Ningún aviso este curso.
          </Text>
        ) : null}
        {notices.map((n) => {
          const fill = NOTICE_FILL[noticeTier(n.number)];
          const upload = n.outboxKey ? uploadOf(n.outboxKey) : undefined;
          return (
            <View key={n.id} style={[styles.notice, { borderLeftColor: fill }]}>
              <View
                style={[styles.num, { backgroundColor: fill }]}
                accessible
                accessibilityLabel={`Aviso ${n.number} de ${limit}`}
              >
                <Text style={[styles.numText, { color: onColor(fill) }]}>
                  {n.number}
                </Text>
              </View>
              <View style={styles.noticeBody}>
                <Text style={[styles.body, { color: t.text }]}>{n.reason}</Text>
                <Text style={[styles.caption, { color: t.textSecondary }]}>
                  {n.placedBy
                    ? `${shortDate(n.date)} · lo puso ${n.placedBy}`
                    : shortDate(n.date)}
                </Text>
                <StatusChip
                  label={
                    n.familyNotified ? 'Familia avisada' : 'Familia sin avisar'
                  }
                  tone={n.familyNotified ? 'positive' : 'warning'}
                />
                {upload ? (
                  <UploadStatus
                    state={upload}
                    onRetry={() => n.outboxKey && onRetry(n.outboxKey)}
                  />
                ) : null}
              </View>
            </View>
          );
        })}
        {warning ? (
          <View style={[styles.warn, { backgroundColor: t.warningSoft }]}>
            <IconSymbol
              name="exclamationmark.triangle.fill"
              size={16}
              color={t.warningIcon}
            />
            <Text style={[styles.body, styles.flex, { color: t.warningText }]}>
              {warning.kind === 'next_is_exit' ? (
                <>
                  <Text style={styles.bold}>El aviso {warning.limit}</Text>{' '}
                  implica la salida del grupo. Habla con coordinación antes.
                </>
              ) : (
                <>
                  Ya está en{' '}
                  <Text style={styles.bold}>
                    {warning.count === 1
                      ? '1 aviso'
                      : `${warning.count} avisos`}
                  </Text>
                  . Esto implica la salida del grupo: hablad en coordinación
                  antes de hacer nada.
                </>
              )}
            </Text>
          </View>
        ) : null}
        <PressableFeedback
          onPress={() => {
            h.select();
            setAdding(true);
          }}
          accessibilityRole="button"
          style={[styles.add, { borderColor: t.separator }]}
        >
          <PressableFeedback.Highlight />
          <IconSymbol name="plus" size={18} color={t.accentText} />
          <Text style={[styles.addLabel, { color: t.accentText }]}>
            Añadir un aviso
          </Text>
        </PressableFeedback>
      </View>
      <NoticeSheet
        visible={adding}
        onClose={() => setAdding(false)}
        personId={personId}
        firstName={firstName}
        today={today}
        sessionId={sessionId}
      />
    </FichaSection>
  );
}

function NoticeSheet({
  visible,
  onClose,
  personId,
  firstName,
  today,
  sessionId,
}: {
  visible: boolean;
  onClose: () => void;
  personId: string;
  firstName: string;
  today: string;
  sessionId?: string;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Añadir un aviso">
      {/* `key`: cada vez que se abre, el formulario empieza de cero. */}
      {visible ? (
        <NoticeForm
          key={today}
          onDone={onClose}
          personId={personId}
          firstName={firstName}
          today={today}
          sessionId={sessionId}
        />
      ) : (
        <View />
      )}
    </BottomSheet>
  );
}

function NoticeForm({
  onDone,
  personId,
  firstName,
  today,
  sessionId,
}: {
  onDone: () => void;
  personId: string;
  firstName: string;
  today: string;
  sessionId?: string;
}) {
  const t = useComunicaTheme();
  const { createNotice } = useGruposWrites();
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(today);
  const [told, setTold] = useState(false);
  const [tried, setTried] = useState(false);
  const empty = !reason.trim();

  const submit = async () => {
    setTried(true);
    if (empty) {
      h.error();
      return;
    }
    const ok = await confirmAction(
      `¿Poner un aviso a ${firstName}? Coordinación lo verá.`,
      undefined,
      'Registrar',
    );
    if (!ok) return;
    await createNotice(personId, {
      // Nunca después de hoy (hora de Madrid); el servidor lo recorta igual.
      date: date > today ? today : date,
      reason: reason.trim(),
      familyNotified: told,
      ...(sessionId ? { sessionId } : {}),
    });
    h.formSuccess();
    onDone();
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <View style={styles.form}>
        <Text style={[styles.label, { color: t.text }]}>Qué ha pasado</Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          multiline
          maxLength={NOTICE_REASON_MAX}
          placeholder="En tus palabras. Lo va a leer coordinación y quizá la familia."
          placeholderTextColor={t.textMuted}
          accessibilityLabel="Qué ha pasado"
          style={[
            styles.input,
            {
              color: t.text,
              backgroundColor: t.backgroundSunken,
              borderColor: tried && empty ? t.dangerText : t.backgroundSunken,
            },
          ]}
        />
        {tried && empty ? (
          <Text style={[styles.caption, { color: t.dangerText }]}>
            Escribe qué ha pasado.
          </Text>
        ) : null}

        <Text style={[styles.label, { color: t.text }]}>Cuándo</Text>
        <View style={[styles.dateRow, { backgroundColor: t.backgroundSunken }]}>
          <PressableFeedback
            onPress={() => setDate((d) => addDays(d, -1))}
            accessibilityRole="button"
            accessibilityLabel="Un día antes"
            style={styles.dateButton}
          >
            <IconSymbol name="chevron.left" size={18} color={t.accentText} />
          </PressableFeedback>
          <Text
            style={[styles.date, { color: t.text }]}
            accessibilityLiveRegion="polite"
          >
            {date === today ? `Hoy, ${longDay(date)}` : longDay(date, true)}
          </Text>
          <PressableFeedback
            onPress={() => setDate((d) => (d < today ? addDays(d, 1) : d))}
            isDisabled={date >= today}
            accessibilityRole="button"
            accessibilityLabel="Un día después"
            accessibilityState={{ disabled: date >= today }}
            style={[styles.dateButton, date >= today && styles.disabled]}
          >
            <IconSymbol name="chevron.right" size={18} color={t.accentText} />
          </PressableFeedback>
        </View>

        <View style={styles.switchRow}>
          <Text style={[styles.body, styles.flex, { color: t.text }]}>
            Ya he hablado con la familia
          </Text>
          <AreaSwitch
            value={told}
            onChange={setTold}
            label="Ya he hablado con la familia"
          />
        </View>

        <PressableFeedback
          onPress={() => void submit()}
          accessibilityRole="button"
          style={[styles.submit, { backgroundColor: t.accentFill }]}
        >
          <PressableFeedback.Scale />
          <Text style={[styles.submitLabel, { color: t.onAccent }]}>
            Registrar el aviso
          </Text>
        </PressableFeedback>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.lg, padding: 16, gap: 12 },
  body: { ...typography.body },
  caption: { ...typography.caption },
  bold: { fontWeight: '700' },
  flex: { flex: 1 },
  scale: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pip: { width: 10, height: 10, borderRadius: radii.pillFull },
  notice: {
    flexDirection: 'row',
    gap: 12,
    borderLeftWidth: 3,
    paddingLeft: 10,
  },
  num: {
    width: 28,
    height: 28,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: { ...typography.subhead, fontWeight: '700' },
  noticeBody: { flex: 1, gap: 4 },
  warn: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: radii.md,
    alignItems: 'flex-start',
  },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  addLabel: { ...typography.button },
  form: { gap: 10, paddingBottom: 16 },
  label: { ...typography.subhead, fontWeight: '600' },
  input: {
    ...typography.body,
    minHeight: 96,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.sm,
    minHeight: 48,
  },
  dateButton: {
    width: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.35 },
  date: { ...typography.body, flex: 1, textAlign: 'center' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
  },
  submit: {
    minHeight: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  submitLabel: { ...typography.button },
});
