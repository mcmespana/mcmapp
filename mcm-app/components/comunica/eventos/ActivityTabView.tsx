// Una pestaña de grupos de actividad (plan 07; `sticpa_gac_vista_html`):
// «¿en qué habitación está Lucía?». SOLO LECTURA: aquí no se marca a nadie
// (los grupos los crea y reparte Comunica Tools).
//
//   · «4 grupos · 32 personas» y «Pasar lista por patrullas» (la acción
//     principal: la misma lista del día, partida por estos grupos).
//   · Cada grupo con su nombre y «7/8 plazas» (en aviso si se pasa) o su
//     número; monitores arriba como «Monitor/a» (solo en grupos «con
//     monitor»), luego participantes. Vacío: «Nadie todavía»; con gente,
//     «Pasar lista de este grupo». «Sin patrulla» al final.
//   · Buscador: «Lucía» la deja bajo su grupo; «patrulla 3» deja ese grupo.
//   · Con grupo de los sábados, la fila abre su ficha; si no, quieta.

import React, { useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import EmptyState from '@/components/ui/EmptyState';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useTabListScroll } from '@/components/tabs/useTabScroll';
import typography from '@/constants/typography';
import { comunicaNow } from '@/services/comunica';
import type {
  ActivityTab,
  EventPerson,
  EventRoll,
} from '@/services/comunica/contract';
import { h } from '@/utils/haptics';
import {
  armTab,
  groupCount,
  groupHeading,
  rollByLabel,
  tabSummary,
  withoutLabel,
  type TabPerson,
} from '@/utils/comunica/activityGroups';
import { fold } from '@/utils/comunica/events';
import { madridDay } from '@/utils/comunica/madrid';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';
import PersonRow from '../comun/PersonRow';
import SearchField from '../comun/SearchField';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import ListCell, { cellPosition, type CellPosition } from '../grupos/ListCell';

type Item =
  | { kind: 'head'; key: string }
  | {
      kind: 'group';
      key: string;
      title: string;
      count: string;
      over: boolean;
    }
  | {
      kind: 'person';
      key: string;
      person: TabPerson;
      monitor: boolean;
      position: CellPosition;
    }
  | { kind: 'nobody'; key: string; position: CellPosition }
  | {
      kind: 'rollGroup';
      key: string;
      groupId: string;
      position: CellPosition;
    }
  | { kind: 'empty'; key: string; text: string; search: boolean };

const asTabPerson = (p: EventPerson): TabPerson => ({
  key: p.person.id,
  name: `${p.person.firstName} ${p.person.lastName}`,
  person: p,
  markable: true,
  sortKey: '',
});

