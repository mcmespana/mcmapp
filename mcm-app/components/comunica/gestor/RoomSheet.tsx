// Elegir habitación rápido (plan 18): una hoja con las habitaciones del
// evento en fichas que se tocan una vez. Es el selector de Comunica Tools
// (`room-picker.tsx`) con el lenguaje de la app:
//
//   · Arriba, la última usada (si cabe): cuatro seguidos a la misma, un toque
//     cada uno. Luego las que tienen hueco (antes las que ya tienen gente, para
//     llenar antes de abrir otra) y, plegadas, las llenas o pasadas: se pueden
//     elegir (pasarse se deja, como allí), pero casi nunca hacen falta.
//   · Cada ficha: el código, la planta, una barrita y «2/4 · quedan 2». Cuenta
//     lo puesto a mano en Comunica Tools (un formador, plazas reservadas). El
//     lector oye quién hay dentro.
//   · Se busca por código («b10»), por planta («p1», «baja») o por casa.
//   · Con habitación, «Quitar la habitación».
//
// La hoja no escribe: devuelve la elegida (`onPick`) y quien la abre la pone
// en la cola y enseña el «Deshacer».

import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { PressableFeedback } from 'heroui-native';
import BottomSheet from '@/components/BottomSheet';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import type { ManagedEventDetail } from '@/services/comunica/contract';
import { h } from '@/utils/haptics';
import type { Effective } from '@/utils/comunica/checkin';
import {
  floorShort,
  freeLabel,
  roomHeading,
  roomOccupancy,
  roomOptionLabel,
  roomOptions,
  venuesOf,
  type RoomOption,
} from '@/utils/comunica/rooms';
import SearchField from '../comun/SearchField';
import { ROOM_BAR } from '../comun/theme';
import { useComunicaTheme } from '../comun/useComunicaTheme';

export interface RoomTarget {
  /** Las inscripciones a las que se pone. */
  ids: string[];
  /** «Lucía García» o «3 personas». */
  title: string;
  /** «Ha llegado · 10:32», «Ahora: Habitación 101»… */
  subtitle?: string;
}

const GAP = 8;
/** La hoja no pasa de esto en alto: lo de abajo se desplaza. */
const LIST_MAX_SHARE = 0.6;

interface Props {
  target: RoomTarget | null;
  detail: ManagedEventDetail;
  effective: ReadonlyMap<string, Effective>;
  /** La última habitación usada en esta pantalla. */
  last: string | null;
  onPick: (target: RoomTarget, roomId: string | null) => void;
  onClose: () => void;
  /** «Ver ficha» (desde la vista de habitaciones). */
  onOpenFicha?: (target: RoomTarget) => void;
}

export default function RoomSheet({ target, onClose, ...rest }: Props) {
  // La última se queda mientras la hoja se cierra (si no, bajaba vacía).
  const [shown, setShown] = useState(target);
  if (target && target !== shown) setShown(target);
  return (
    <BottomSheet
      visible={!!target}
      onClose={onClose}
      title={shown?.title ?? ''}
    >
      {shown ? (
        <Chooser
          key={shown.ids.join(',')}
          target={shown}
          onClose={onClose}
          {...rest}
        />
      ) : (
        <View />
      )}
    </BottomSheet>
  );
}

