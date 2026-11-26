// El check-in de un evento que gestionas (plan 18): quién ha LLEGADO. Es el
// check-in de Comunica Tools y se guarda en el mismo sitio; nada va al CRM ni
// es la asistencia por días de «Pasar lista en un evento» (plan 07).
//
//   · Arriba, la cifra grande («87 / 120 han llegado»), su barra y lo que
//     falta. Debajo, el buscador (sin tildes y por trozos) y cómo agrupar:
//     nombre, delegación, curso, papel o habitación (si el evento tiene).
//   · Chips pegados: Todos / Faltan / Están / No vienen / Con nota.
//   · Cada persona con «Llega» grande y su deshacer; tocarla abre la ficha y
//     mantenerla pulsada empieza a seleccionar varios (abajo, «Llegan» y «No
//     vienen» para todos los elegidos).
//   · SIN COBERTURA: lo marcado se ve al momento y se queda en la cola con su
//     hora; sube solo. Con la pantalla a la vista y la app delante, se pregunta
//     cada pocos segundos lo que han marcado otros (aquí o en Comunica Tools).
//
// Una sola `FlatList` (ciento y pico filas), con los chips como cabecera
// pegada, como la lista del autobús.

import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Stack, useRouter } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import { PressableFeedback } from 'heroui-native';
import EmptyState from '@/components/ui/EmptyState';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useTabListScroll } from '@/components/tabs/useTabScroll';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { isComunicaApiError } from '@/services/comunica/client';
import type { ManagedEventDetail } from '@/services/comunica/contract';
import {
  useCheckin,
  useCheckinPolling,
  useManagedEvent,
} from '@/hooks/comunica/managedEvents';
import { useFlushOutboxOnMount } from '@/hooks/comunica/useOutbox';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import useNetworkStatus from '@/hooks/useNetworkStatus';
import { h } from '@/utils/haptics';
import {
  arrivedHeadline,
  checkinRows,
  checkinSections,
  checkinStats,
  filterChips,
  GROUP_BY_LABEL,
  groupBysFor,
  pendingIn,
  restLine,
  type CheckinFilter,
  type CheckinGroupBy,
  type CheckinRowModel,
  type CheckinSection,
} from '@/utils/comunica/checkin';
import { eventDates } from '@/utils/comunica/events';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';
import AreaScreen from '../comun/AreaScreen';
import AreaState from '../comun/AreaState';
import BottomActionBar, {
  BOTTOM_ACTION_BAR_SPACE,
} from '../comun/BottomActionBar';
import FilterChips from '../comun/FilterChips';
import ListCell, { cellPosition, type CellPosition } from '../comun/ListCell';
import SearchField from '../comun/SearchField';
import SyncBadge from '../comun/SyncBadge';
import { MARK_FILL } from '../comun/theme';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import { useHeaderGlyph } from '../comun/useHeaderGlyph';
import { Notice } from '../pasar-lista/RollBits';
import CheckinRow from './CheckinRow';

type Item =
  | { kind: 'head'; key: string }
  | { kind: 'tools'; key: string }
  | { kind: 'groupBy'; key: string }
  | { kind: 'chips'; key: string }
  | { kind: 'section'; key: string; section: CheckinSection }
  | { kind: 'row'; key: string; row: CheckinRowModel; position: CellPosition }
  | { kind: 'empty'; key: string; text: string; search: boolean }
  | { kind: 'foot'; key: string };

export const FORBIDDEN_MANAGED =
  'No gestionas este evento (o ya no eres su gestor/a).';

export default function CheckinScreen({ eventId }: { eventId: string }) {
  const t = useComunicaTheme();
  const router = useRouter();
  const q = useManagedEvent(eventId);
  useFlushOutboxOnMount();
  const focused = useIsFocused();
  useCheckinPolling(eventId, focused);
  const detail = q.data;
  const forbidden =
    !detail && isComunicaApiError(q.error) && q.error.code === 'forbidden';

  if (!detail) {
    return (
      <>
        <Stack.Screen
          options={{ title: 'Check-in', headerLargeTitle: false }}
        />
        <AreaScreen onRefresh={() => q.refetch()}>
          {forbidden ? (
            <EmptyState
              icon="lock"
              title={FORBIDDEN_MANAGED}
              actionLabel="Ver tus eventos"
              onAction={() => router.replace('/comunica/gestion')}
              accentColor={t.accentText}
              titleColor={t.text}
            />
          ) : (
            <AreaState query={q} skeleton="list">
              {() => null}
            </AreaState>
          )}
        </AreaScreen>
      </>
    );
  }
  return (
    <CheckinList
      detail={detail}
      stale={!!q.error}
      onRefresh={() => q.refetch()}
    />
  );
}