export default function ActivityTabView({
  roll,
  tab,
  head,
  onRefresh,
}: {
  roll: EventRoll;
  tab: ActivityTab;
  head: React.ReactNode;
  onRefresh: () => Promise<unknown>;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const { listRef, onScroll, contentPaddingBottom } =
    useTabListScroll<Animated.FlatList<Item>>('comunica');
  const armed = useMemo(() => armTab(roll, tab.key), [roll, tab.key]);
  const ended = roll.event.endDate < madridDay(comunicaNow());

  const data = useMemo((): Item[] => {
    const items: Item[] = [{ kind: 'head', key: 'head' }];
    if (!armed || armed.groups.length === 0) {
      items.push({
        kind: 'empty',
        key: 'none',
        text: 'Esta agrupación no tiene grupos.',
        search: false,
      });
      return items;
    }
    const q = fold(query);
    const hit = (p: TabPerson) =>
      fold(
        [
          p.name,
          p.person?.schoolLevel?.label,
          p.person?.homeGroup?.code,
          p.status,
        ]
          .filter(Boolean)
          .join(' '),
      ).includes(q);
    const blocks = [
      ...armed.groups.map((g) => ({
        id: g.group.id,
        title: groupHeading(g.group.type, g.group.name),
        count: groupCount(g),
        monitors: g.monitors,
        participants: g.participants,
        n: g.n,
        rollable: true,
      })),
      ...(armed.without.length > 0
        ? [
            {
              id: 'sin',
              title: withoutLabel(tab),
              count: { text: String(armed.without.length), over: false },
              monitors: [] as TabPerson[],
              participants: armed.without.map(asTabPerson),
              n: armed.without.length,
              rollable: false,
            },
          ]
        : []),
    ];
    let shown = 0;
    for (const b of blocks) {
      // «patrulla 3» deja el grupo entero; «Lucía», solo a Lucía.
      const whole = !q || fold(b.title).includes(q);
      const monitors = whole ? b.monitors : b.monitors.filter(hit);
      const participants = whole ? b.participants : b.participants.filter(hit);
      if (!whole && monitors.length + participants.length === 0) continue;
      shown += 1;
      items.push({
        kind: 'group',
        key: `g:${b.id}`,
        title: b.title,
        count: b.count.text,
        over: b.count.over,
      });
      const cells: Item[] = [
        ...monitors.map((p) => ({
          kind: 'person' as const,
          key: `m:${b.id}:${p.key}`,
          person: p,
          monitor: true,
          position: 'only' as CellPosition,
        })),
        ...participants.map((p) => ({
          kind: 'person' as const,
          key: `p:${b.id}:${p.key}`,
          person: p,
          monitor: false,
          position: 'only' as CellPosition,
        })),
      ];
      if (b.n === 0) {
        cells.push({ kind: 'nobody', key: `x:${b.id}`, position: 'only' });
      } else if (b.rollable && whole) {
        cells.push({
          kind: 'rollGroup',
          key: `l:${b.id}`,
          groupId: b.id,
          position: 'only',
        });
      }
      cells.forEach((c, i) => {
        if ('position' in c) c.position = cellPosition(i, cells.length);
      });
      items.push(...cells);
    }
    if (shown === 0) {
      items.push({
        kind: 'empty',
        key: 'empty-q',
        text: 'Nadie coincide con lo que buscas.',
        search: true,
      });
    }
    return items;
  }, [armed, query, tab]);

  const openRoll = (groupId?: string) =>
    router.push({
      pathname: '/comunica/eventos/[eventId]',
      params: {
        eventId: roll.event.id,
        view: 'list',
        by: tab.key,
        ...(groupId ? { group: groupId } : {}),
      },
    });

  const renderItem = ({ item }: { item: Item }) => {
    switch (item.kind) {
      case 'head':
        return (
          <View>
            {head}
            {armed && armed.groups.length > 0 ? (
              <View style={styles.block}>
                <Text style={[styles.summary, { color: t.text }]}>
                  {tabSummary(armed)}
                </Text>
                {ended ? (
                  <Text style={[styles.small, { color: t.textSecondary }]}>
                    El evento ya ha terminado: así quedaron los grupos.
                  </Text>
                ) : null}
                <AreaPrimaryButton
                  label={rollByLabel(tab)}
                  icon="checkmark"
                  onPress={() => openRoll()}
                />
                <SearchField
                  value={query}
                  onChange={setQuery}
                  placeholder="Buscar a alguien o un grupo…"
                />
              </View>
            ) : null}
          </View>
        );
      case 'group':
        return (
          <View style={styles.groupHead}>
            <Text
              accessibilityRole="header"
              style={[styles.groupTitle, { color: t.text }]}
              numberOfLines={2}
            >
              {item.title}
            </Text>
            {item.over ? (
              <IconSymbol
                name="exclamationmark.triangle.fill"
                size={14}
                color={t.warningIcon}
              />
            ) : null}
            <Text
              style={[
                styles.groupCount,
                { color: item.over ? t.warningText : t.textSecondary },
              ]}
              accessibilityLabel={
                item.over ? `${item.count}, pasada de cupo` : item.count
              }
            >
              {item.count}
            </Text>
          </View>
        );
      case 'person': {
        const p = item.person;
        const ep = p.person;
        const [first, ...rest] = p.name.split(' ');
        const person = ep?.person ?? {
          id: p.key,
          firstName: first,
          lastName: rest.join(' '),
          badges: { healthNote: false, noPhotos: false, notHomeAlone: false },
        };
        const sub = [
          item.monitor ? 'Monitor/a' : null,
          ep?.schoolLevel?.label,
          ep?.homeGroup?.code,
          p.status,
          !ep ? 'Sin inscripción' : null,
        ]
          .filter(Boolean)
          .join(' · ');
        const ficha = ep?.homeGroup;
        return (
          <ListCell position={item.position}>
            <PersonRow
              person={person}
              subtitle={sub || undefined}
              avatarTone={item.monitor ? 'accent' : undefined}
              onPress={
                ficha
                  ? () =>
                      router.push({
                        pathname: '/comunica/grupos/persona/[personId]',
                        params: { personId: person.id, groupId: ficha.id },
                      })
                  : undefined
              }
              accessibilityHint={ficha ? 'Abre su ficha' : undefined}
              right={
                ficha ? (
                  <IconSymbol
                    name="chevron.right"
                    size={16}
                    color={t.textMuted}
                  />
                ) : undefined
              }
            />
          </ListCell>
        );
      }
      case 'nobody':
        return (
          <ListCell position={item.position}>
            <Text style={[styles.cellText, { color: t.textSecondary }]}>
              Nadie todavía
            </Text>
          </ListCell>
        );
      case 'rollGroup':
        return (
          <ListCell position={item.position}>
            <PressableFeedback
              onPress={() => {
                h.tap();
                openRoll(item.groupId);
              }}
              accessibilityRole="button"
              style={styles.linkRow}
            >
              <PressableFeedback.Highlight />
              <Text style={[styles.link, { color: t.accentText }]}>
                Pasar lista de este grupo
              </Text>
              <IconSymbol name="chevron.right" size={16} color={t.accentText} />
            </PressableFeedback>
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
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: t.backgroundSunken }]}>
      <Animated.FlatList
        ref={listRef}
        data={data}
        keyExtractor={(i) => i.key}
        renderItem={renderItem}
        onScroll={onScroll}
        scrollEventThrottle={16}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  block: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  summary: { ...typography.body, fontWeight: '600' },
  small: { ...typography.caption },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 6,
  },
  groupTitle: { ...typography.title, flexShrink: 1 },
  groupCount: { ...typography.subhead, fontWeight: '600' },
  cellText: { ...typography.body, padding: 16 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  link: { ...typography.button },
});
