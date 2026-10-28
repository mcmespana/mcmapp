// «Grupos y fichas» (plan 05; `pages/single_stic_mis_grupos.php` del plugin):
// la gente de la delegación sin pasar lista, en tres vistas —Grupos, Cursos y
// A-Z— con buscador, fotos y marcas. Es de los CHAVALES: los monitores solo
// salen dentro de un grupo.
//
//   · Grupos: «Tus grupos» primero, luego MIC, COM, LC y «Sin etapa»; al
//     final, solo si hay alguien, la tarjeta ámbar de los sueltos.
//   · Cursos y A-Z: TODOS los participantes vigentes, con grupo o sin él, con
//     chips pegados arriba («Todos», uno por curso, «Sin grupo») que se
//     combinan con el buscador. A coordinación, el interruptor «Asignar
//     grupos» pone «Vincular» en cada suelto.
//
// Una sola `FlatList` para las tres (trescientas filas no caben en un
// ScrollView), con los chips como cabecera pegada.

import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Stack, useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import EmptyState from '@/components/ui/EmptyState';
import { IconSymbol } from '@/components/ui/IconSymbol';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { useTabListScroll } from '@/components/tabs/useTabScroll';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import type {
  GroupWithMonitors,
  ParticipantRow,
} from '@/services/comunica/contract';
import { useMe } from '@/hooks/comunica/useMe';
import { useGroups } from '@/hooks/comunica/usePasarLista';
import { useOpenLegacy } from '@/hooks/comunica/useOpenLegacy';
import { useOutbox } from '@/hooks/comunica/useOutbox';
import { usePeople, usePrefetchMyFichas } from '@/hooks/comunica/useGrupos';
import { h } from '@/utils/haptics';
import {
  ageLabel,
  compareByLastName,
  courseChips,
  courseSections,
  filterPeople,
  groupMatches,
  groupMetaLine,
  groupSections,
  groupShort,
  groupsCountLabel,
  chavalinesLabel,
  personLine,
  personsLabel,
  toggleChip,
  withPendingGroups,
  type ChipKey,
} from '@/utils/comunica/people';
import { groupTitle } from '@/utils/comunica/marks';
import { levelDotOpacity } from '@/utils/comunica/schoolLevels';
import AreaScreen from '../comun/AreaScreen';
import AreaState, { isNetwork, OfflineNotice } from '../comun/AreaState';
import AreaSwitch from '../comun/AreaSwitch';
import DelegationSwitcher from '../comun/DelegationSwitcher';
import FilterChips from '../comun/FilterChips';
import PersonMarks, { marksA11y } from '../comun/PersonMarks';
import PersonRow from '../comun/PersonRow';
import SearchField from '../comun/SearchField';
import SyncBadge from '../comun/SyncBadge';
import UploadStatus, { type UploadState } from '../comun/UploadStatus';
import { STAGE_COLOR } from '../comun/theme';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import AssignSheet from './AssignSheet';
import HealthSheet from './HealthSheet';
import ListCell, { cellPosition, type CellPosition } from './ListCell';
import { useAssignPreference } from './useAssignPreference';
import {
  ASSIGN_FORBIDDEN,
  CLOSED_SEASON,
  NOT_COORDINATION_ASSIGN,
  SEARCH_EMPTY,
} from './copy';

export type GruposView = 'groups' | 'courses' | 'az';

const VIEWS: { value: GruposView; label: string }[] = [
  { value: 'groups', label: 'Grupos' },
  { value: 'courses', label: 'Cursos' },
  { value: 'az', label: 'A-Z' },
];

export default function GruposIndexScreen({ view }: { view: GruposView }) {
  const groups = useGroups();
  const people = usePeople();
  usePrefetchMyFichas(true);
  const main: {
    data: unknown;
    error: unknown;
    isPending: boolean;
    refetch: () => unknown;
  } = view === 'groups' ? groups : people;
  // Sin datos todavía (cargando, error, sin acceso), los estados van dentro
  // de `AreaScreen`: así respetan la cabecera transparente de iOS. Con datos,
  // la lista; si además falla la red, el aviso va DENTRO de la lista.
  return (
    <>
      <Stack.Screen
        options={{ title: 'Grupos y fichas', headerLargeTitle: false }}
      />
      {main.data === undefined ? (
        <AreaScreen onRefresh={async () => main.refetch()}>
          <DelegationSwitcher />
          <AreaState
            query={main}
            skeleton={view === 'groups' ? 'cards' : 'list'}
          >
            {() => null}
          </AreaState>
        </AreaScreen>
      ) : (
        <IndexList
          key={view}
          view={view}
          offline={!!main.error && isNetwork(main.error)}
        />
      )}
    </>
  );
}

