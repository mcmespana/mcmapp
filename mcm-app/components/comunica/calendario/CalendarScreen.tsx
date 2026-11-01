// «Calendario» de familias (plan 16, C4-C7): Mes (la rejilla con puntitos,
// la leyenda debajo y la lista del día elegido) y Agenda (el mes por días).
// Se guarda en el móvil: sin conexión, lo guardado con su `SyncBadge`. En
// iPad y web anchos, mes y día en dos paneles (el patrón de la pestaña
// Calendario, copiado, no importado).

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import SwipeableMonthCalendar from '@/components/calendar/SwipeableMonthCalendar';
import EmptyState from '@/components/ui/EmptyState';
import { IconSymbol } from '@/components/ui/IconSymbol';
import SegmentedControl from '@/components/ui/SegmentedControl';
import typography from '@/constants/typography';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import {
  useActiveProfile,
  useProfileScope,
} from '@/hooks/comunica/useActiveProfile';
import { useCalendar } from '@/hooks/comunica/useCalendar';
import { useOpenDestination } from '@/hooks/comunica/useOpenDestination';
import { comunicaNow } from '@/services/comunica';
import type { CalendarData } from '@/services/comunica/contract';
import {
  addMonths,
  type CalendarItem,
  calendarItemsByDay,
  dayDots,
  dayForMonth,
  monthTitle,
} from '@/utils/comunica/calendar';
import { madridDay } from '@/utils/comunica/madrid';
import { isSectionVisible } from '@/utils/comunica/profiles';
import { h } from '@/utils/haptics';
import ActiveProfileBar from '../perfiles/ActiveProfileBar';
import AreaScreen from '../comun/AreaScreen';
import AreaState from '../comun/AreaState';
import SyncBadge from '../comun/SyncBadge';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import AgendaList from './AgendaList';
import { calendarFill } from './calendarColors';
import CalendarLegend from './CalendarLegend';
import DayList from './DayList';

type View_ = 'month' | 'agenda';

export default function CalendarScreen({
  initialView = 'month',
}: {
  initialView?: View_;
}) {
  const t = useComunicaTheme();
  const active = useActiveProfile();
  useProfileScope('shared', 'calendar');
  const q = useCalendar();
  const visible = isSectionVisible('calendar', active.audience);
  const [view, setView] = useState<View_>(initialView);

  return (
    <AreaScreen onRefresh={() => q.refetch()}>
      <Stack.Screen options={{ title: 'Calendario' }} />
      <ActiveProfileBar />
      {!visible ? (
        <EmptyState
          icon="event"
          title="Aquí no hay calendario"
          subtitle="Las actividades de quienes tienes a tu cargo están en su ficha."
          titleColor={t.text}
          subtitleColor={t.textSecondary}
        />
      ) : (
        <>
          <SegmentedControl
            options={[
              { value: 'month', label: 'Mes' },
              { value: 'agenda', label: 'Agenda' },
            ]}
            value={view}
            onChange={setView}
            accentColor={t.accentFill}
          />
          <AreaState query={q} skeleton="cards">
            {(data) => (
              <>
                <CalendarBody data={data} view={view} />
                <SyncBadge generatedAt={q.generatedAt} />
              </>
            )}
          </AreaState>
        </>
      )}
    </AreaScreen>
  );
}

function CalendarBody({ data, view }: { data: CalendarData; view: View_ }) {
  const t = useComunicaTheme();
  const router = useRouter();
  const open = useOpenDestination();
  const layout = useResponsiveLayout();
  const now = comunicaNow();
  const today = madridDay(now);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  // `now` cambia en cada pintada: el reparto, solo cuando cambian los datos.
  const byDay = useMemo(() => calendarItemsByDay(data, comunicaNow()), [data]);

  const changeMonth = (delta: number) => {
    const next = addMonths(month, delta);
    setMonth(next);
    setSelected(dayForMonth(next, today));
  };

  const markedDates = useMemo(() => {
    const out: Record<string, object> = {};
    for (const [day, items] of byDay) {
      if (!day.startsWith(`${month}-`)) continue;
      out[day] = {
        marked: true,
        dots: dayDots(items).map((b, i) => ({
          key: `${b}-${i}`,
          color: calendarFill(b, t.isDark),
        })),
      };
    }
    out[selected] = {
      ...(out[selected] ?? {}),
      selected: true,
      selectedColor: t.accentFill,
    };
    return out;
  }, [byDay, month, selected, t]);

  const onItem = (item: CalendarItem) => {
    if (item.kind === 'session') {
      router.push({
        pathname: '/comunica/calendario/sesion/[id]',
        params: { id: item.id },
      });
    } else if (item.kind === 'open') {
      // La FICHA del evento, no el formulario (C7, `stic-calendar.php` l. 621).
      open(
        {
          internalpage: 'single_stic_events',
          action: 'detail',
          id: item.eventId,
        },
        item.title,
      );
    } else {
      open({ internalpage: 'list_stic_registrations' }, 'Inscripciones');
    }
  };

  if (view === 'agenda') {
    return (
      <View style={styles.stack}>
        <MonthHeader month={month} onChange={changeMonth} />
        <AgendaList byDay={byDay} month={month} onPress={onItem} />
      </View>
    );
  }

  const grid = (
    <View style={styles.stack}>
      <SwipeableMonthCalendar
        visibleMonth={`${month}-01`}
        markedDates={markedDates}
        markingType="multi-dot"
        hideExtraDays
        accentColor={t.accentFill}
        onDayPress={(d) => {
          h.select();
          setSelected(d);
        }}
        onChangeMonth={changeMonth}
        isDark={t.isDark}
      />
      <CalendarLegend />
    </View>
  );
  const list = (
    <DayList
      day={selected}
      items={byDay.get(selected) ?? []}
      onPress={onItem}
    />
  );
  return layout.isWide ? (
    <View style={styles.panes}>
      <View style={styles.pane}>{grid}</View>
      <View style={styles.pane}>{list}</View>
    </View>
  ) : (
    <View style={styles.stack}>
      {grid}
      {list}
    </View>
  );
}

/** «‹ Octubre 2025 ›» de la Agenda. */
function MonthHeader({
  month,
  onChange,
}: {
  month: string;
  onChange: (delta: number) => void;
}) {
  const t = useComunicaTheme();
  const arrow = (delta: number) => (
    <PressableFeedback
      onPress={() => {
        h.select();
        onChange(delta);
      }}
      accessibilityRole="button"
      accessibilityLabel={delta < 0 ? 'Mes anterior' : 'Mes siguiente'}
      hitSlop={8}
      style={styles.arrow}
    >
      <IconSymbol
        name={delta < 0 ? 'chevron.left' : 'chevron.right'}
        size={20}
        color={t.accentText}
      />
    </PressableFeedback>
  );
  return (
    <View style={styles.monthHeader}>
      {arrow(-1)}
      <Text
        accessibilityRole="header"
        style={[styles.monthTitle, { color: t.text }]}
      >
        {monthTitle(month)}
      </Text>
      {arrow(1)}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
  panes: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
  pane: { flex: 1, gap: 16 },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthTitle: { ...typography.h3 },
  arrow: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
