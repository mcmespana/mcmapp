// «Calendario» (plan 16, `single_stic_activities_calendar`): el mes con puntitos, las sesiones de tus eventos coloreadas por asistencia, las bandas de los eventos con
// plaza y de los abiertos a inscripción, la lista del día y la agenda.
//
//   · Mes / Agenda. En el mes: la rejilla de la pestaña Calendario (`SwipeableMonthCalendar`: el mes se desliza con el dedo y con las flechas), desde el lunes, sin días de
//     otros meses; hasta 4 puntitos; tocar un día pinta «Martes, 14 de octubre» y una fila por actividad. Al cambiar de mes se elige hoy si cae dentro, si no el día 1.
//     En iPad y web anchos, mes y lista del día en dos paneles. Leyenda bajo la rejilla.
//   · Destinos: una sesión → su hoja; un evento abierto → su ficha (plan 13); uno con plaza → «Inscripciones».
//   · Se guarda en el móvil (actividades, fechas y marcas) y se borra al salir; sin conexión, lo guardado con `SyncBadge`.

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import SwipeableMonthCalendar from '@/components/calendar/SwipeableMonthCalendar';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { PressableFeedback } from 'heroui-native';
import EmptyState from '@/components/ui/EmptyState';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { comunicaNow } from '@/services/comunica';
import { useActiveProfile } from '@/hooks/comunica/useActiveProfile';
import { useCalendar } from '@/hooks/comunica/useCalendar';
import {
  agendaOfMonth,
  CALENDAR_TEXT as TXT,
  dayItems,
  dayLabel,
  dayOnMonthChange,
  dotsOf,
  monthWeeks,
  monthTitle,
  shiftMonth,
  type DayItem,
} from '@/utils/comunica/calendar';
import { madridDay } from '@/utils/comunica/madrid';
import { h } from '@/utils/haptics';
import ActiveProfileBar from '../perfiles/ActiveProfileBar';
import AreaScreen from '../comun/AreaScreen';
import AreaState, { isNetwork } from '../comun/AreaState';
import SyncBadge from '../comun/SyncBadge';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import { AgendaList, DayList, Legend, useToneColor } from './CalendarParts';

type View_ = 'month' | 'agenda';

