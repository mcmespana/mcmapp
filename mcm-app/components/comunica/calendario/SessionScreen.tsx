// «Sesión» (plan 16, regla C8; `single_stic_sessions`): el nombre, «sábado 25 de octubre», «17:30 – 19:00» (si no hay fin o cruza la medianoche, solo el inicio),
// el estado en chip, el evento (tocar lleva a su ficha) y la descripción. Sin inscripción activa al evento: «Esta sesión ya no está disponible» (403).
// Sin conexión, la sesión sale del calendario guardado.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import EmptyState from '@/components/ui/EmptyState';
import typography from '@/constants/typography';
import { comunicaNow } from '@/services/comunica';
import { isComunicaApiError } from '@/services/comunica/client';
import { useActiveProfile } from '@/hooks/comunica/useActiveProfile';
import { useSessionDetail } from '@/hooks/comunica/useCalendar';
import {
  CALENDAR_TEXT as TXT,
  sessionState,
  STATE_LABEL,
  STATE_TONE,
  timeRange,
} from '@/utils/comunica/calendar';
import { longDay } from '@/utils/comunica/dates';
import { madridDay } from '@/utils/comunica/madrid';
import AreaScreen from '../comun/AreaScreen';
import { AreaSkeleton } from '../comun/AreaState';
import FactList from '../comun/record/FactList';
import StatusChip from '../comun/StatusChip';
import { useComunicaTheme } from '../comun/useComunicaTheme';

export default function SessionScreen({ id }: { id: string }) {
  const t = useComunicaTheme();
  const router = useRouter();
  const { active } = useActiveProfile();
  const q = useSessionDetail(active?.id, id);
  if (
    isComunicaApiError(q.error) &&
    ['forbidden', 'not_found'].includes(q.error.code)
  ) {
    return (
      <AreaScreen>
        <EmptyState
          icon="lock"
          title={TXT.unavailable}
          actionLabel="Volver"
          onAction={() => router.back()}
          accentColor={t.accentText}
          titleColor={t.text}
          subtitleColor={t.textSecondary}
        />
      </AreaScreen>
    );
  }
  if (!q.data) {
    return (
      <AreaScreen>
        <AreaSkeleton kind="cards" />
      </AreaScreen>
    );
  }
  const s = q.data.session;
  const state = sessionState(s, comunicaNow().getTime());
  const day = madridDay(new Date(s.startsAt));
  return (
    <AreaScreen>
      <Stack.Screen options={{ title: 'Sesión' }} />
      <View style={styles.hero}>
        <StatusChip
          label={STATE_LABEL[state]}
          tone={STATE_TONE[state] === 'info' ? 'info' : STATE_TONE[state]}
        />
        <Text
          accessibilityRole="header"
          style={[styles.name, { color: t.text }]}
        >
          {s.name}
        </Text>
        <Text style={[styles.when, { color: t.textSecondary }]}>
          {longDay(day)}
        </Text>
        <Text style={[styles.when, { color: t.textSecondary }]}>
          {timeRange(s)}
        </Text>
      </View>
      <FactList
        facts={[
          {
            icon: 'calendar',
            label: 'Evento',
            value: s.eventName,
            onPress: () =>
              router.push({
                pathname: '/comunica/actividades/[eventId]',
                params: { eventId: s.eventId },
              } as never),
            actionLabel: `Ver el evento: ${s.eventName}`,
          },
        ]}
      />
      {s.description ? (
        <Text selectable style={[styles.description, { color: t.text }]}>
          {s.description}
        </Text>
      ) : null}
    </AreaScreen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 6 },
  name: { ...typography.h1 },
  when: { ...typography.body },
  description: { ...typography.body, lineHeight: 24 },
});
