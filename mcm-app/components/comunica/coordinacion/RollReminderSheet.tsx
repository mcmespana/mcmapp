// «Recordar que pasen lista» (15/11/2026): coordinación manda un aviso al
// móvil de los monitores de los grupos elegidos en el Resumen. El tono
// (gracioso o serio) se queda guardado en el móvil; el mensaje sale al azar
// de los 100 de `utils/comunica/rollReminders.ts`, se puede cambiar por otro
// o escribir a mano (120 caracteres). Lo que se ve es lo que llega.
//
// No va por la cola: hace falta conexión y la respuesta dice a cuántos ha
// llegado. El `clientId` se mantiene entre reintentos para no mandarlo dos
// veces si la primera respuesta se perdió.

import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import BottomSheet from '@/components/BottomSheet';
import AppTextField from '@/components/ui/AppTextField';
import { IconSymbol } from '@/components/ui/IconSymbol';
import SegmentedControl from '@/components/ui/SegmentedControl';
import typography from '@/constants/typography';
import { getComunicaApi } from '@/services/comunica';
import { isComunicaApiError } from '@/services/comunica/client';
import {
  ROLL_REMINDER_MESSAGE_MAX,
  type RollReminderResult,
} from '@/services/comunica/contract';
import { h } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import {
  cleanReminder,
  groupsText,
  loadReminderTone,
  randomReminder,
  reminderIsValid,
  REMINDER_TONE_OPTIONS,
  saveReminderTone,
  type ReminderTone,
} from '@/utils/comunica/rollReminders';
import { uuidV4 } from '@/utils/comunica/uuid';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';
import { useComunicaTheme } from '../comun/useComunicaTheme';

export default function RollReminderSheet({
  visible,
  groupIds,
  onClose,
  onSent,
}: {
  visible: boolean;
  groupIds: readonly string[];
  onClose: () => void;
  onSent: (result: RollReminderResult) => void;
}) {
  const t = useComunicaTheme();
  const [tone, setTone] = useState<ReminderTone>('funny');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientId = useRef<string | null>(null);

  // Al abrir: el tono guardado y un mensaje nuevo de ese tono.
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    clientId.current = null;
    void loadReminderTone().then((saved) => {
      if (!alive) return;
      setError(null);
      setTone(saved);
      setMessage(randomReminder(saved));
    });
    return () => {
      alive = false;
    };
  }, [visible]);

  const pickTone = (next: ReminderTone) => {
    setTone(next);
    setMessage(randomReminder(next));
    void saveReminderTone(next);
  };

  const another = () => {
    h.tap();
    setMessage((m) => randomReminder(tone, m));
  };

  const send = async () => {
    if (!reminderIsValid(message) || groupIds.length === 0) {
      h.error();
      return;
    }
    setSending(true);
    setError(null);
    clientId.current ??= uuidV4();
    try {
      const result = await getComunicaApi().sendRollReminders({
        clientId: clientId.current,
        groupIds: [...groupIds],
        message: cleanReminder(message),
      });
      clientId.current = null;
      onSent(result);
    } catch (e) {
      logger.warn('[comunica] recordatorio de pasar lista', e);
      h.error();
      setError(
        isComunicaApiError(e) && e.code === 'forbidden'
          ? 'Solo coordinación puede avisar, y solo a sus grupos.'
          : 'No se ha podido enviar. Comprueba la conexión y prueba otra vez.',
      );
    } finally {
      setSending(false);
    }
  };

  const length = cleanReminder(message).length;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Recordar que pasen lista"
    >
      <View style={styles.form}>
        <Text style={[styles.body, { color: t.textSecondary }]}>
          Les llega un aviso al móvil a los monitores de{' '}
          {groupsText(groupIds.length)}.
        </Text>
        <SegmentedControl
          options={REMINDER_TONE_OPTIONS}
          value={tone}
          accentColor={t.accentFill}
          onChange={(v) => pickTone(v as ReminderTone)}
        />
        <AppTextField
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={ROLL_REMINDER_MESSAGE_MAX}
          placeholder="Escribe el mensaje"
          accessibilityLabel="Mensaje del aviso"
          accentColor={t.accentText}
          error={!!message && !reminderIsValid(message)}
        />
        <View style={styles.tools}>
          <PressableFeedback
            onPress={another}
            accessibilityRole="button"
            accessibilityLabel="Otro mensaje al azar"
            style={styles.another}
          >
            <IconSymbol name="arrow.clockwise" size={18} color={t.accentText} />
            <Text style={[styles.link, { color: t.accentText }]}>
              Otro al azar
            </Text>
          </PressableFeedback>
          <Text style={[styles.small, { color: t.textSecondary }]}>
            {length}/{ROLL_REMINDER_MESSAGE_MAX}
          </Text>
        </View>
        {error ? (
          <Text
            style={[styles.error, { color: t.dangerText }]}
            accessibilityRole="alert"
          >
            {error}
          </Text>
        ) : null}
        <AreaPrimaryButton
          label="Enviar el aviso"
          icon="paperplane.fill"
          onPress={() => void send()}
          loading={sending}
          disabled={!reminderIsValid(message)}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16, paddingBottom: 16 },
  body: { ...typography.body },
  small: { ...typography.caption },
  link: { ...typography.button },
  tools: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  another: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
  },
  error: { ...typography.subhead },
});