function CheckinList({
  detail,
  stale,
  onRefresh,
}: {
  detail: ManagedEventDetail;
  /** La última lectura falló: lo que se ve es lo guardado en el móvil. */
  stale: boolean;
  onRefresh: () => Promise<unknown>;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const glyph = useHeaderGlyph();
  const online = useNetworkStatus();
  const eventId = detail.event.id;
  const { effective, unsent, rejected, mark, discardRejected } = useCheckin(
    eventId,
    detail,
  );
  const tabClearance = useTabBarClearance();
  const [barHeight, setBarHeight] = useState<number | null>(null);
  const [filter, setFilter] = useState<CheckinFilter>('all');
  const [groupBy, setGroupBy] = useState<CheckinGroupBy>('name');
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<Set<string> | null>(null);
  const selecting = selection !== null;
  const { listRef, onScroll, contentPaddingBottom } = useTabListScroll<
    Animated.FlatList<Item>
  >(
    'comunica',
    selecting
      ? Math.max(BOTTOM_ACTION_BAR_SPACE, (barHeight ?? 0) - tabClearance)
      : 0,
  );

  const stats = useMemo(
    () => checkinStats(detail.registrations, effective),
    [detail.registrations, effective],
  );
  const rows = useMemo(
    () => checkinRows(detail, effective),
    [detail, effective],
  );
  const chips = useMemo(() => filterChips(rows), [rows]);
  const groupBys = groupBysFor(detail.rooms);
  const sections = useMemo(
    () =>
      checkinSections(rows, {
        filter,
        query,
        groupBy,
        event: detail.event,
        rooms: detail.rooms,
      }),
    [rows, filter, query, groupBy, detail.event, detail.rooms],
  );
  const visiblePending = useMemo(() => pendingIn(sections), [sections]);
  const headline = arrivedHeadline(stats);
  const rest = restLine(stats);

  // ── Marcar ──
  const onArrive = useCallback((id: string) => void mark([id], 'in'), [mark]);
  const onUndo = useCallback(
    (id: string) => void mark([id], 'pending'),
    [mark],
  );
  const onOpen = useCallback(
    (id: string) => {
      const reg = detail.registrations.find((r) => r.registrationId === id);
      if (!reg) return;
      router.push({
        pathname: '/comunica/gestion/[eventId]/persona/[personId]',
        params: { eventId, personId: reg.personId },
      });
    },
    [detail.registrations, eventId, router],
  );
  const onSelect = useCallback((id: string) => {
    setSelection((s) => {
      const next = new Set(s ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const onStartSelect = useCallback((id: string) => {
    setSelection(new Set([id]));
  }, []);
  const applySelection = async (to: 'in' | 'absent') => {
    if (!selection || selection.size === 0) return;
    const ok = await mark([...selection], to);
    if (ok) {
      h.formSuccess();
      setSelection(null);
    }
  };

  const pickFilter = (k: CheckinFilter) => {
    setFilter((cur) => (cur === k && k !== 'all' ? 'all' : k));
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  // ── La lista, aplanada ──
  const data = useMemo((): Item[] => {
    const items: Item[] = [
      { kind: 'head', key: 'head' },
      { kind: 'tools', key: 'tools' },
    ];
    if (groupBys.length > 1) items.push({ kind: 'groupBy', key: 'groupBy' });
    items.push({ kind: 'chips', key: 'chips' });
    if (detail.registrations.length === 0) {
      items.push({
        kind: 'empty',
        key: 'empty',
        text: 'Todavía no hay nadie inscrito en este evento.',
        search: false,
      });
    } else if (sections.length === 0) {
      items.push({
        kind: 'empty',
        key: 'empty-q',
        text: query
          ? 'Nadie coincide con lo que buscas.'
          : filter === 'pending'
            ? 'Ya no falta nadie.'
            : 'Aquí no hay nadie.',
        search: !!query,
      });
    }
    for (const s of sections) {
      items.push({ kind: 'section', key: `s:${s.key}`, section: s });
      s.rows.forEach((r, i) =>
        items.push({
          kind: 'row',
          key: `r:${r.id}`,
          row: r,
          position: cellPosition(i, s.rows.length),
        }),
      );
    }
    items.push({ kind: 'foot', key: 'foot' });
    return items;
  }, [sections, detail.registrations.length, query, filter, groupBys.length]);
  const stickyIndex = data.findIndex((i) => i.kind === 'chips');

  const renderItem = ({ item }: { item: Item }) => {
    switch (item.kind) {
      case 'head':
        return (
          <View style={styles.block}>
            <Text style={[styles.meta, { color: t.textSecondary }]}>
              {eventDates(detail.event)} · {detail.event.delegation.name}
              {stale ? ' · guardado en el móvil' : ''}
            </Text>
            <View
              style={styles.figureBlock}
              accessible
              accessibilityRole="summary"
              accessibilityLiveRegion="polite"
              accessibilityLabel={`${stats.arrived} de ${stats.total} ${headline.text}${rest ? `. ${rest}` : ''}`}
            >
              <Text style={[styles.figure, { color: t.text }]}>
                {headline.figure}{' '}
                <Text style={[styles.figureText, { color: t.textSecondary }]}>
                  {headline.text}
                </Text>
              </Text>
              <View style={[styles.track, { backgroundColor: t.disabledFill }]}>
                <View
                  style={[
                    styles.fill,
                    {
                      backgroundColor: MARK_FILL.yes,
                      width: `${Math.round(headline.ratio * 100)}%`,
                    },
                  ]}
                />
              </View>
              {rest ? (
                <Text style={[styles.meta, { color: t.textSecondary }]}>
                  {rest}
                </Text>
              ) : null}
            </View>
            {online === false ? (
              <Notice
                icon="exclamationmark.triangle.fill"
                text="Sin cobertura. Puedes marcar: se guarda en el móvil y se sube solo."
              />
            ) : null}
            {unsent > 0 ? (
              <Notice
                icon="clock"
                tone={online === false ? 'warning' : 'info'}
                text={
                  unsent === 1
                    ? '1 cambio sin subir todavía: se envía solo.'
                    : `${unsent} cambios sin subir todavía: se envían solos.`
                }
              />
            ) : null}
            {rejected.length > 0 ? (
              <View style={styles.rejected}>
                <Notice
                  icon="exclamationmark.triangle.fill"
                  text={
                    rejected[0].error?.reason === 'registration_out_of_scope'
                      ? 'Algún cambio no se ha guardado: esa inscripción ya no es de este evento.'
                      : `Algún cambio no se ha guardado: ${rejected[0].error?.message ?? 'Comunica lo ha rechazado'}.`
                  }
                />
                <PressableFeedback
                  onPress={() => void discardRejected()}
                  accessibilityRole="button"
                  style={styles.link}
                >
                  <Text style={[styles.linkText, { color: t.accentText }]}>
                    Descartar
                  </Text>
                </PressableFeedback>
              </View>
            ) : null}
          </View>
        );
      case 'tools':
        return (
          <View style={styles.block}>
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder={
                detail.rooms.length > 0
                  ? 'Buscar por nombre, curso, habitación…'
                  : 'Buscar por nombre, curso, delegación…'
              }
            />
          </View>
        );
      case 'groupBy':
        return (
          <View style={styles.groupBy}>
            <Text style={[styles.groupByLabel, { color: t.textSecondary }]}>
              Agrupar por
            </Text>
            <FilterChips
              chips={groupBys.map((g) => ({
                key: g,
                label: GROUP_BY_LABEL[g],
              }))}
              value={groupBy}
              onChange={(g) => {
                setGroupBy(g);
                listRef.current?.scrollToOffset({ offset: 0, animated: true });
              }}
              label="Agrupar por"
            />
          </View>
        );
      case 'chips':
        return (
          <FilterChips
            chips={chips.map((c) => ({
              ...c,
              warning: c.key === 'pending' && c.count > 0,
            }))}
            value={filter}
            onChange={pickFilter}
            label="Filtrar por llegada"
          />
        );
      case 'section':
        return (
          <View style={styles.sectionHead}>
            <Text
              accessibilityRole="header"
              style={[
                styles.sectionTitle,
                { color: item.section.out ? t.textSecondary : t.text },
              ]}
              numberOfLines={2}
            >
              {item.section.title}
            </Text>
            <Text style={[styles.sectionCount, { color: t.textSecondary }]}>
              {item.section.count}
            </Text>
          </View>
        );
      case 'row':
        return (
          <ListCell position={item.position}>
            <CheckinRow
              row={item.row}
              showRoom={detail.rooms.length > 0 && groupBy !== 'room'}
              showNote={filter === 'note'}
              selecting={selecting}
              selected={!!selection?.has(item.row.id)}
              onArrive={onArrive}
              onUndo={onUndo}
              onOpen={onOpen}
              onSelect={onSelect}
              onStartSelect={onStartSelect}
            />
          </ListCell>
        );
      case 'empty':
        return (
          <EmptyState
            icon={item.search ? 'search-off' : 'inbox'}
            title={item.text}
            titleColor={t.text}
            compact
          />
        );
      case 'foot':
        return (
          <View style={[styles.block, styles.foot]}>
            <Text style={[styles.small, { color: t.textSecondary }]}>
              Toca <Text style={styles.bold}>Llega</Text> al verle entrar.
              Mantén pulsado a alguien para marcar a varios. Lo que marquen
              otros, aquí o en Comunica Tools, aparece solo.
            </Text>
            <SyncBadge generatedAt={detail.generatedAt} />
          </View>
        );
    }
  };

  const count = selection?.size ?? 0;
  const allVisibleSelected =
    visiblePending.length > 0 &&
    visiblePending.every((id) => selection?.has(id));

  return (
    <View style={[styles.root, { backgroundColor: t.backgroundSunken }]}>
      <Stack.Screen
        options={{
          title: detail.event.name,
          headerLargeTitle: false,
          headerRight: () => (
            <PressableFeedback
              onPress={() => {
                h.tap();
                setSelection((s) => (s ? null : new Set()));
              }}
              accessibilityRole="button"
              accessibilityLabel={
                selecting ? 'Terminar de seleccionar' : 'Marcar a varios'
              }
              style={styles.headerButton}
            >
              {selecting ? (
                <Text style={[styles.headerText, { color: glyph }]}>Hecho</Text>
              ) : (
                <IconSymbol name="checklist" size={22} color={glyph} />
              )}
            </PressableFeedback>
          ),
        }}
      />
      <Animated.FlatList
        ref={listRef}
        data={data}
        keyExtractor={(i) => i.key}
        renderItem={renderItem}
        extraData={[selection, filter, groupBy]}
        onScroll={onScroll}
        scrollEventThrottle={16}
        stickyHeaderIndices={stickyIndex >= 0 ? [stickyIndex] : undefined}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={20}
        contentContainerStyle={{ paddingBottom: contentPaddingBottom + 16 }}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => void onRefresh()}
            tintColor={t.textSecondary}
          />
        }
      />
      {selecting ? (
        <BottomActionBar onHeightChange={setBarHeight}>
          <View style={styles.selectInfo}>
            <Text
              style={[styles.body, { color: t.text }]}
              accessibilityLiveRegion="polite"
            >
              {count === 0
                ? 'Toca a quien quieras marcar'
                : count === 1
                  ? '1 seleccionado'
                  : `${count} seleccionados`}
            </Text>
            {visiblePending.length > 0 ? (
              <PressableFeedback
                onPress={() => {
                  h.select();
                  setSelection(
                    allVisibleSelected ? new Set() : new Set(visiblePending),
                  );
                }}
                accessibilityRole="button"
                style={styles.link}
              >
                <Text style={[styles.linkText, { color: t.accentText }]}>
                  {allVisibleSelected
                    ? 'Quitar la selección'
                    : `Los que faltan aquí (${visiblePending.length})`}
                </Text>
              </PressableFeedback>
            ) : null}
          </View>
          <View style={styles.selectActions}>
            <PressableFeedback
              onPress={() => void applySelection('absent')}
              isDisabled={count === 0}
              accessibilityRole="button"
              accessibilityState={{ disabled: count === 0 }}
              style={[
                styles.secondary,
                { backgroundColor: t.card, borderColor: t.cardBorder },
                count === 0 && styles.disabled,
              ]}
            >
              <Text style={[styles.secondaryLabel, { color: t.accentText }]}>
                No vienen
              </Text>
              <PressableFeedback.Highlight />
            </PressableFeedback>
            <AreaPrimaryButton
              label={count > 0 ? `Llegan (${count})` : 'Llegan'}
              icon="checkmark"
              disabled={count === 0}
              onPress={() => void applySelection('in')}
              style={styles.primary}
            />
          </View>
        </BottomActionBar>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  block: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  meta: { ...typography.subhead },
  figureBlock: { gap: 8 },
  figure: { ...typography.h0 },
  figureText: { ...typography.title, letterSpacing: 0 },
  track: { height: 8, borderRadius: radii.xs, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radii.xs },
  rejected: { gap: 4 },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  linkText: { ...typography.button },
  groupBy: { paddingTop: 8 },
  groupByLabel: {
    ...typography.caption,
    fontWeight: '600',
    paddingHorizontal: 20,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 4,
  },
  sectionTitle: { ...typography.h3, flexShrink: 1 },
  sectionCount: { ...typography.subhead, fontWeight: '600' },
  foot: { paddingTop: 24, alignItems: 'flex-start' },
  small: { ...typography.caption },
  bold: { fontWeight: '700' },
  body: { ...typography.body },
  headerButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { ...typography.button },
  selectInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectActions: { flexDirection: 'row', gap: 12 },
  secondary: {
    flex: 1,
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  secondaryLabel: { ...typography.button },
  primary: { flex: 2, minHeight: 52 },
  disabled: { opacity: 0.5 },
});
