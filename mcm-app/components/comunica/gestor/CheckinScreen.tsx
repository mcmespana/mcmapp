// El check-in de un evento que gestionas (plan 18): quién ha LLEGADO y en qué
// habitación duerme. Es el check-in de Comunica Tools y se guarda en el mismo
// sitio; nada va al CRM ni es la asistencia por días de «Pasar lista en un
// evento» (plan 07).
//
// De arriba abajo, de lo que más se mira a lo que menos:
//   · La cifra grande («87 / 120 han llegado»), su barra y lo que falta.
//   · El buscador (sin tildes y por trozos, también por habitación) y dos
//     botones: «Filtros» (agrupar y afinar, en una hoja, con el número de lo
//     puesto) y «Habitaciones» (la vista por plantas). Con habitaciones, el
//     interruptor «Habitación al llegar»: al marcar «Llega» a alguien sin
//     habitación sale el selector al momento (un toque y listo, con Deshacer).
//   · Chips pegados de la llegada: Todos / Faltan / Están / No vienen.
//   · Cada persona: el nombre entero, su habitación (se toca y se cambia) y
//     «Llega» grande, o la hora y deshacer. Tocarla abre la ficha y
//     mantenerla pulsada empieza a seleccionar varios (abajo: «No vienen»,
//     «Habitación» y «Llegan» para todos los elegidos).
//   · SIN COBERTURA: lo marcado se ve al momento y se queda en la cola con su
//     hora; sube solo. Con la pantalla a la vista y la app delante, se
//     pregunta cada pocos segundos lo que han marcado otros (aquí o en
//     Comunica Tools).
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
import { useBoolPreference } from '@/hooks/comunica/useBoolPreference';
import { useFlushOutboxOnMount } from '@/hooks/comunica/useOutbox';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import useNetworkStatus from '@/hooks/useNetworkStatus';
import { h } from '@/utils/haptics';
import {
  arrivedHeadline,
  arrivedTime,
  checkinRows,
  checkinSections,
  checkinStats,
  filterChips,
  GROUP_BY_LABEL,
  groupBysFor,
  pendingIn,
  refineCount,
  refineOptions,
  restLine,
  type CheckinFilter,
  type CheckinGroupBy,
  type CheckinRefine,
  type CheckinRowModel,
  type CheckinSection,
} from '@/utils/comunica/checkin';
import { eventDates } from '@/utils/comunica/events';
import { roomOccupancy } from '@/utils/comunica/rooms';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';
import AreaScreen from '../comun/AreaScreen';
import AreaState from '../comun/AreaState';
import AreaSwitch from '../comun/AreaSwitch';
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
import CheckinFiltersSheet from './CheckinFiltersSheet';
import CheckinRow from './CheckinRow';
import RoomSheet, { roomNow } from './RoomSheet';
import { useRoomPicker } from './useRoomPicker';

type Item =
  | { kind: 'head'; key: string }
  | { kind: 'tools'; key: string }
  | { kind: 'chips'; key: string }
  | { kind: 'refined'; key: string }
  | { kind: 'section'; key: string; section: CheckinSection }
  | { kind: 'row'; key: string; row: CheckinRowModel; position: CellPosition }
  | { kind: 'empty'; key: string; text: string; search: boolean }
  | { kind: 'foot'; key: string };

export const FORBIDDEN_MANAGED =
  'No gestionas este evento (o ya no eres su gestor/a).';

/** «Habitación al llegar»: preferencia del móvil, como «Asignar grupos». */
export const ROOM_ON_ARRIVAL_KEY = 'comunica.roomOnArrival';

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

