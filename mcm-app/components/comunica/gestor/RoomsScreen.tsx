// Las habitaciones de un evento que gestionas (plan 18): cómo está el reparto
// de un vistazo y mover a alguien en dos toques.
//
//   · Arriba, las cifras («38 con habitación · 5 sin · 41/52 plazas») y el
//     aviso si alguna se pasa de plazas. El buscador encuentra a una persona o
//     una habitación.
//   · Primero, «Sin habitación»: es lo que queda por hacer.
//   · Luego cada planta («Planta 1», o «Casa X · Planta 1» si hay varios
//     alojamientos), con sus habitaciones en orden natural; cada una, una
//     tarjeta con su ocupación («4/6 · quedan 2», con el color de cómo está),
//     su gente (y si ha llegado) y lo puesto a mano en Comunica Tools (un
//     formador, plazas reservadas), que también ocupa.
//   · Tocar a alguien abre el selector de habitación (con «Ver ficha»); el
//     cambio va a la cola, se ve al momento y tiene «Deshacer».
//
// Lee el mismo evento guardado que el check-in (y el mismo sondeo): lo que se
// mueva aquí o en Comunica Tools se ve en las dos.

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
import type {
  ManagedEventDetail,
  ManagedRegistration,
  RoomExtra,
} from '@/services/comunica/contract';
import {
  useCheckin,
  useCheckinPolling,
  useManagedEvent,
} from '@/hooks/comunica/managedEvents';
import { useFlushOutboxOnMount } from '@/hooks/comunica/useOutbox';
import { h } from '@/utils/haptics';
import {
  checkinRows,
  matchesQuery,
  type CheckinRowModel,
  type Effective,
} from '@/utils/comunica/checkin';
import { fold } from '@/utils/comunica/search';
import {
  freeLabel,
  roomOccupancy,
  roomsByFloor,
  roomStats,
  unplacedPeople,
  venuesOf,
  type RoomUse,
} from '@/utils/comunica/rooms';
import AreaScreen from '../comun/AreaScreen';
import AreaState from '../comun/AreaState';
import CardSurface from '../comun/CardSurface';
import PersonAvatar from '../comun/PersonAvatar';
import SearchField from '../comun/SearchField';
import SyncBadge from '../comun/SyncBadge';
import { MARK_FILL, ROOM_CHIP } from '../comun/theme';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import { Notice } from '../pasar-lista/RollBits';
import { FORBIDDEN_MANAGED } from './CheckinScreen';
import RoomSheet, { roomNow, type RoomTarget } from './RoomSheet';
import { useRoomPicker } from './useRoomPicker';

type Item =
  | { kind: 'head'; key: string }
  | { kind: 'unplaced'; key: string; people: ManagedRegistration[] }
  | { kind: 'venue'; key: string; title: string }
  | {
      kind: 'floor';
      key: string;
      title: string;
      taken: number;
      capacity: number;
      /** La primera planta de un alojamiento (va pegada a su nombre). */
      first: boolean;
    }
  | { kind: 'room'; key: string; use: RoomUse }
  | { kind: 'empty'; key: string }
  | { kind: 'foot'; key: string };

export default function RoomsScreen({ eventId }: { eventId: string }) {
  const t = useComunicaTheme();
  const q = useManagedEvent(eventId);
  useFlushOutboxOnMount();
  const focused = useIsFocused();
  useCheckinPolling(eventId, focused);
  const detail = q.data;
  if (!detail) {
    return (
      <AreaScreen onRefresh={() => q.refetch()}>
        <AreaState
          query={q}
          skeleton="list"
          forbidden={{ title: FORBIDDEN_MANAGED }}
        >
          {() => null}
        </AreaState>
      </AreaScreen>
    );
  }
  if (detail.rooms.length === 0) {
    return (
      <AreaScreen onRefresh={() => q.refetch()}>
        <EmptyState
          icon="hotel"
          title="Este evento no tiene habitaciones."
          subtitle="Se ponen en Comunica Tools, en «Alojamientos»."
          titleColor={t.text}
        />
      </AreaScreen>
    );
  }
  return <RoomsList detail={detail} onRefresh={() => q.refetch()} />;
}