export default function CalendarScreen({
  initialView = 'month',
}: {
  initialView?: View_;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const { active } = useActiveProfile();
  const q = useCalendar(active?.id);
  const layout = useResponsiveLayout();
  const toneColor = useToneColor();
  const now = comunicaNow();
  const today = madridDay(now);
  const [view, setView] = useState<View_>(initialView);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);

  const items = useMemo(
    () =>
      q.data ? dayItems(q.data, now.getTime()) : new Map<string, DayItem[]>(),
    // `now` cambia a cada pintado; basta con los datos y el día.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q.data, today],
  );

  // Un día = una marca con sus puntitos y su frase para el lector de pantalla («14 de octubre, 2 actividades»).
  const markedDates = useMemo(() => {
    const out: Record<string, object> = {};
    for (const day of monthWeeks(month).flat()) {
      if (!day) continue;
      const list = items.get(day) ?? [];
      out[day] = {
        marked: list.length > 0,
        dots: dotsOf(list).map((tone, i) => ({
          key: `${tone}-${i}`,
          color: toneColor(tone),
        })),
        accessibilityLabel: dayLabel(day, list.length),
        ...(day === selected
          ? { selected: true, selectedColor: t.accentFill }
          : {}),
      };
    }
    return out;
  }, [items, month, selected, t.accentFill, toneColor]);

  const goMonth = (delta: number) => {
    h.select();
    const next = shiftMonth(month, delta);
    setMonth(next);
    setSelected(dayOnMonthChange(next, today));
  };
  const monthBar = (
    <View style={styles.monthBar}>
      <PressableFeedback
        onPress={() => goMonth(-1)}
        accessibilityRole="button"
        accessibilityLabel="Mes anterior"
        style={styles.nav}
      >
        <Text style={[styles.navLabel, { color: t.accentText }]}>‹</Text>
      </PressableFeedback>
      <Text
        accessibilityRole="header"
        style={[styles.monthTitle, { color: t.text }]}
      >
        {monthTitle(month)}
      </Text>
      <PressableFeedback
        onPress={() => goMonth(1)}
        accessibilityRole="button"
        accessibilityLabel="Mes siguiente"
        style={styles.nav}
      >
        <Text style={[styles.navLabel, { color: t.accentText }]}>›</Text>
      </PressableFeedback>
    </View>
  );
  const open = (i: DayItem) => {
    if (i.kind === 'session')
      router.push({
        pathname: '/comunica/calendario/sesion/[id]',
        params: { id: i.id },
      } as never);
    else if (i.kind === 'open')
      router.push({
        pathname: '/comunica/actividades/[eventId]',
        params: { eventId: i.eventId },
      } as never);
    else router.push('/comunica/inscripciones' as never);
  };

  return (
    <AreaScreen onRefresh={() => q.refetch()}>
      <Stack.Screen options={{ title: TXT.title }} />
      <ActiveProfileBar scope="shared" section="calendar" />
      <View
        accessibilityRole="tablist"
        style={[styles.segment, { backgroundColor: t.backgroundSunken }]}
      >
        {(['month', 'agenda'] as const).map((v) => (
          <PressableFeedback
            key={v}
            onPress={() => {
              h.select();
              setView(v);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: view === v }}
            accessibilityLabel={v === 'month' ? TXT.month : TXT.agenda}
            style={[styles.tab, view === v && { backgroundColor: t.card }]}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: view === v ? t.text : t.textSecondary },
              ]}
            >
              {v === 'month' ? TXT.month : TXT.agenda}
            </Text>
          </PressableFeedback>
        ))}
      </View>
      {q.error && !q.data && isNetwork(q.error) ? (
        <EmptyState
          icon="wifi-off"
          title="Necesitas conexión la primera vez"
          subtitle="Cuando se haya cargado una vez, podrás verlo sin cobertura."
          actionLabel="Reintentar"
          onAction={() => void q.refetch()}
          accentColor={t.accentText}
          titleColor={t.text}
          subtitleColor={t.textSecondary}
        />
      ) : (
        <AreaState query={q} skeleton="cards">
          {() => (
            <View style={styles.body}>
              {view === 'month' ? (
                <View style={layout.isWide ? styles.panes : styles.body}>
                  <View style={layout.isWide ? styles.pane : styles.body}>
                    <SwipeableMonthCalendar
                      visibleMonth={`${month}-01`}
                      markedDates={markedDates}
                      markingType="multi-dot"
                      hideExtraDays
                      accentColor={t.accentFill}
                      onDayPress={(day) => {
                        h.select();
                        setSelected(day);
                      }}
                      onChangeMonth={goMonth}
                      isDark={t.isDark}
                    />
                    <Legend />
                  </View>
                  <View style={layout.isWide ? styles.pane : undefined}>
                    <DayList
                      day={selected}
                      items={items.get(selected) ?? []}
                      empty={TXT.nothingToday}
                      onOpen={open}
                    />
                  </View>
                </View>
              ) : (
                <>
                  {monthBar}
                  <AgendaList
                    days={agendaOfMonth(items, month)}
                    empty={TXT.nothingMonth}
                    onOpen={open}
                  />
                </>
              )}
              <View style={styles.sync}>
                <SyncBadge generatedAt={q.generatedAt} />
              </View>
            </View>
          )}
        </AreaState>
      )}
    </AreaScreen>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', borderRadius: radii.md, padding: 3 },
  tab: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  tabLabel: { ...typography.button },
  body: { gap: 16 },
  panes: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
  pane: { flex: 1, gap: 16 },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthTitle: { ...typography.h3 },
  nav: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: { ...typography.h1 },
  sync: { alignItems: 'center' },
});
