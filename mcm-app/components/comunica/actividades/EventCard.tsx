// La tarjeta de un evento en «Eventos» (plan 13; `sticpa_events_cards`):
// chip, nombre, fecha, lugar y plazo, con la cápsula del inicio. Tocarla abre
// la ficha (sin «Ver detalle», FAM-a7). Al pie, SOLO si lleva a otro sitio,
// un botón compacto con el acento del área: «Mi inscripción» o «Inscribirme».
// No es el principal a lo ancho: con cinco tarjetas serían cinco (FAM-a13).

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { radii, shadows } from '@/constants/uiStyles';
import typography from '@/constants/typography';
import type { EventCard as EventCardData } from '@/services/comunica/contract';
import { cardAction, cardLines, eventChip } from '@/utils/comunica/eventWindow';
import { h } from '@/utils/haptics';
import DateCapsule from '../comun/DateCapsule';
import StatusChip from '../comun/StatusChip';
import { useComunicaTheme } from '../comun/useComunicaTheme';

interface Props {
  event: EventCardData;
  today: string;
  onOpen: () => void;
  onMyRegistration: () => void;
  onSignUp: () => void;
  /** Sin conexión no se apunta nadie: el botón, apagado y diciendo por qué. */
  offline?: boolean;
}

export default function EventCard({
  event,
  today,
  onOpen,
  onMyRegistration,
  onSignUp,
  offline = false,
}: Props) {
  const t = useComunicaTheme();
  const chip = eventChip(event, today);
  const lines = cardLines(event, today);
  const action = cardAction(event, today);
  const signUpOff = action === 'signUp' && offline;
  return (
    <View style={[styles.card, shadows.card, { backgroundColor: t.card }]}>
      <PressableFeedback
        onPress={() => {
          h.tap();
          onOpen();
        }}
        accessibilityRole="button"
        accessibilityLabel={[chip?.label, event.name, ...lines]
          .filter(Boolean)
          .join(', ')}
        accessibilityHint="Abre la ficha de la actividad"
        style={styles.top}
      >
        <View style={styles.main}>
          {chip ? <StatusChip label={chip.label} tone={chip.tone} /> : null}
          <Text style={[styles.title, { color: t.text }]} numberOfLines={2}>
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
        <PressableFeedback.Highlight />
      </PressableFeedback>
      {action ? (
        <View style={styles.footer}>
          <PressableFeedback
            onPress={() => {
              h.tap();
              if (action === 'myRegistration') onMyRegistration();
              else onSignUp();
            }}
            isDisabled={signUpOff}
            accessibilityRole="button"
            accessibilityState={{ disabled: signUpOff }}
            style={[
              styles.action,
              { borderColor: signUpOff ? t.separator : t.accentText },
            ]}
          >
            <Text
              style={[
                styles.actionLabel,
                { color: signUpOff ? t.textSecondary : t.accentText },
              ]}
            >
              {action === 'myRegistration' ? 'Mi inscripción' : 'Inscribirme'}
            </Text>
            <IconSymbol
              name="chevron.right"
              size={14}
              color={signUpOff ? t.textSecondary : t.accentText}
            />
          </PressableFeedback>
          {signUpOff ? (
            <Text style={[styles.offline, { color: t.textSecondary }]}>
              Necesitas conexión para apuntarte
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.lg, overflow: 'hidden' },
  top: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    padding: 16,
  },
  main: { flex: 1, gap: 4 },
  title: { ...typography.title },
  line: { ...typography.subhead },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 40,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderRadius: radii.md,
  },
  actionLabel: { ...typography.button },
  offline: { ...typography.caption, flexShrink: 1 },
});