function RoomsList({
  detail,
  onRefresh,
}: {
  detail: ManagedEventDetail;
  onRefresh: () => Promise<unknown>;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const eventId = detail.event.id;
  const { effective, unsent, setRoom } = useCheckin(eventId, detail);
  const picker = useRoomPicker(detail, setRoom);
  const [query, setQuery] = useState('');
  const { listRef, onScroll, contentPaddingBottom } =
    useTabListScroll<Animated.FlatList<Item>>('comunica');

  const occ = useMemo(
    () => roomOccupancy(detail, effective),
    [detail, effective],
  );
  const stats = useMemo(
    () => roomStats(detail, effective, occ),
    [detail, effective, occ],
  );
  const rows = useMemo(
    () => new Map(checkinRows(detail, effective).map((r) => [r.id, r])),
    [detail, effective],
  );

  const data = useMemo((): Item[] => {
    const q = query.trim();
    const hit = (r: ManagedRegistration) =>
      matchesQuery(rows.get(r.registrationId)?.haystack ?? '', q);
    const roomHit = (u: RoomUse) =>
      fold(u.room.code)
        .replace(/\s+/g, '')
        .includes(fold(q).replace(/\s+/g, '')) ||
      u.people.some(hit) ||
      u.extras.some((x) => matchesQuery(fold(x.label), q));
    const items: Item[] = [{ kind: 'head', key: 'head' }];
    const loose = unplacedPeople(detail, effective, occ).filter(
      (r) => !q || hit(r),
    );
    if (loose.length > 0) {
      items.push({ kind: 'unplaced', key: 'unplaced', people: loose });
    }
    // Con varios alojamientos, su nombre una vez y debajo sus plantas.
    const many = venuesOf(detail.rooms).length > 1;
    let venue: string | null = null;
    for (const s of roomsByFloor(occ)) {
      const list = q ? s.rooms.filter(roomHit) : s.rooms;
      if (list.length === 0) continue;
      const first = many && s.venue !== venue;
      if (first) {
        venue = s.venue;
        items.push({ kind: 'venue', key: `v:${s.venue}`, title: s.venue });
      }
      items.push({
        kind: 'floor',
        key: `f:${s.key}`,
        title: s.floor,
        taken: s.taken,
        capacity: s.capacity,
        first,
      });
      for (const u of list) {
        items.push({ kind: 'room', key: `h:${u.room.id}`, use: u });
      }
    }
    if (items.length === 1) items.push({ kind: 'empty', key: 'empty' });
    items.push({ kind: 'foot', key: 'foot' });
    return items;
  }, [query, rows, detail, effective, occ]);

  const openPerson = useCallback(
    (r: ManagedRegistration) =>
      picker.open({
        ids: [r.registrationId],
        title: `${r.firstName} ${r.lastName}`,
        subtitle: roomNow(detail, effective.get(r.registrationId)?.roomId),
      }),
    [picker, detail, effective],
  );
  const openFicha = useCallback(
    (target: RoomTarget) => {
      const reg = detail.registrations.find(
        (r) => r.registrationId === target.ids[0],
      );
      if (!reg) return;
      router.push({
        pathname: '/comunica/gestion/[eventId]/persona/[personId]',
        params: { eventId, personId: reg.personId },
      });
    },
    [detail.registrations, eventId, router],
  );

  const renderItem = ({ item }: { item: Item }) => {
    switch (item.kind) {
      case 'head':
        return (
          <View style={styles.block}>
            <Text style={[styles.meta, { color: t.textSecondary }]}>
              {detail.event.name}
            </Text>
            <Text
              style={[styles.figure, { color: t.text }]}
              accessibilityRole="summary"
            >
              {stats.placed} con habitación
              <Text style={{ color: t.textSecondary }}>
                {stats.unplaced > 0 ? ` · ${stats.unplaced} sin` : ''}
              </Text>
            </Text>
            <Text style={[styles.meta, { color: t.textSecondary }]}>
              {stats.taken}/{stats.beds} plazas ocupadas en {stats.rooms}{' '}
              {stats.rooms === 1 ? 'habitación' : 'habitaciones'}
            </Text>
            {stats.over > 0 ? (
              <Notice
                icon="exclamationmark.triangle.fill"
                text={
                  stats.over === 1
                    ? '1 habitación tiene más gente que plazas.'
                    : `${stats.over} habitaciones tienen más gente que plazas.`
                }
              />
            ) : null}
            {unsent > 0 ? (
              <Notice
                icon="clock"
                tone="info"
                text={
                  unsent === 1
                    ? '1 cambio sin subir todavía: se envía solo.'
                    : `${unsent} cambios sin subir todavía: se envían solos.`
                }
              />
            ) : null}
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Buscar persona o habitación…"
            />
          </View>
        );
      case 'unplaced':
        return (
          <View style={styles.block}>
            <SectionTitle
              title="Sin habitación"
              trailing={String(item.people.length)}
              warning
            />
            <CardSurface clip>
              {item.people.map((r, i) => (
                <PersonLine
                  key={r.registrationId}
                  reg={r}
                  row={rows.get(r.registrationId)}
                  eff={effective.get(r.registrationId)}
                  first={i === 0}
                  onPress={() => openPerson(r)}
                />
              ))}
            </CardSurface>
          </View>
        );
      case 'venue':
        return (
          <View style={[styles.block, styles.venue]}>
            <SectionTitle title={item.title} />
          </View>
        );
      case 'floor':
        return (
          <View style={[styles.block, item.first ? null : styles.floor]}>
            <View style={styles.floorHead}>
              <Text
                accessibilityRole="header"
                style={[styles.floorTitle, { color: t.textSecondary }]}
              >
                {item.title}
              </Text>
              <Text style={[styles.floorCount, { color: t.textSecondary }]}>
                {item.taken}/{item.capacity} plazas
              </Text>
            </View>
          </View>
        );
      case 'room':
        return (
          <View style={[styles.block, styles.roomBlock]}>
            <RoomCard
              use={item.use}
              many={venuesOf(detail.rooms).length > 1}
              rows={rows}
              effective={effective}
              onPerson={openPerson}
            />
          </View>
        );
      case 'empty':
        return (
          <EmptyState
            icon="search-off"
            title="Nadie ni ninguna habitación coincide."
            titleColor={t.text}
            compact
          />
        );
      case 'foot':
        return (
          <View style={[styles.block, styles.foot]}>
            <Text style={[styles.small, { color: t.textSecondary }]}>
              Toca a alguien para cambiarle de habitación. Lo puesto a mano
              (formadores, plazas reservadas) se cambia en Comunica Tools.
            </Text>
            <SyncBadge generatedAt={detail.generatedAt} />
          </View>
        );
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: t.backgroundSunken }]}>
      <Stack.Screen
        options={{ title: 'Habitaciones', headerLargeTitle: false }}
      />
      <Animated.FlatList
        ref={listRef}
        data={data}
        keyExtractor={(i) => i.key}
        renderItem={renderItem}
        extraData={[effective, occ]}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        // Pocas filas (una por habitación y planta): se pintan casi todas.
        initialNumToRender={24}
        contentContainerStyle={{ paddingBottom: contentPaddingBottom + 16 }}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => void onRefresh()}
            tintColor={t.textSecondary}
          />
        }
      />
      <RoomSheet
        detail={detail}
        effective={effective}
        onOpenFicha={openFicha}
        {...picker.sheet}
      />
    </View>
  );
}