function Chooser({
  target,
  detail,
  effective,
  last,
  onPick,
  onClose,
  onOpenFicha,
}: Props & { target: RoomTarget }) {
  const t = useComunicaTheme();
  const { height } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [showFull, setShowFull] = useState(false);
  const [width, setWidth] = useState(0);
  // La de ahora: la de todos si es la misma; si no, ninguna.
  const currents = new Set(
    target.ids.map((id) => effective.get(id)?.roomId ?? null),
  );
  const current = currents.size === 1 ? [...currents][0] : null;
  const anyRoom = target.ids.some((id) => effective.get(id)?.roomId);
  const occ = useMemo(
    () => roomOccupancy(detail, effective),
    [detail, effective],
  );
  const opts = useMemo(
    () =>
      roomOptions(occ, {
        adding: target.ids.length,
        current,
        last,
        query,
      }),
    [occ, target.ids.length, current, last, query],
  );
  const many = venuesOf(detail.rooms).length > 1;
  const lastOpt = opts.find((o) => o.last);
  const fit = opts.filter((o) => o.fits && !o.last);
  const full = opts.filter((o) => !o.fits);
  const fullOpen = showFull || !!query.trim() || fit.length === 0;
  const columns = width >= 480 ? 4 : 3;
  const tileWidth =
    width > 0 ? Math.floor((width - GAP * (columns - 1)) / columns) : 0;

  const pick = (roomId: string | null) => {
    if (roomId !== current || target.ids.length > 1) onPick(target, roomId);
    onClose();
  };
  // Con varios alojamientos, cada tanda partida por casa (el nombre no cabe
  // en una ficha de un tercio de pantalla: salía «Albergue Los…»).
  const tiles = (list: RoomOption[]) => {
    const groups: { venue: string; list: RoomOption[] }[] = [];
    for (const o of list) {
      const g = groups.at(-1);
      if (g && g.venue === o.use.room.venue) g.list.push(o);
      else groups.push({ venue: o.use.room.venue, list: [o] });
    }
    return groups.map((g, i) => (
      <View key={`${g.venue}-${i}`} style={styles.venue}>
        {many ? (
          <Text style={[styles.venueName, { color: t.textSecondary }]}>
            {g.venue}
          </Text>
        ) : null}
        <View style={styles.grid}>
          {g.list.map((o) => (
            <Tile
              key={o.use.room.id}
              o={o}
              many={many}
              width={tileWidth}
              onPick={() => pick(o.use.room.id)}
            />
          ))}
        </View>
      </View>
    ));
  };

  return (
    <View style={styles.body}>
      {target.subtitle || onOpenFicha ? (
        <View style={styles.headRow}>
          {target.subtitle ? (
            <Text style={[styles.subtitle, { color: t.textSecondary }]}>
              {target.subtitle}
            </Text>
          ) : (
            <View style={styles.flex} />
          )}
          {onOpenFicha ? (
            <PressableFeedback
              onPress={() => {
                onClose();
                onOpenFicha(target);
              }}
              accessibilityRole="link"
              style={styles.link}
            >
              <Text style={[styles.linkText, { color: t.accentText }]}>
                Ver ficha
              </Text>
            </PressableFeedback>
          ) : null}
        </View>
      ) : null}
      {detail.rooms.length > 9 ? (
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Buscar habitación (101, P1…)"
        />
      ) : null}
      <ScrollView
        style={{ maxHeight: height * LIST_MAX_SHARE }}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        {opts.length === 0 ? (
          <Text style={[styles.empty, { color: t.textSecondary }]}>
            {query
              ? 'Ninguna habitación se llama así.'
              : 'Este evento no tiene habitaciones.'}
          </Text>
        ) : null}
        {lastOpt ? (
          <>
            <Label text="La de antes" />
            {tiles([lastOpt])}
          </>
        ) : null}
        {fit.length > 0 ? (
          <>
            <Label text={lastOpt ? 'Otras con hueco' : 'Con hueco'} />
            {tiles(fit)}
          </>
        ) : null}
        {full.length > 0 ? (
          fullOpen ? (
            <>
              <Label text="Llenas o pasadas" />
              {tiles(full)}
            </>
          ) : (
            <PressableFeedback
              onPress={() => {
                h.toggle();
                setShowFull(true);
              }}
              accessibilityRole="button"
              accessibilityState={{ expanded: false }}
              style={styles.link}
            >
              <Text style={[styles.linkText, { color: t.accentText }]}>
                {full.length === 1
                  ? 'Ver 1 llena o pasada'
                  : `Ver ${full.length} llenas o pasadas`}
              </Text>
            </PressableFeedback>
          )
        ) : null}
      </ScrollView>
      {anyRoom ? (
        <PressableFeedback
          onPress={() => {
            h.remove();
            pick(null);
          }}
          accessibilityRole="button"
          style={[styles.remove, { backgroundColor: t.card }]}
        >
          <IconSymbol name="xmark" size={16} color={t.dangerText} />
          <Text style={[styles.removeLabel, { color: t.dangerText }]}>
            {target.ids.length > 1
              ? 'Quitarles la habitación'
              : 'Quitar la habitación'}
          </Text>
          <PressableFeedback.Highlight />
        </PressableFeedback>
      ) : null}
    </View>
  );
}

