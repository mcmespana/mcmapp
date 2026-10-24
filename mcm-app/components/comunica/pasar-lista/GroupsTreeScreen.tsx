// El árbol de grupos de Pasar Lista (plan 04; `pages/single_stic_pasar_lista_grupos.php`).
// Primero tu grupo, luego MIC, COM, LC y Sin etapa. Cada fila: el código en
// negrita (el nombre solo si añade algo), «Mercedes · 1º ESO · 10 chavalines»
// y el círculo de la última sesión celebrada. Buscador desde 8 grupos.

import React, { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import EmptyState from '@/components/ui/EmptyState';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { comunicaNow } from '@/services/comunica';
import type { GroupWithMonitors } from '@/services/comunica/contract';
import { useGroups, useToday } from '@/hooks/comunica/usePasarLista';
import { useOutbox } from '@/hooks/comunica/useOutbox';
import { useOpenLegacy } from '@/hooks/comunica/useOpenLegacy';
import { foldForSearch } from '@/utils/songTags';
import { groupTitle, participantsLabel } from '@/utils/comunica/marks';
import {
  compareGroups,
  groupsInSection,
  rollIndex,
  rollKey,
  sectionLabel,
  sectionStage,
  sessionsForGroup,
} from '@/utils/comunica/pasarLista';
import { lastHeld } from '@/utils/comunica/sessions';
import AreaScreen from '../comun/AreaScreen';
import AreaState from '../comun/AreaState';
import Section from '../comun/Section';
import { STAGE_COLOR } from '../comun/theme';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import RollStateDot, { RollStateLegend, type DotState } from './RollStateDot';

/** Desde cuántos grupos sale el buscador. */
const SEARCH_FROM = 8;

const STAGE_SECTIONS: { title: string; stage: GroupWithMonitors['stage'] }[] = [
  { title: 'MIC', stage: 'mic' },
  { title: 'COM', stage: 'com' },
  { title: 'LC', stage: 'lc' },
  { title: 'Apoyo', stage: 'apoyo' },
  { title: 'Sin etapa', stage: null },
];

export default function GroupsTreeScreen({ section }: { section?: string }) {
  const groups = useGroups();
  const today = useToday();
  const t = useComunicaTheme();
  const title = section ? sectionLabel(section) : 'Pasar lista';
  return (
    <>
      <Stack.Screen options={{ title, headerLargeTitle: false }} />
      <AreaState
        query={groups}
        skeleton="list"
        empty={{
          title: 'No hay grupos de tu delegación en este curso.',
          subtitle: 'Si crees que es un error, avisa a coordinación.',
          isEmpty: (d) => d.groups.length === 0,
        }}
      >
        {(g) => (
          <Tree
            data={g}
            rollCalls={today.data?.rollCalls ?? []}
            section={section}
            refetch={() => Promise.all([groups.refetch(), today.refetch()])}
            dotColor={section ? sectionDot(section) : t.textMuted}
          />
        )}
      </AreaState>
    </>
  );
}

const sectionDot = (section: string) => {
  const stage = sectionStage(section);
  return stage ? STAGE_COLOR[stage] : undefined;
};

function Tree({
  data,
  rollCalls,
  section,
  refetch,
  dotColor,
}: {
  data: NonNullable<ReturnType<typeof useGroups>['data']>;
  rollCalls: NonNullable<ReturnType<typeof useToday>['data']>['rollCalls'];
  section?: string;
  refetch: () => Promise<unknown>;
  dotColor?: string;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const openLegacy = useOpenLegacy();
  const { pending } = useOutbox();
  const [query, setQuery] = useState('');
  const now = comunicaNow();

  const inSection = useMemo(
    () => groupsInSection(data.groups, section).sort(compareGroups),
    [data.groups, section],
  );
  const filtered = useMemo(() => {
    const q = foldForSearch(query.trim());
    if (!q) return inSection;
    return inSection.filter((g) =>
      foldForSearch(
        [g.code, g.name, ...g.monitorNames, ...g.schoolLevels].join(' '),
      ).includes(q),
    );
  }, [inSection, query]);

  const index = useMemo(() => rollIndex(rollCalls), [rollCalls]);
  const queued = useMemo(
    () =>
      new Set(
        pending
          .filter((e) => e.kind === 'roll')
          .map((e) => `${e.meta.sessionId}:${e.meta.groupId}`),
      ),
    [pending],
  );
  const stateOf = (g: GroupWithMonitors): DotState | null => {
    const s = lastHeld(sessionsForGroup(g, data.stageEvents), now);
    if (!s) return null;
    const k = rollKey(s.id, g.id);
    if (queued.has(k)) return 'queued';
    const r = index.get(k);
    return r ? r.status : 'missing';
  };

  const mine = filtered.filter((g) => data.myGroupIds.includes(g.id));
  const rest = filtered.filter((g) => !data.myGroupIds.includes(g.id));
  const showSearch = inSection.length >= SEARCH_FROM;

  const row = (g: GroupWithMonitors) => {
    const gt = groupTitle(g);
    const state = stateOf(g);
    const sub = [
      g.monitorNames.map((n) => n.split(' ')[0]).join(', '),
      g.schoolLevels.join(', '),
      participantsLabel(g.counts.participants),
    ]
      .filter(Boolean)
      .join(' · ');
    return (
      <PressableFeedback
        key={g.id}
        onPress={() =>
          router.push({
            pathname: '/comunica/pasar-lista/[groupId]',
            params: { groupId: g.id },
          })
        }
        accessibilityRole="button"
        accessibilityLabel={[
          gt.code,
          gt.name,
          sub,
          state
            ? `Última sesión: ${state === 'taken' ? 'pasada' : state === 'skipped' ? 'sin registro' : state === 'queued' ? 'pendiente de subir' : 'pendiente'}`
            : null,
        ]
          .filter(Boolean)
          .join(', ')}
        style={styles.row}
      >
        <PressableFeedback.Highlight />
        <View style={styles.rowBody}>
          <Text style={[styles.rowTitle, { color: t.text }]} numberOfLines={1}>
            {gt.code ? <Text style={styles.code}>{gt.code}</Text> : null}
            {gt.code && gt.name ? ' · ' : null}
            {gt.name}
          </Text>
          <Text
            style={[styles.rowSub, { color: t.textSecondary }]}
            numberOfLines={2}
          >
            {sub}
          </Text>
        </View>
        {state ? <RollStateDot state={state} /> : null}
        <IconSymbol name="chevron.right" size={16} color={t.textMuted} />
      </PressableFeedback>
    );
  };

  return (
    <AreaScreen onRefresh={refetch}>
      <View style={styles.head}>
        {section && dotColor ? (
          <View style={styles.sectionLine}>
            <View style={[styles.dot, { backgroundColor: dotColor }]} />
            <Text style={[styles.sub, { color: t.textSecondary }]}>
              {inSection.length === 1
                ? '1 grupo'
                : `${inSection.length} grupos`}
            </Text>
          </View>
        ) : (
          <Text style={[styles.sub, { color: t.textSecondary }]}>
            Curso {data.season}
          </Text>
        )}
        <RollStateLegend />
      </View>

      {showSearch ? (
        <View style={[styles.search, { backgroundColor: t.card }]}>
          <IconSymbol name="magnifyingglass" size={16} color={t.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar grupo, monitor o curso…"
            placeholderTextColor={t.textMuted}
            accessibilityLabel="Buscar grupo, monitor o curso"
            autoCorrect={false}
            clearButtonMode="while-editing"
            style={[styles.searchInput, { color: t.text }]}
            {...(Platform.OS === 'web'
              ? {}
              : { returnKeyType: 'search' as const })}
          />
        </View>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          icon="search-off"
          title="Ningún grupo coincide con lo que buscas."
          titleColor={t.text}
          compact
        />
      ) : null}

      {mine.length > 0 ? (
        <Section title={mine.length === 1 ? 'Tu grupo' : 'Tus grupos'}>
          {mine.map(row)}
        </Section>
      ) : null}

      {section
        ? rest.length > 0 && <Section>{rest.map(row)}</Section>
        : STAGE_SECTIONS.map((s) => {
            const list = rest.filter((g) => g.stage === s.stage);
            if (list.length === 0) return null;
            return (
              <Section key={s.title} title={s.title}>
                {list.map(row)}
              </Section>
            );
          })}

      <View style={styles.foot}>
        {data.participantsWithoutGroup > 0 ? (
          <Text style={[styles.sub, { color: t.textSecondary }]}>
            {data.participantsWithoutGroup === 1
              ? '1 participante sin grupo asignado'
              : `${data.participantsWithoutGroup} participantes sin grupo asignado`}{' '}
            · No aparecen en ninguna lista
          </Text>
        ) : null}
        <PressableFeedback
          onPress={() => router.push('/comunica/grupos')}
          accessibilityRole="link"
          hitSlop={8}
        >
          <Text style={[styles.sub, { color: t.textSecondary }]}>
            ¿Solo quieres mirar las fichas? Están en{' '}
            <Text style={{ color: t.accentText, fontWeight: '600' }}>
              Grupos y fichas
            </Text>
          </Text>
        </PressableFeedback>
        {data.hiddenGroups > 0 ? (
          <PressableFeedback
            onPress={() =>
              void openLegacy(
                { internalpage: 'single_stic_pasar_lista_grupos' },
                'Pasar lista',
              )
            }
            accessibilityRole="link"
            hitSlop={8}
          >
            <Text style={[styles.sub, { color: t.textSecondary }]}>
              {data.hiddenGroups} grupos más en el CRM sin marcar para Pasar
              Lista.
            </Text>
          </PressableFeedback>
        ) : null}
      </View>
    </AreaScreen>
  );
}

const styles = StyleSheet.create({
  head: { gap: 8 },
  sectionLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: radii.pillFull },
  sub: { ...typography.caption },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    minHeight: 44,
  },
  searchInput: { ...typography.body, flex: 1, paddingVertical: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { ...typography.body },
  code: { fontWeight: '800' },
  rowSub: { ...typography.caption },
  foot: { gap: 10, alignItems: 'center' },
});