function SectionTitle({
  title,
  trailing,
  warning,
}: {
  title: string;
  trailing?: string;
  warning?: boolean;
}) {
  const t = useComunicaTheme();
  return (
    <View style={styles.sectionHead}>
      <Text
        accessibilityRole="header"
        style={[
          styles.sectionTitle,
          { color: warning ? t.warningText : t.text },
        ]}
        numberOfLines={2}
      >
        {title}
      </Text>
      {trailing ? (
        <Text style={[styles.sectionCount, { color: t.textSecondary }]}>
          {trailing}
        </Text>
      ) : null}
    </View>
  );
}

function RoomCard({
  use,
  many,
  rows,
  effective,
  onPerson,
}: {
  use: RoomUse;
  many: boolean;
  rows: ReadonlyMap<string, CheckinRowModel>;
  effective: ReadonlyMap<string, Effective>;
  onPerson: (r: ManagedRegistration) => void;
}) {
  const t = useComunicaTheme();
  const { room, people, extras, taken, capacity, tone } = use;
  const chip = t.chip(ROOM_CHIP[tone]);
  const empty = people.length === 0 && extras.length === 0;
  return (
    <CardSurface clip>
      <View
        style={styles.roomHead}
        accessible
        accessibilityRole="header"
        accessibilityLabel={`Habitación ${room.code}${many ? `, ${room.venue}` : ''}: ${taken} de ${capacity}, ${freeLabel(use)}`}
      >
        <View style={styles.flex}>
          {/* El alojamiento ya lo dice el título de la planta. */}
          <Text style={[styles.roomTitle, { color: t.text }]}>
            Habitación {room.code}
          </Text>
        </View>
        <View style={[styles.occ, { backgroundColor: chip.background }]}>
          <Text style={[styles.occText, { color: chip.text }]}>
            {taken}/{capacity} · {freeLabel(use)}
          </Text>
        </View>
      </View>
      {people.map((r) => (
        <PersonLine
          key={r.registrationId}
          reg={r}
          row={rows.get(r.registrationId)}
          eff={effective.get(r.registrationId)}
          onPress={() => onPerson(r)}
        />
      ))}
      {extras.map((x) => (
        <ExtraLine key={x.id} extra={x} />
      ))}
      {empty ? (
        <Text style={[styles.emptyRoom, { color: t.textSecondary }]}>
          Vacía
        </Text>
      ) : null}
    </CardSurface>
  );
}