function Label({ text }: { text: string }) {
  const t = useComunicaTheme();
  return (
    <Text
      accessibilityRole="header"
      style={[styles.label, { color: t.textSecondary }]}
    >
      {text}
    </Text>
  );
}

function Tile({
  o,
  many,
  width,
  onPick,
}: {
  o: RoomOption;
  many: boolean;
  width: number;
  onPick: () => void;
}) {
  const t = useComunicaTheme();
  const { room, taken, capacity, tone } = o.use;
  const ratio = capacity > 0 ? Math.min(1, taken / capacity) : taken ? 1 : 0;
  const floor = floorShort(room.floor);
  return (
    <PressableFeedback
      onPress={() => {
        h.select();
        onPick();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: o.current }}
      accessibilityLabel={roomOptionLabel(o, many)}
      style={[
        styles.tile,
        width > 0 && { width },
        {
          backgroundColor: t.card,
          borderColor: o.current ? t.accentText : t.cardBorder,
        },
      ]}
    >
      <View style={styles.tileHead}>
        <Text style={[styles.code, { color: t.text }]} numberOfLines={1}>
          {room.code}
        </Text>
        {o.current ? (
          <IconSymbol name="checkmark" size={14} color={t.accentText} />
        ) : null}
        <View style={styles.flex} />
        {floor ? (
          <Text style={[styles.small, { color: t.textSecondary }]}>
            {floor}
          </Text>
        ) : null}
      </View>
      <View style={[styles.track, { backgroundColor: t.disabledFill }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.round(ratio * 100)}%`,
              backgroundColor: ROOM_BAR[o.fits ? tone : 'over'],
            },
          ]}
        />
      </View>
      <Text
        style={[styles.small, { color: o.fits ? t.text : t.dangerText }]}
        numberOfLines={2}
      >
        <Text style={styles.bold}>
          {taken}/{capacity}
        </Text>{' '}
        · {o.fits ? freeLabel(o.use) : 'no cabe'}
      </Text>
      <PressableFeedback.Highlight />
    </PressableFeedback>
  );
}

/** El encabezado de una habitación para el subtítulo de la hoja. */
export const roomNow = (
  detail: ManagedEventDetail,
  roomId: string | undefined,
) => {
  const room = roomId ? detail.rooms.find((r) => r.id === roomId) : undefined;
  return room
    ? `Ahora: ${roomHeading(room, venuesOf(detail.rooms).length > 1)}`
    : 'Sin habitación';
};

const styles = StyleSheet.create({
  body: { gap: 12, paddingBottom: 8 },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: -4,
  },
  subtitle: { ...typography.subhead, flex: 1 },
  flex: { flex: 1 },
  list: { gap: 8, paddingBottom: 4 },
  label: { ...typography.sectionLabel, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  venue: { gap: 6 },
  venueName: { ...typography.caption, fontWeight: '600' },
  tile: {
    minHeight: 72,
    padding: 10,
    gap: 4,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  code: { ...typography.title, flexShrink: 1 },
  small: { ...typography.footnote },
  bold: { fontWeight: '700' },
  track: { height: 6, borderRadius: radii.xs, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radii.xs },
  empty: { ...typography.body, paddingVertical: 16 },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  linkText: { ...typography.button },
  remove: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  removeLabel: { ...typography.button },
});
