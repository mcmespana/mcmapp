// La tarjeta de un evento en «Eventos» (plan 13, `sticpa_events_cards`): cápsula con el inicio (apagada si es de otro día pasado, nunca aquí),
// nombre, fechas en palabras, lugar y plazo, un chip y, al pie, UNA acción compacta si lleva a otro sitio. Tocar la tarjeta abre la ficha.
// La acción es un botón pequeño con el acento, no el principal a lo ancho: con cinco tarjetas serían cinco degradados (FAM-a13).

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import typography from '@/constants/typography';
import { radii, shadows } from '@/constants/uiStyles';
import type { EventCard as EventCardData } from '@/services/comunica/contract';
import {
  cardAction,
  cardChip,
  cardPlazo,
  type CardAction,
} from '@/utils/comunica/activityList';
import { dateRangeText } from '@/utils/comunica/recordDates';
import { h } from '@/utils/haptics';
import DateCapsule from '../comun/DateCapsule';
import StatusChip from '../comun/StatusChip';
import { useComunicaTheme } from '../comun/useComunicaTheme';

export default function EventCard({
  event,
  today,
  onOpen,
  onAction,
}: {
  event: EventCardData;
  today: string;
  onOpen: () => void;
  onAction: (action: CardAction) => void;
}) {
  const t = useComunicaTheme();
  const chip = cardChip(event, today);
  const plazo = cardPlazo(event, today);
  const action = cardAction(event, today);
  const dates = dateRangeText(event.startDate, event.endDate);
  const lines = [dates, event.place, plazo].filter(Boolean) as string[];
  const label = [chip?.label, event.name, ...lines].filter(Boolean).join(', ');
  return (
    <PressableFeedback
      onPress={() => {
        h.tap();
        onOpen();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Abre la actividad"
      style={[styles.card, shadows.card, { backgroundColor: t.card }]}
    >
      <View style={styles.top}>
        <View style={styles.main}>
          {chip ? <StatusChip label={chip.label} tone={chip.tone} /> : null}
          <Text style={[styles.title, { color: t.text }]} numberOfLines={3}>
            {event.name}
          </Text>
          {lines.map((l) => (
            <Text
              key={l}
              style={[styles.line, { color: t.textSecondary }]}
              numberOfLines={2}
            >
              {l}
            </Text>
          ))}
        </View>
        {event.startDate ? <DateCapsule day={event.startDate} /> : null}
      </View>
      {action ? (
        <PressableFeedback
          onPress={() => {
            h.tap();
            onAction(action);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${action.label}: ${event.name}`}
          style={[styles.action, { backgroundColor: t.accentFill }]}
        >
          <Text style={[styles.actionLabel, { color: t.onAccent }]}>
            {action.label}
          </Text>
        </PressableFeedback>
      ) : null}
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.lg, padding: 16, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  main: { flex: 1, gap: 6 },
  title: { ...typography.title },
  line: { ...typography.subhead },
  action: {
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { ...typography.button },
});