function PersonLine({
  reg,
  row,
  eff,
  first,
  onPress,
}: {
  reg: ManagedRegistration;
  row?: CheckinRowModel;
  eff?: Effective;
  /** La primera de la tarjeta: sin raya encima. */
  first?: boolean;
  onPress: () => void;
}) {
  const t = useComunicaTheme();
  const monitor = reg.role !== 'participant';
  const status =
    eff?.status === 'in'
      ? 'ha llegado'
      : eff?.status === 'absent'
        ? 'no viene'
        : 'falta';
  return (
    <PressableFeedback
      onPress={() => {
        h.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={[
        `${reg.firstName} ${reg.lastName}`,
        row?.line,
        status,
        eff?.queued ? 'sin subir todavía' : null,
      ]
        .filter(Boolean)
        .join(', ')}
      accessibilityHint="Cambiar de habitación"
      style={[
        styles.person,
        !first && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: t.cardBorder,
        },
      ]}
    >
      <PersonAvatar
        person={{
          id: reg.personId,
          firstName: reg.firstName,
          lastName: reg.lastName,
          photoUrl: reg.photoUrl,
        }}
        size={36}
        background={monitor ? t.accentFill : undefined}
        ink={monitor ? t.onAccent : undefined}
      />
      <View style={styles.flex}>
        <Text style={[styles.body, { color: t.text }]} numberOfLines={2}>
          <Text style={styles.bold}>{reg.firstName}</Text> {reg.lastName}
        </Text>
        {row?.line ? (
          <Text
            style={[styles.small, { color: t.textSecondary }]}
            numberOfLines={1}
          >
            {row.line}
          </Text>
        ) : null}
      </View>
      {eff?.queued ? (
        <IconSymbol name="icloud.and.arrow.up" size={14} color={t.textMuted} />
      ) : null}
      {eff?.status === 'in' ? (
        <IconSymbol
          name="checkmark.circle.fill"
          size={18}
          color={MARK_FILL.yes}
        />
      ) : eff?.status === 'absent' ? (
        <Text style={[styles.small, { color: t.textSecondary }]}>No viene</Text>
      ) : null}
      <IconSymbol name="chevron.right" size={14} color={t.textMuted} />
      <PressableFeedback.Highlight />
    </PressableFeedback>
  );
}

function ExtraLine({ extra }: { extra: RoomExtra }) {
  const t = useComunicaTheme();
  return (
    <View
      style={[
        styles.person,
        {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: t.cardBorder,
        },
      ]}
      accessible
      accessibilityLabel={`${extra.label}, puesto a mano en Comunica Tools, ${extra.seats} ${extra.seats === 1 ? 'plaza' : 'plazas'}`}
    >
      <View style={[styles.extraIcon, { backgroundColor: t.backgroundSunken }]}>
        <IconSymbol
          name={extra.kind === 'hold' ? 'lock' : 'person.fill'}
          size={16}
          color={t.textSecondary}
        />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.body, { color: t.text }]}>{extra.label}</Text>
        <Text style={[styles.small, { color: t.textSecondary }]}>
          {extra.kind === 'hold' ? 'Plazas reservadas' : 'Sin inscripción'}
          {extra.seats > 1 ? ` · ${extra.seats} plazas` : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  block: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  venue: { paddingTop: 24 },
  floor: { paddingTop: 16 },
  floorHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingHorizontal: 4,
  },
  floorTitle: { ...typography.sectionLabel, flexShrink: 1 },
  floorCount: { ...typography.caption },
  roomBlock: { paddingTop: 8 },
  meta: { ...typography.subhead },
  figure: { ...typography.h2 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: { ...typography.h3, flexShrink: 1 },
  sectionCount: { ...typography.subhead, fontWeight: '600', flexShrink: 0 },
  roomHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  roomTitle: { ...typography.title },
  occ: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  occText: { ...typography.footnote, fontWeight: '700' },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  extraIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyRoom: {
    ...typography.subhead,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  flex: { flex: 1 },
  body: { ...typography.body },
  bold: { fontWeight: '600' },
  small: { ...typography.caption },
  foot: { paddingTop: 24, alignItems: 'flex-start' },
});