type Item =
  | { kind: 'controls'; key: string }
  | { kind: 'chips'; key: string }
  | { kind: 'assignHint'; key: string; loose: number }
  | { kind: 'closed'; key: string }
  | { kind: 'empty'; key: string; text: string }
  | {
      kind: 'title';
      key: string;
      title: string;
      count?: string;
      dot?: { color: string; opacity: number } | null;
      muted?: boolean;
    }
  | {
      kind: 'group';
      key: string;
      group: GroupWithMonitors;
      mine: boolean;
      position: CellPosition;
    }
  | {
      kind: 'person';
      key: string;
      person: ParticipantRow;
      position: CellPosition;
    }
  | { kind: 'loose'; key: string; count: number }
  | { kind: 'footer'; key: string };

function IndexList({ view, offline }: { view: GruposView; offline: boolean }) {
  const t = useComunicaTheme();
  const router = useRouter();
  const openLegacy = useOpenLegacy();
  const groupsQ = useGroups();
  const peopleQ = usePeople();
  const { me, isCoordination } = useMe();
  const { entries, outbox } = useOutbox();
  const { listRef, onScroll, contentPaddingBottom } =
    useTabListScroll<Animated.FlatList<Item>>('comunica');
  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<ChipKey>('all');
  const [assignOn, setAssignOn] = useAssignPreference();
  const [assignFor, setAssignFor] = useState<ParticipantRow | null>(null);
  const [healthFor, setHealthFor] = useState<ParticipantRow | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const groupsData = groupsQ.data;
  const peopleData = peopleQ.data;
  const canSeeHealth = !!me?.canSeeHealth;

  // Lo vinculado en la cola: la fila pasa a su grupo al momento.
  const assignByPerson = useMemo(
    () =>
      new Map(
        entries
          .filter((e) => e.kind === 'membership-group')
          .map((e) => [e.meta.personId, e] as const),
      ),
    [entries],
  );
  const allPeople = useMemo(() => {
    const pending = new Map<string, string>();
    for (const e of assignByPerson.values()) {
      if (e.status !== 'failed' && e.status !== 'stuck') {
        pending.set(e.meta.membershipId, e.meta.groupId);
      }
    }
    return withPendingGroups(peopleData?.people ?? [], pending);
  }, [peopleData, assignByPerson]);

  const groupById = useMemo(
    () => new Map((groupsData?.groups ?? []).map((g) => [g.id, g])),
    [groupsData],
  );
  const codeOf = useCallback(
    (gid: string | null) => {
      const g = gid ? groupById.get(gid) : undefined;
      return g ? groupShort(g) : null;
    },
    [groupById],
  );
  const line = useCallback(
    (p: ParticipantRow) => personLine(p, codeOf(p.groupId)),
    [codeOf],
  );
  const looseCount = peopleData
    ? allPeople.filter((p) => !p.groupId).length
    : (groupsData?.participantsWithoutGroup ?? 0);

  const data = useMemo((): Item[] => {
    const items: Item[] = [{ kind: 'controls', key: 'controls' }];
    if (view === 'groups') {
      if (peopleData?.seasonClosed)
        items.push({ kind: 'closed', key: 'closed' });
      const filtered = (groupsData?.groups ?? []).filter((g) =>
        groupMatches(g, query),
      );
      const sections = groupSections(filtered, groupsData?.myGroupIds ?? []);
      for (const s of sections) {
        if (s.title) {
          items.push({
            kind: 'title',
            key: `t-${s.key}`,
            title: s.title,
            count: groupsCountLabel(s.groups.length),
            dot:
              s.stage && s.stage !== 'mine'
                ? { color: STAGE_COLOR[s.stage], opacity: 1 }
                : null,
          });
        }
        s.groups.forEach((g, i) =>
          items.push({
            kind: 'group',
            key: g.id,
            group: g,
            mine: s.stage === 'mine',
            position: cellPosition(i, s.groups.length),
          }),
        );
      }
      if ((groupsData?.groups.length ?? 0) === 0) {
        items.push({
          kind: 'empty',
          key: 'empty',
          text: 'No hay grupos de tu delegación en este curso. Si crees que es un error, avisa a coordinación.',
        });
      } else if (filtered.length === 0) {
        items.push({ kind: 'empty', key: 'empty', text: SEARCH_EMPTY });
      }
      if (looseCount > 0 && !query.trim()) {
        items.push({ kind: 'loose', key: 'loose', count: looseCount });
      }
      items.push({ kind: 'footer', key: 'footer' });
      return items;
    }

    // Cursos y A-Z.
    if (courseChips(allPeople)) items.push({ kind: 'chips', key: 'chips' });
    if (looseCount > 0) {
      items.push({ kind: 'assignHint', key: 'assign', loose: looseCount });
    }
    if (peopleData?.seasonClosed) {
      items.push({ kind: 'closed', key: 'closed' });
    } else if (allPeople.length === 0) {
      items.push({
        kind: 'empty',
        key: 'empty',
        text: 'No hay participantes con relación vigente en tu delegación.',
      });
    }
    const filtered = filterPeople(allPeople, line, { chip, query });
    if (allPeople.length > 0 && filtered.length === 0) {
      items.push({ kind: 'empty', key: 'empty-q', text: SEARCH_EMPTY });
    }
    if (view === 'courses') {
      for (const s of courseSections(filtered)) {
        items.push({
          kind: 'title',
          key: `t-${s.key}`,
          title: s.title,
          count: chavalinesLabel(s.people.length),
          dot:
            s.weight !== null
              ? { color: t.accentText, opacity: levelDotOpacity(s.weight) }
              : { color: t.separator, opacity: 1 },
          muted: s.muted,
        });
        s.people.forEach((p, i) =>
          items.push({
            kind: 'person',
            key: p.id,
            person: p,
            position: cellPosition(i, s.people.length),
          }),
        );
      }
    } else {
      const sorted = [...filtered].sort(compareByLastName);
      sorted.forEach((p, i) =>
        items.push({
          kind: 'person',
          key: p.id,
          person: p,
          position: cellPosition(i, sorted.length),
        }),
      );
    }
    items.push({ kind: 'footer', key: 'footer' });
    return items;
  }, [
    view,
    groupsData,
    peopleData,
    allPeople,
    query,
    chip,
    line,
    looseCount,
    t.accentText,
    t.separator,
  ]);

  const stickyIndex = data.findIndex((i) => i.kind === 'chips');
  const chips = useMemo(() => courseChips(allPeople), [allPeople]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([groupsQ.refetch(), peopleQ.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const openFicha = (p: ParticipantRow) =>
    router.push({
      pathname: '/comunica/grupos/persona/[personId]',
      params: {
        personId: p.id,
        ...(p.groupId ? { groupId: p.groupId } : {}),
        from: view,
      },
    });

  const canAssign = (p: ParticipantRow) =>
    isCoordination && assignOn && !p.groupId && !!p.unassignedMembershipId;

  const renderItem = ({ item }: { item: Item }) => {
    switch (item.kind) {
      case 'controls':
        return (
          <View style={styles.controls}>
            <DelegationSwitcher />
            {offline ? <OfflineNotice /> : null}
            <SegmentedControl
              options={VIEWS}
              value={view}
              onChange={(v) => router.setParams({ view: v })}
              accentColor={t.accentFill}
            />
            {groupsData ? (
              <Text style={[styles.caption, { color: t.textSecondary }]}>
                Curso {groupsData.season}
              </Text>
            ) : null}
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder={
                view === 'groups'
                  ? groupsData?.groups.some((g) => g.monitorNames.length)
                    ? 'Buscar grupo, monitor o curso…'
                    : 'Buscar grupo o curso…'
                  : 'Buscar por nombre…'
              }
            />
          </View>
        );
      case 'chips':
        return chips ? (
          <FilterChips
            chips={chips}
            value={chip}
            label="Filtrar por curso"
            onChange={(k) => {
              setChip((cur) => toggleChip(cur, k));
              listRef.current?.scrollToOffset({ offset: 0, animated: true });
            }}
          />
        ) : null;
      case 'assignHint':
        return (
          <View style={[styles.hint, { backgroundColor: t.warningSoft }]}>
            <View style={styles.hintRow}>
              <IconSymbol name="person.2" size={18} color={t.warningIcon} />
              <Text style={[styles.hintText, { color: t.warningText }]}>
                {item.loose === 1
                  ? '1 sin grupo todavía: no sale en ninguna lista.'
                  : `${item.loose} sin grupo todavía: no salen en ninguna lista.`}
                {isCoordination ? '' : ` ${NOT_COORDINATION_ASSIGN}`}
              </Text>
            </View>
            {isCoordination ? (
              <View style={styles.switchRow}>
                <Text style={[styles.switchLabel, { color: t.text }]}>
                  Asignar grupos
                </Text>
                <AreaSwitch
                  value={assignOn}
                  onChange={setAssignOn}
                  label="Asignar grupos"
                />
              </View>
            ) : null}
          </View>
        );
      case 'closed':
        return (
          <View style={[styles.hint, { backgroundColor: t.warningSoft }]}>
            <Text style={[styles.hintText, { color: t.warningText }]}>
              {CLOSED_SEASON}
            </Text>
          </View>
        );
      case 'empty':
        return (
          <EmptyState
            icon={item.text === SEARCH_EMPTY ? 'search-off' : 'inbox'}
            title={item.text}
            titleColor={t.text}
            compact
          />
        );
      case 'title':
        return (
          <View style={styles.title}>
            {item.dot ? (
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: item.dot.color,
                    opacity: item.dot.opacity,
                  },
                ]}
              />
            ) : null}
            <Text
              accessibilityRole="header"
              style={[
                styles.titleText,
                { color: item.muted ? t.textMuted : t.text },
              ]}
            >
              {item.title}
            </Text>
            {item.count ? (
              <Text style={[styles.caption, { color: t.textSecondary }]}>
                {item.count}
              </Text>
            ) : null}
          </View>
        );
      case 'group': {
        const gt = groupTitle(item.group);
        const meta = groupMetaLine(item.group, item.mine);
        return (
          <ListCell position={item.position}>
            <PressableFeedback
              onPress={() =>
                router.push({
                  pathname: '/comunica/grupos/[groupId]',
                  params: { groupId: item.group.id },
                })
              }
              accessibilityRole="button"
              accessibilityLabel={[gt.code, gt.name, meta]
                .filter(Boolean)
                .join(', ')}
              style={styles.groupRow}
            >
              <PressableFeedback.Highlight />
              <View style={styles.groupBody}>
                <Text
                  style={[styles.groupTitle, { color: t.text }]}
                  numberOfLines={1}
                >
                  {gt.code ? <Text style={styles.code}>{gt.code}</Text> : null}
                  {gt.code && gt.name ? ' · ' : null}
                  {gt.name}
                </Text>
                {meta ? (
                  <Text
                    style={[styles.caption, { color: t.textSecondary }]}
                    numberOfLines={2}
                  >
                    {meta}
                  </Text>
                ) : null}
              </View>
              <IconSymbol name="chevron.right" size={16} color={t.textMuted} />
            </PressableFeedback>
          </ListCell>
        );
      }
      case 'person': {
        const p = item.person;
        const entry = assignByPerson.get(p.id);
        const assignable = canAssign(p);
        return (
          <ListCell position={item.position}>
            <PersonRow
              person={p}
              subtitleLead={
                p.groupId
                  ? undefined
                  : {
                      text: 'Sin grupo',
                      color: t.chip('warning').text,
                      background: t.chip('warning').background,
                    }
              }
              subtitle={
                p.groupId
                  ? line(p)
                  : [p.schoolLevel?.label, ageLabel(p.age)]
                      .filter(Boolean)
                      .join(' · ')
              }
              marksLabel={marksA11y(p.badges)}
              below={
                <>
                  <PersonMarks
                    badges={p.badges}
                    onHealth={canSeeHealth ? () => setHealthFor(p) : undefined}
                  />
                  {entry ? (
                    <View style={styles.upload}>
                      <UploadStatus
                        state={entry.status as UploadState}
                        onRetry={() => void outbox?.retry(entry.key)}
                      />
                      {entry.status === 'failed' &&
                      entry.error?.code === 'forbidden' ? (
                        <Text
                          style={[styles.caption, { color: t.warningText }]}
                        >
                          {ASSIGN_FORBIDDEN}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </>
              }
              onPress={() => openFicha(p)}
              accessibilityHint="Abre su ficha"
              accessibilityActions={[
                ...(p.badges.healthNote && canSeeHealth
                  ? [{ name: 'health', label: 'Ver la salud' }]
                  : []),
                ...(assignable
                  ? [{ name: 'assign', label: 'Vincular a un grupo' }]
                  : []),
              ]}
              onAccessibilityAction={(name) =>
                name === 'health' ? setHealthFor(p) : setAssignFor(p)
              }
              right={
                assignable && !entry ? (
                  <LinkButton
                    label="Vincular"
                    onPress={() => setAssignFor(p)}
                  />
                ) : (
                  <IconSymbol
                    name="chevron.right"
                    size={16}
                    color={t.textMuted}
                  />
                )
              }
            />
          </ListCell>
        );
      }
      case 'loose':
        return (
          <PressableFeedback
            onPress={() => router.push('/comunica/grupos/sin-grupo')}
            accessibilityRole="button"
            style={[styles.looseCard, { backgroundColor: t.warningSoft }]}
          >
            <PressableFeedback.Highlight />
            <IconSymbol name="person.2" size={22} color={t.warningIcon} />
            <View style={styles.groupBody}>
              <Text
                style={[
                  styles.groupTitle,
                  styles.bold,
                  { color: t.warningText },
                ]}
              >
                {personsLabel(item.count)} sin grupo
              </Text>
              <Text style={[styles.caption, { color: t.warningText }]}>
                {isCoordination
                  ? 'No salen en ninguna lista. Vincúlalas aquí.'
                  : 'No salen en ninguna lista'}
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={16} color={t.warningIcon} />
          </PressableFeedback>
        );
      case 'footer':
        return (
          <View style={styles.footer}>
            {view === 'groups' && (groupsData?.hiddenGroups ?? 0) > 0 ? (
              <PressableFeedback
                onPress={() =>
                  void openLegacy(
                    { internalpage: 'single_stic_mis_grupos' },
                    'Grupos y fichas',
                  )
                }
                accessibilityRole="link"
                hitSlop={8}
              >
                <Text
                  style={[
                    styles.caption,
                    styles.center,
                    { color: t.textSecondary },
                  ]}
                >
                  {groupsData!.hiddenGroups === 1
                    ? '1 grupo más en el CRM sin marcar para Pasar Lista.'
                    : `${groupsData!.hiddenGroups} grupos más en el CRM sin marcar para Pasar Lista.`}
                </Text>
              </PressableFeedback>
            ) : null}
            <SyncBadge
              generatedAt={
                view === 'groups' ? groupsQ.generatedAt : peopleQ.generatedAt
              }
            />
          </View>
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
        stickyHeaderIndices={stickyIndex >= 0 ? [stickyIndex] : undefined}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={24}
        contentContainerStyle={{ paddingBottom: contentPaddingBottom + 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={t.textSecondary}
          />
        }
      />
      <AssignSheet
        person={assignFor}
        groups={groupsData?.groups ?? []}
        onClose={() => setAssignFor(null)}
      />
      <HealthSheet person={healthFor} onClose={() => setHealthFor(null)} />
    </View>
  );
}

export function LinkButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const t = useComunicaTheme();
  return (
    <PressableFeedback
      onPress={() => {
        h.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.linkButton, { borderColor: t.accentText }]}
    >
      <Text style={[styles.linkLabel, { color: t.accentText }]}>{label}</Text>
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  controls: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
  },
  caption: { ...typography.caption },
  center: { textAlign: 'center' },
  hint: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: radii.md,
    gap: 8,
  },
  hintRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  hintText: { ...typography.subhead, flex: 1 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  switchLabel: { ...typography.body, fontWeight: '600' },
  title: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  dot: { width: 10, height: 10, borderRadius: radii.pillFull },
  titleText: { ...typography.subhead, fontWeight: '700', flex: 1 },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  groupBody: { flex: 1, gap: 2 },
  groupTitle: { ...typography.body },
  bold: { fontWeight: '700' },
  code: { fontWeight: '800' },
  upload: { gap: 2, marginTop: 4 },
  looseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 24,
    padding: 16,
    borderRadius: radii.lg,
    minHeight: 64,
  },
  footer: {
    gap: 10,
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 16,
  },
  linkButton: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    borderWidth: 1,
    justifyContent: 'center',
  },
  linkLabel: { ...typography.subhead, fontWeight: '600' },
});
