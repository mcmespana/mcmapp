// «Nueva reunión» (plan 06, regla 9): Nombre (con el foco), Día (hoy),
// Empieza (19:00) y Dura (1 · 1,5 · 2 · 3 · 4 h; 1,5). Va por la cola: el
// servidor crea el evento del curso si no existe.

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import BottomSheet from '@/components/BottomSheet';
import AppTextField from '@/components/ui/AppTextField';
import SegmentedControl from '@/components/ui/SegmentedControl';
import typography from '@/constants/typography';
import { comunicaNow } from '@/services/comunica';
import {
  MEETING_DURATIONS,
  MEETING_NAME_MAX,
  type MeetingWrite,
} from '@/services/comunica/contract';
import { useCoordinationWrites } from '@/hooks/comunica/coordination';
import { h } from '@/utils/haptics';
import { madridDay } from '@/utils/comunica/madrid';
import {
  DEFAULT_DURATION,
  DEFAULT_START,
  durationText,
  MEETING_NAME_PLACEHOLDER,
  meetingDraftError,
} from '@/utils/comunica/meetings';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';
import DateTimeField from '../comun/DateTimeField';
import { useComunicaTheme } from '../comun/useComunicaTheme';

export default function NewMeetingSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const t = useComunicaTheme();
  const { createMeeting } = useCoordinationWrites();
  const today = madridDay(comunicaNow());
  const [name, setName] = useState('');
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState(DEFAULT_START);
  const [duration, setDuration] = useState<MeetingWrite['durationHours']>(
    DEFAULT_DURATION as MeetingWrite['durationHours'],
  );
  const [tried, setTried] = useState(false);
  const draft = { name, date, startTime, durationHours: duration };
  const error = meetingDraftError(draft);

  const reset = () => {
    setName('');
    setDate(today);
    setStartTime(DEFAULT_START);
    setDuration(DEFAULT_DURATION as MeetingWrite['durationHours']);
    setTried(false);
  };

  const submit = async () => {
    setTried(true);
    if (error) {
      h.error();
      return;
    }
    await createMeeting({ ...draft, name: name.trim() });
    h.formSuccess();
    reset();
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Nueva reunión">
      <View style={styles.form}>
        <AppTextField
          value={name}
          onChangeText={setName}
          placeholder={MEETING_NAME_PLACEHOLDER}
          maxLength={MEETING_NAME_MAX}
          autoFocus
          accessibilityLabel="Nombre"
          accentColor={t.accentText}
          error={tried && !name.trim()}
        />
        <DateTimeField
          mode="date"
          label="Día"
          value={date}
          onChange={setDate}
        />
        <DateTimeField
          mode="time"
          label="Empieza"
          value={startTime}
          onChange={setStartTime}
        />
        <View style={styles.duration}>
          <Text style={[styles.label, { color: t.text }]}>Dura</Text>
          <SegmentedControl
            options={MEETING_DURATIONS.map((d) => ({
              value: String(d),
              label: durationText(d),
            }))}
            value={String(duration)}
            accentColor={t.accentFill}
            onChange={(v) =>
              setDuration(Number(v) as MeetingWrite['durationHours'])
            }
          />
        </View>
        {tried && error ? (
          <Text
            style={[styles.error, { color: t.dangerText }]}
            accessibilityRole="alert"
          >
            {error}
          </Text>
        ) : null}
        <AreaPrimaryButton
          label="Crear la reunión"
          onPress={() => void submit()}
          haptic={false}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16, paddingBottom: 16 },
  duration: { gap: 8 },
  label: { ...typography.body, fontWeight: '600' },
  error: { ...typography.subhead },
});
