// «Sesión» (plan 16, C8), en hoja: el nombre, «sábado 25 de octubre»,
// «17:30 – 19:00», su estado en chip, el evento (toque → su ficha) y la
// descripción. Sin inscripción activa: «Esta sesión ya no está disponible».

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import EmptyState from '@/components/ui/EmptyState';
import typography from '@/constants/typography';
import { useProfileScope } from '@/hooks/comunica/useActiveProfile';
import { useOpenDestination } from '@/hooks/comunica/useOpenDestination';
import { useSessionDetail } from '@/hooks/comunica/useSessionDetail';
import { comunicaNow } from '@/services/comunica';
import { isComunicaApiError } from '@/services/comunica/client';
import {
  BUCKET_LABEL,
  isAllDaySession,
  sessionBucket,
  sessionTitle,
  timeRangeText,
} from '@/utils/comunica/calendar';
import { longDay } from '@/utils/comunica/dates';
import { madridDay } from '@/utils/comunica/madrid';
import AreaScreen from '../comun/AreaScreen';
import { AreaSkeleton } from '../comun/AreaState';
import NavRow from '../comun/NavRow';
import Section from '../comun/Section';
import StatusChip from '../comun/StatusChip';
import type { ChipTone } from '../comun/theme';
import { useComunicaTheme } from '../comun/useComunicaTheme';

export const SESSION_GONE = 'Esta sesión ya no está disponible';

const TONE: Record<string, ChipTone> = {
  upcoming: 'info',
  attended: 'positive',
  absent: 'negative',
  pending: 'neutral',
};

export default function SessionScreen({ id }: { id: string }) {
  const t = useComunicaTheme();
  const open = useOpenDestination();
  // Al cambiar de persona, la hoja vuelve (es de quien se veía).
  useProfileScope('personal', 'calendar');
  const q = useSessionDetail(id);
  const gone = isComunicaApiError(q.error) && q.error.code === 'forbidden';
  const s = gone ? undefined : q.session;

  return (
    <AreaScreen sunken={false}>
      <Stack.Screen options={{ title: 'Sesión' }} />
      {s ? (
        <View style={styles.stack}>
          <View style={styles.head}>
            <Text style={[styles.title, { color: t.text }]}>
              {sessionTitle(s.name)}
            </Text>
            <Text style={[styles.line, { color: t.textSecondary }]}>
              {longDay(madridDay(new Date(s.startsAt)), true)}
            </Text>
            <Text style={[styles.line, { color: t.textSecondary }]}>
              {isAllDaySession(s)
                ? 'Todo el día'
                : timeRangeText(s.startsAt, s.endsAt)}
            </Text>
            {(() => {
              const b = sessionBucket(s, comunicaNow());
              return <StatusChip label={BUCKET_LABEL[b]} tone={TONE[b]} />;
            })()}
          </View>
          {s.eventName ? (
            <Section title="Evento">
              <NavRow
                title={s.eventName}
                icon="calendar"
                onPress={() =>
                  open(
                    {
                      internalpage: 'single_stic_events',
                      action: 'detail',
                      id: s.eventId,
                    },
                    s.eventName,
                  )
                }
              />
            </Section>
          ) : null}
          {s.description ? (
            <Text style={[styles.body, { color: t.text }]}>
              {s.description}
            </Text>
          ) : null}
        </View>
      ) : q.isPending && !gone && !q.error ? (
        <AreaSkeleton />
      ) : (
        <EmptyState
          icon={gone ? 'lock' : 'error-outline'}
          title={gone ? SESSION_GONE : 'No se ha podido cargar'}
          actionLabel={gone ? undefined : 'Reintentar'}
          onAction={gone ? undefined : () => void q.refetch()}
          accentColor={t.accentText}
          titleColor={t.text}
        />
      )}
    </AreaScreen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 24 },
  head: { gap: 6 },
  title: { ...typography.h2 },
  line: { ...typography.body },
  body: { ...typography.body },
});