/** Un botón de la barra de herramientas (Filtros, Habitaciones). */
function ToolButton({
  icon,
  label,
  badge,
  onPress,
  accessibilityLabel,
}: {
  icon: 'line.3.horizontal.decrease.circle' | 'bed.double';
  label: string;
  badge?: number;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const t = useComunicaTheme();
  return (
    <PressableFeedback
      onPress={() => {
        h.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        styles.tool,
        { backgroundColor: t.card, borderColor: t.cardBorder },
      ]}
    >
      <IconSymbol name={icon} size={18} color={t.accentText} />
      <Text
        style={[styles.toolLabel, { color: t.accentText }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: t.accentFill }]}>
          <Text style={[styles.badgeText, { color: t.onAccent }]}>{badge}</Text>
        </View>
      ) : null}
      <PressableFeedback.Highlight />
    </PressableFeedback>
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
  const { effective, unsent, rejected, mark, setRoom, discardRejected } =
    useCheckin(eventId, detail);
  const picker = useRoomPicker(detail, setRoom);
  const [roomOnArrival, setRoomOnArrival] =
    useBoolPreference(ROOM_ON_ARRIVAL_KEY);
  const hasRooms = detail.rooms.length > 0;
  const tabClearance = useTabBarClearance();
  const [barHeight, setBarHeight] = useState<number | null>(null);
  const [filter, setFilter] = useState<CheckinFilter>('all');
  const [refine, setRefine] = useState<CheckinRefine>({});
  const [groupBy, setGroupBy] = useState<CheckinGroupBy>('name');
  const [filtersOpen, setFiltersOpen] = useState(false);
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
  const occ = useMemo(
    () => roomOccupancy(detail, effective),
    [detail, effective],
  );
  const chips = useMemo(() => filterChips(rows, refine), [rows, refine]);
  const options = useMemo(
    () => refineOptions(rows, detail.event),
    [rows, detail.event],
  );
  const groupBys = groupBysFor(detail.rooms);
  const sections = useMemo(
    () =>
      checkinSections(rows, {
        filter,
        refine,
        query,
        groupBy,
        event: detail.event,
        rooms: detail.rooms,
      }),
    [rows, filter, refine, query, groupBy, detail.event, detail.rooms],
  );
  const visiblePending = useMemo(() => pendingIn(sections), [sections]);
  const headline = arrivedHeadline(stats);
  const rest = restLine(stats);
  const refined = refineCount(refine);
  const filtersBadge = refined + (groupBy !== 'name' ? 1 : 0);
  const refinedText = [
    refine.note ? 'Con nota' : null,
    refine.room === 'with'
      ? 'Con habitación'
      : refine.room === 'without'
        ? 'Sin habitación'
        : null,
    refine.role
      ? options.roles.find((o) => o.key === refine.role)?.label
      : null,
    refine.delegation !== undefined
      ? (options.delegations.find((o) => o.key === refine.delegation)?.label ??
        'Sin delegación')
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const regOf = useCallback(
    (id: string) => detail.registrations.find((r) => r.registrationId === id),
    [detail.registrations],
  );

  // ── Marcar ──
  const onArrive = useCallback(
    (id: string) => {
      void mark([id], 'in');
      // «Habitación al llegar»: a quien no tiene, el selector al momento.
      if (roomOnArrival && hasRooms && !effective.get(id)?.roomId) {
        const reg = regOf(id);
        if (!reg) return;
        picker.open({
          ids: [id],
          title: `${reg.firstName} ${reg.lastName}`,
          subtitle: `Ha llegado · ${arrivedTime(new Date().toISOString())}`,
        });
      }
    },
    [mark, roomOnArrival, hasRooms, effective, regOf, picker],
  );
  const onUndo = useCallback(
    (id: string) => void mark([id], 'pending'),
    [mark],
  );
  const onRoom = useCallback(
    (id: string) => {
      const reg = regOf(id);
      if (!reg) return;
      picker.open({
        ids: [id],
        title: `${reg.firstName} ${reg.lastName}`,
        subtitle: roomNow(detail, effective.get(id)?.roomId),
      });
    },
    [regOf, picker, detail, effective],
  );
  const onOpen = useCallback(
    (id: string) => {
      const reg = regOf(id);
      if (!reg) return;
      router.push({
        pathname: '/comunica/gestion/[eventId]/persona/[personId]',
        params: { eventId, personId: reg.personId },
      });
    },
    [regOf, eventId, router],
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
  const roomForSelection = () => {
    if (!selection || selection.size === 0) return;
    const ids = [...selection];
    picker.open({
      ids,
      title:
        ids.length === 1
          ? (() => {
              const r = regOf(ids[0]);
              return r ? `${r.firstName} ${r.lastName}` : '1 persona';
            })()
          : `${ids.length} personas`,
    });
    setSelection(null);
  };

  const scrollTop = () =>
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  const pickFilter = (k: CheckinFilter) => {
    setFilter((cur) => (cur === k && k !== 'all' ? 'all' : k));
    scrollTop();
  };

  // ── La lista, aplanada ──
  const data = useMemo((): Item[] => {
    const items: Item[] = [
      { kind: 'head', key: 'head' },
      { kind: 'tools', key: 'tools' },
      { kind: 'chips', key: 'chips' },
    ];
    if (refined > 0) items.push({ kind: 'refined', key: 'refined' });
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
          : filter === 'pending' && refined === 0
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
  }, [sections, detail.registrations.length, query, filter, refined]);
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
                      : rejected[0].error?.reason === 'room_not_in_event'
                        ? 'Algún cambio no se ha guardado: esa habitación ya no es de este evento.'
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
                hasRooms
                  ? 'Buscar por nombre, curso, habitación…'
                  : 'Buscar por nombre, curso, delegación…'
              }
            />
            <View style={styles.tools}>
              <ToolButton
                icon="line.3.horizontal.decrease.circle"
                label="Filtros"
                badge={filtersBadge}
                accessibilityLabel={
                  filtersBadge > 0
                    ? `Filtros, ${filtersBadge} puestos${groupBy !== 'name' ? `, agrupado por ${GROUP_BY_LABEL[groupBy].toLowerCase()}` : ''}`
                    : 'Filtros y agrupar'
                }
                onPress={() => setFiltersOpen(true)}
              />
              {hasRooms ? (
                <ToolButton
                  icon="bed.double"
                  label="Habitaciones"
                  onPress={() =>
                    router.push({
                      pathname: '/comunica/gestion/[eventId]/habitaciones',
                      params: { eventId },
                    })
                  }
                />
              ) : null}
            </View>
            {hasRooms ? (
              <View
                style={[
                  styles.switchRow,
                  { backgroundColor: t.card, borderColor: t.cardBorder },
                ]}
              >
                <IconSymbol name="bed.double" size={18} color={t.accentText} />
                <View style={styles.flex}>
                  <Text style={[styles.body, { color: t.text }]}>
                    Habitación al llegar
                  </Text>
                  <Text style={[styles.small, { color: t.textSecondary }]}>
                    Al marcar «Llega» a quien no tiene, eliges la suya.
                  </Text>
                </View>
                <AreaSwitch
                  value={roomOnArrival}
                  onChange={setRoomOnArrival}
                  label="Habitación al llegar"
                />
              </View>
            ) : null}
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
      case 'refined':
        return (
          <View style={styles.refined}>
            <IconSymbol
              name="line.3.horizontal.decrease.circle"
              size={16}
              color={t.accentText}
            />
            <Text
              style={[styles.refinedText, { color: t.text }]}
              numberOfLines={2}
            >
              {refinedText}
            </Text>
            <PressableFeedback
              onPress={() => {
                h.remove();
                setRefine({});
              }}
              accessibilityRole="button"
              accessibilityLabel="Quitar los filtros"
              style={styles.link}
            >
              <Text style={[styles.linkText, { color: t.accentText }]}>
                Quitar
              </Text>
            </PressableFeedback>
          </View>
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
      case 'row': {
        const roomId = item.row.room?.id;
        return (
          <ListCell position={item.position}>
            <CheckinRow
              row={item.row}
              showRoom={hasRooms}
              roomTone={roomId ? occ.get(roomId)?.tone : undefined}
              onRoom={onRoom}
              showNote={!!refine.note}
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
      }
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
              {hasRooms ? ' Toca su habitación para cambiarla.' : ''} Mantén
              pulsado a alguien para marcar a varios. Lo que marquen otros, aquí
              o en Comunica Tools, aparece solo.
            </Text>
            <SyncBadge generatedAt={detail.generatedAt} />
          </View>
        );
    }
  };

  const count = selection?.size ?? 0;
  const arrive = (
    <AreaPrimaryButton
      label={count > 0 ? `Llegan (${count})` : 'Llegan'}
      icon="checkmark"
      disabled={count === 0}
      onPress={() => void applySelection('in')}
      style={hasRooms ? styles.primaryWide : styles.primary}
    />
  );
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
        extraData={[selection, filter, refine, groupBy, occ]}
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
            <SecondaryAction
              label="No vienen"
              disabled={count === 0}
              onPress={() => void applySelection('absent')}
            />
            {hasRooms ? (
              <SecondaryAction
                label="Habitación"
                icon="bed.double"
                disabled={count === 0}
                onPress={roomForSelection}
              />
            ) : (
              arrive
            )}
          </View>
          {/* Con habitaciones, «Llegan» a lo ancho debajo: tres botones en
              una fila, a 375 pt, cortaban las palabras. */}
          {hasRooms ? arrive : null}
        </BottomActionBar>
      ) : null}
      <CheckinFiltersSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        groupBys={groupBys}
        groupBy={groupBy}
        onGroupBy={(g) => {
          setGroupBy(g);
          scrollTop();
        }}
        refine={refine}
        onRefine={(r) => {
          setRefine(r);
          scrollTop();
        }}
        options={options}
        hasRooms={hasRooms}
      />
      <RoomSheet detail={detail} effective={effective} {...picker.sheet} />
    </View>
  );
}

function SecondaryAction({
  label,
  icon,
  disabled,
  onPress,
}: {
  label: string;
  icon?: 'bed.double';
  disabled: boolean;
  onPress: () => void;
}) {
  const t = useComunicaTheme();
  return (
    <PressableFeedback
      onPress={onPress}
      isDisabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={[
        styles.secondary,
        { backgroundColor: t.card, borderColor: t.cardBorder },
        disabled && styles.disabled,
      ]}
    >
      {icon ? <IconSymbol name={icon} size={18} color={t.accentText} /> : null}
      <Text
        style={[styles.secondaryLabel, { color: t.accentText }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <PressableFeedback.Highlight />
    </PressableFeedback>
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
  tools: { flexDirection: 'row', gap: 8 },
  tool: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  toolLabel: { ...typography.button, flexShrink: 1 },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...typography.footnote, fontWeight: '700' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  flex: { flex: 1 },
  refined: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  refinedText: { ...typography.subhead, fontWeight: '600', flex: 1 },
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
    flexDirection: 'row',
    gap: 6,
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  secondaryLabel: { ...typography.button },
  primary: { flex: 2, minHeight: 52 },
  primaryWide: { minHeight: 52 },
  disabled: { opacity: 0.5 },
});
