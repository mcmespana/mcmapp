// Las piezas de «elegir evento» (plan 07), que comparten la pantalla de
// eventos y la portada de Pasar Lista:
//
//   · `TodayEventCard`: el evento de HOY. Entera es el enlace (sin botón que
//     repita lo que hace tocarla). Superficie neutra, NO destacada: en la
//     portada convive con la tarjeta del sábado, y dos bloques de acento
//     seguidos no se leen (`sticpa_pl_ev_hoy_card_html`).
//   · `EventListRow`: un próximo o un pasado, con su cápsula de fecha.
//   · `EventsEntryRow`: la fila «Pasar lista en un evento · N este curso».

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import type { EventSummary } from '@/services/comunica/contract';
import { h } from '@/utils/haptics';
import {
  eventDates,
  todayLabel,
  type ClassifiedEvent,
} from '@/utils/comunica/events';
import DateCapsule from '../comun/DateCapsule';
import NavRow from '../comun/NavRow';
import RecordCard from '../comun/RecordCard';
import { useComunicaTheme } from '../comun/useComunicaTheme';

export function useOpenEvent() {
  const router = useRouter();
  return (eventId: string) =>
    router.push({
      pathname: '/comunica/eventos/[eventId]',
      params: { eventId },
    });
}

export function TodayEventCard({
  item,
  today,
}: {
  item: ClassifiedEvent;
  today: string;
}) {
  const open = useOpenEvent();
  const when = todayLabel(item);
  const dates = eventDates(item.event);
  return (
    <RecordCard
      kicker={{ label: when, tone: 'accent' }}
      title={item.event.name}
      lines={[
        item.event.startDate === item.event.endDate
          ? 'Pasar lista'
          : `${dates} · Pasar lista`,
      ]}
      day={today}
      onPress={() => open(item.event.id)}
      accessibilityLabel={`${when}: ${item.event.name}, ${dates}. Pasar lista`}
    />
  );
}

export function EventListRow({
  event,
  muted,
}: {
  event: EventSummary;
  /** Los ya pasados: el nombre en gris. */
  muted?: boolean;
}) {
  const t = useComunicaTheme();
  const open = useOpenEvent();
  const dates = eventDates(event);
  return (
    <PressableFeedback
      onPress={() => {
        h.tap();
        open(event.id);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${event.name}, ${dates}`}
      style={styles.row}
    >
      <PressableFeedback.Highlight />
      <DateCapsule day={event.startDate} />
      <View style={styles.body}>
        <Text
          style={[styles.title, { color: muted ? t.textSecondary : t.text }]}
          numberOfLines={2}
        >
          {event.name}
        </Text>
        <Text style={[styles.sub, { color: t.textSecondary }]}>{dates}</Text>
      </View>
      <IconSymbol name="chevron.right" size={16} color={t.textMuted} />
    </PressableFeedback>
  );
}

export function EventsEntryRow({ count }: { count: number }) {
  const router = useRouter();
  return (
    <NavRow
      icon="bus"
      title="Pasar lista en un evento"
      trailing={`${count} este curso`}
      onPress={() => router.push('/comunica/eventos')}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  body: { flex: 1, gap: 2 },
  title: { ...typography.body, fontWeight: '600' },
  sub: { ...typography.caption },
});
