// «Mis inscripciones» / «Inscripciones de Lucía» (plan 14, `sticpa_registrations_list_html`).
//
//   · Arriba la nota «Aquí están las actividades y eventos a los que te has apuntado…» con el enlace a Eventos.
//   · Lo abierto por fecha ascendente; luego lo cerrado, del más reciente al más antiguo (`registrationList.ts`). Apagada si pasó o es `danger`.
//   · «Otros eventos» (los de eventos ocultos): plegado y con su número; abierto si no hay nada más.
//   · Sin botón en la tarjeta: tocarla abre la ficha. Cambiar de hijo lleva a la lista del otro (una inscripción es personal, FAM-a8).

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import EmptyState from '@/components/ui/EmptyState';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii, shadows } from '@/constants/uiStyles';
import { comunicaNow } from '@/services/comunica';
import type { RegistrationCard } from '@/services/comunica/contract';
import { useActiveProfile } from '@/hooks/comunica/useActiveProfile';
import { useRegistrations } from '@/hooks/comunica/useRegistrations';
import {
  cardDay,
  isClosed,
  orderRegistrations,
  schoolLine,
  whenLine,
} from '@/utils/comunica/registrationList';
import { REGISTRATION_TEXT as TXT } from '@/utils/comunica/registrationNotes';
import { firstNameOf } from '@/utils/comunica/profiles';
import { madridDay } from '@/utils/comunica/madrid';
import { h } from '@/utils/haptics';
import ActiveProfileBar from '../perfiles/ActiveProfileBar';
import AreaScreen from '../comun/AreaScreen';
import AreaState from '../comun/AreaState';
import DateCapsule from '../comun/DateCapsule';
import StatusChip from '../comun/StatusChip';
import SyncBadge from '../comun/SyncBadge';
import { useComunicaTheme } from '../comun/useComunicaTheme';

export default function RegistrationsScreen() {
  const t = useComunicaTheme();
  const router = useRouter();
  const { active, isSelf } = useActiveProfile();
  const q = useRegistrations(active?.id);
  const today = madridDay(comunicaNow());
  const first = active ? firstNameOf(active) : '';
  const child = !isSelf && first ? first : null;
  const toEvents = () => router.push('/comunica/actividades' as never);
  const open = (c: RegistrationCard) =>
    router.push({
      pathname: '/comunica/inscripciones/[registrationId]',
      params: { registrationId: c.id },
    } as never);

  return (
    <AreaScreen onRefresh={() => q.refetch()}>
      <ActiveProfileBar scope="personal" section="registrations" />
      <AreaState query={q} skeleton="cards">
        {(data) => {
          const o = orderRegistrations(data.items, today);
          if (data.items.length === 0)
            return (
              <EmptyState
                icon="inbox"
                title={
                  child
                    ? TXT.emptyOf(child)
                    : !isSelf
                      ? 'Todavía no hay inscripciones'
                      : TXT.emptyOwn
                }
                subtitle={child ? TXT.emptyOfBody : TXT.emptyOwnBody}
                actionLabel={TXT.emptyAction}
                onAction={toEvents}
                accentColor={t.accentText}
                titleColor={t.text}
                subtitleColor={t.textSecondary}
              />
            );
          return (
            <View style={styles.list}>
              <Text style={[styles.intro, { color: t.textSecondary }]}>
                {TXT.intro}{' '}
                <Text
                  accessibilityRole="link"
                  onPress={toEvents}
                  style={[styles.link, { color: t.accentText }]}
                >
                  {TXT.introLink}
                </Text>
                .
              </Text>
              {[...o.open, ...o.closed].map((c) => (
                <Card
                  key={c.id}
                  card={c}
                  today={today}
                  child={child}
                  onOpen={() => open(c)}
                />
              ))}
              {o.others.length > 0 ? (
                <Others
                  cards={o.others}
                  today={today}
                  child={child}
                  defaultOpen={o.othersOpenByDefault}
                  onOpen={open}
                />
              ) : null}
              <View style={styles.sync}>
                <SyncBadge generatedAt={q.generatedAt} />
              </View>
            </View>
          );
        }}
      </AreaState>
    </AreaScreen>
  );
}

function Card({
  card,
  today,
  child,
  onOpen,
}: {
  card: RegistrationCard;
  today: string;
  child: string | null;
  onOpen: () => void;
}) {
  const t = useComunicaTheme();
  const dim = isClosed(card, today);
  const when = whenLine(card, child);
  const school = schoolLine(card);
  const day = cardDay(card);
  const label = [card.status.label, card.title, when, school]
    .filter(Boolean)
    .join(', ');
  return (
    <PressableFeedback
      onPress={() => {
        h.tap();
        onOpen();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Abre la inscripción"
      style={[
        styles.card,
        shadows.card,
        { backgroundColor: t.card, opacity: dim ? 0.7 : 1 },
      ]}
    >
      <View style={styles.main}>
        {card.status.label ? (
          <StatusChip
            label={card.status.label}
            tone={
              card.status.tone === 'ok'
                ? 'positive'
                : card.status.tone === 'warn'
                  ? 'warning'
                  : card.status.tone === 'danger'
                    ? 'negative'
                    : 'neutral'
            }
          />
        ) : null}
        <Text style={[styles.title, { color: t.text }]} numberOfLines={3}>
          {card.title}
        </Text>
        {when ? (
          <Text style={[styles.line, { color: t.textSecondary }]}>{when}</Text>
        ) : null}
        {school ? (
          <Text style={[styles.line, { color: t.textSecondary }]}>
            {school}
          </Text>
        ) : null}
      </View>
      {day ? <DateCapsule day={day} /> : null}
    </PressableFeedback>
  );
}

function Others({
  cards,
  today,
  child,
  defaultOpen,
  onOpen,
}: {
  cards: RegistrationCard[];
  today: string;
  child: string | null;
  defaultOpen: boolean;
  onOpen: (c: RegistrationCard) => void;
}) {
  const t = useComunicaTheme();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={styles.others}>
      <PressableFeedback
        onPress={() => {
          h.tap();
          setOpen((v) => !v);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${TXT.others}, ${cards.length}`}
        style={styles.othersHead}
      >
        <Text style={[styles.othersTitle, { color: t.textSecondary }]}>
          {`${TXT.others} (${cards.length})`}
        </Text>
        <IconSymbol
          name={open ? 'chevron.up' : 'chevron.down'}
          size={16}
          color={t.textSecondary}
        />
      </PressableFeedback>
      {open
        ? cards.map((c) => (
            <Card
              key={c.id}
              card={c}
              today={today}
              child={child}
              onOpen={() => onOpen(c)}
            />
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  intro: { ...typography.subhead },
  link: { fontWeight: '600', textDecorationLine: 'underline' },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: radii.lg,
  },
  main: { flex: 1, gap: 6 },
  title: { ...typography.title },
  line: { ...typography.subhead },
  others: { gap: 12 },
  othersHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  othersTitle: { ...typography.caption, textTransform: 'uppercase' },
  sync: { alignItems: 'center' },
});
