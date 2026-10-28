// La pantalla de UN evento (plan 07; `single_stic_pasar_lista_evento.php` con
// `evento`). Lee la lista entera de una vez (lo que se usa sin cobertura) y
// enseña, según `view`:
//
//   · `list` (por defecto): la lista del autobús, para marcar
//     (`EventRollList`); con `by`, partida por los grupos de esa pestaña.
//   · la clave de una pestaña: sus grupos, de solo lectura (`ActivityTabView`).
//
// Qué día se marca: el que se pide (`session`) o la regla del plan 04 (hoy,
// si no la última que pasó, si no la próxima). Sin días en el CRM, el de hoy
// —si cae dentro de sus fechas— y el servidor crea la sesión al guardar.

import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import EmptyState from '@/components/ui/EmptyState';
import SegmentedControl from '@/components/ui/SegmentedControl';
import typography from '@/constants/typography';
import { themeColors } from '@/constants/colors';
import { comunicaNow } from '@/services/comunica';
import { isComunicaApiError } from '@/services/comunica/client';
import type { ActivityTab, EventRoll } from '@/services/comunica/contract';
import { useEventRoll } from '@/hooks/comunica/events';
import { useFlushOutboxOnMount } from '@/hooks/comunica/useOutbox';
import { useColorScheme } from '@/hooks/useColorScheme';
import { sortTabs, tabLabel } from '@/utils/comunica/activityGroups';
import { shortDay } from '@/utils/comunica/dates';
import { eventDates } from '@/utils/comunica/events';
import { pickEventDay } from '@/utils/comunica/eventRoll';
import type { SessionOption } from '@/utils/comunica/sessions';
import AreaScreen from '../comun/AreaScreen';
import AreaState from '../comun/AreaState';
import FilterChips from '../comun/FilterChips';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import SessionPicker from '../pasar-lista/SessionPicker';
import ActivityTabView from './ActivityTabView';
import EventRollList from './EventRollList';

/** Con más pestañas que esto, fila de chips en vez de segmentado. */
const MAX_SEGMENTS = 3;

export const FORBIDDEN_EVENT =
  'Este evento no está entre los de tu delegación de este curso.';

export default function EventScreen({
  eventId,
  view,
  by,
  group,
  session,
}: {
  eventId: string;
  view?: string;
  by?: string;
  group?: string;
  session?: string;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const q = useEventRoll(eventId);
  const isDark = useColorScheme() === 'dark';
  const tint = Platform.OS === 'ios' ? themeColors(isDark).headerTint : '#fff';
  useFlushOutboxOnMount();

  const roll = q.data;
  const now = comunicaNow();
  const pick = useMemo(
    () => (roll ? pickEventDay(roll, session, now) : null),
    // Por día basta: la regla no cambia a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roll, session],
  );
  const tabs = useMemo(
    () => (roll ? sortTabs(roll.activity.tabs) : []),
    [roll],
  );
  const activeTab = view && view !== 'list' ? view : null;
  const tab = activeTab ? tabs.find((x) => x.key === activeTab) : undefined;

  const options: SessionOption[] = useMemo(() => {
    if (!roll) return [];
    const sorted = [...roll.sessions].sort((a, b) =>
      a.startsAt < b.startsAt ? -1 : 1,
    );
    return sorted
      .map((s, i) => ({
        session: s,
        number: i + 1,
        label: shortDay(s.date),
        state:
          Object.keys(roll.marksBySession[s.id] ?? {}).length > 0
            ? ('taken' as const)
            : ('missing' as const),
        roll: null,
      }))
      .reverse();
  }, [roll]);
  const current = options.find((o) => o.session.id === pick?.session?.id);

  const forbidden =
    !roll && isComunicaApiError(q.error) && q.error.code === 'forbidden';

  return (
    <>
      <Stack.Screen
        options={{
          title: roll?.event.name ?? 'Evento',
          headerLargeTitle: false,
          headerRight:
            !tab && current
              ? () => (
                  <SessionPicker
                    options={options}
                    current={current}
                    tint={tint}
                    onPick={(sid) => router.setParams({ session: sid })}
                  />
                )
              : undefined,
        }}
      />
      {!roll || !pick ? (
        <AreaScreen onRefresh={() => q.refetch()}>
          {forbidden ? (
            <EmptyState
              icon="lock"
              title={FORBIDDEN_EVENT}
              actionLabel="Ver los eventos"
              onAction={() => router.replace('/comunica/eventos')}
              accentColor={t.accentText}
              titleColor={t.text}
            />
          ) : (
            <AreaState query={q} skeleton="list">
              {() => null}
            </AreaState>
          )}
        </AreaScreen>
      ) : tab ? (
        <ActivityTabView
          roll={roll}
          tab={tab}
          head={
            <EventHead
              roll={roll}
              tabs={tabs}
              value={tab.key}
              stale={!!q.error}
            />
          }
          onRefresh={() => q.refetch()}
        />
      ) : (
        <EventRollList
          key={`${pick.session?.id ?? `new-${pick.day}`}:${by ?? ''}`}
          roll={roll}
          pick={pick}
          by={by && tabs.some((x) => x.key === by) ? by : undefined}
          group={group}
          head={
            <EventHead roll={roll} tabs={tabs} value="list" stale={!!q.error} />
          }
          onRefresh={() => q.refetch()}
        />
      )}
    </>
  );
}

/**
 * Lo de arriba del todo, igual en la lista y en las pestañas: fechas y
 * cuántos, y las pestañas («Lista», «Patrullas 4», «Habitaciones 3»).
 */
function EventHead({
  roll,
  tabs,
  value,
  stale,
}: {
  roll: EventRoll;
  tabs: readonly ActivityTab[];
  value: string;
  /** La última lectura falló: lo que se ve es lo guardado en el móvil. */
  stale: boolean;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const people = roll.people.length;
  const options = [
    { value: 'list', label: 'Lista', count: people },
    ...tabs.map((x) => ({
      value: x.key,
      label: tabLabel(x),
      count: x.groupCount,
    })),
  ];
  const go = (v: string) => router.setParams({ view: v, by: '', group: '' });
  return (
    <View style={styles.head}>
      <Text style={[styles.meta, { color: t.textSecondary }]}>
        {eventDates(roll.event)} ·{' '}
        {people === 1 ? '1 persona' : `${people} personas`}
        {stale ? ' · guardado en el móvil' : ''}
      </Text>
      {tabs.length === 0 ? null : options.length <= MAX_SEGMENTS ? (
        <SegmentedControl
          options={options.map((o) => ({ value: o.value, label: o.label }))}
          value={value}
          onChange={go}
          accentColor={t.accentFill}
          accessibilityLabel="Vistas del evento"
        />
      ) : (
        <View style={styles.tabsRow}>
          <FilterChips
            chips={options.map((o) => ({
              key: o.value,
              label: o.label,
              count: o.count,
            }))}
            value={value}
            onChange={go}
            label="Vistas del evento"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { gap: 12, paddingHorizontal: 16, paddingTop: 16 },
  meta: { ...typography.subhead },
  tabsRow: { marginHorizontal: -16 },
});
