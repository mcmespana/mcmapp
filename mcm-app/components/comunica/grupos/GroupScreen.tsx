// La gente de un grupo (plan 05, regla 10; `mis_grupos.php` l.264-354):
// «C1 · Los Peques», su línea, «Buscar por nombre…», el chip «¿Quién no puede
// salir en fotos? N» (solo si N > 0), «Monitores» arriba —sin marcas— y
// «Participantes» debajo. Los chavales salen al instante desde `people`
// mientras llega el grupo; los monitores, en esqueleto.

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { PressableFeedback, Skeleton } from 'heroui-native';
import EmptyState from '@/components/ui/EmptyState';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import type { ParticipantRow } from '@/services/comunica/contract';
import { isComunicaApiError } from '@/services/comunica/client';
import { useGroupDetail } from '@/hooks/comunica/useGrupos';
import { useMe } from '@/hooks/comunica/useMe';
import { h } from '@/utils/haptics';
import { groupLabel } from '@/utils/comunica/marks';
import {
  ageLabel,
  filterPeople,
  groupMetaLine,
  noPhotosCount,
} from '@/utils/comunica/people';
import AreaScreen from '../comun/AreaScreen';
import AreaState from '../comun/AreaState';
import PersonAvatar from '../comun/PersonAvatar';
import PersonMarks, { marksA11y } from '../comun/PersonMarks';
import PersonRow from '../comun/PersonRow';
import Section from '../comun/Section';
import SyncBadge from '../comun/SyncBadge';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import { SearchField } from './GruposIndexScreen';
import HealthSheet from './HealthSheet';
import { SEARCH_EMPTY } from './copy';

/** «1 ESO · 13 años»: dentro de un grupo, el código sobra. */
const line = (p: ParticipantRow) =>
  [p.schoolLevel?.label, ageLabel(p.age)].filter(Boolean).join(' · ');

export default function GroupScreen({ groupId }: { groupId: string }) {
  const q = useGroupDetail(groupId);
  const t = useComunicaTheme();
  const title = q.data ? groupLabel(q.data.group) : 'Grupo';
  const forbidden = isComunicaApiError(q.error) && q.error.code === 'forbidden';
  // Los estados, dentro de `AreaScreen` (cabecera de iOS y barra flotante).
  return (
    <>
      <Stack.Screen options={{ title, headerLargeTitle: false }} />
      <AreaScreen onRefresh={() => q.refetch()}>
        {forbidden ? (
          <EmptyState
            icon="lock"
            title="No tienes acceso a este grupo."
            titleColor={t.text}
          />
        ) : (
          <AreaState query={q} skeleton="list">
            {(d) => (
              <Body
                data={d}
                placeholder={q.isPlaceholderData}
                generatedAt={q.isPlaceholderData ? null : q.generatedAt}
              />
            )}
          </AreaState>
        )}
      </AreaScreen>
    </>
  );
}

function Body({
  data,
  placeholder,
  generatedAt,
}: {
  data: NonNullable<ReturnType<typeof useGroupDetail>['data']>;
  placeholder: boolean;
  generatedAt: string | null;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const { me } = useMe();
  const [query, setQuery] = useState('');
  const [noPhotos, setNoPhotos] = useState(false);
  const [healthFor, setHealthFor] = useState<ParticipantRow | null>(null);
  const { group, monitors, participants } = data;
  const shown = useMemo(
    () => filterPeople(participants, line, { query, noPhotosOnly: noPhotos }),
    [participants, query, noPhotos],
  );
  const nNoPhotos = noPhotosCount(participants);
  const q = query.trim().toLowerCase();
  const shownMonitors = monitors.filter(
    (m) => !q || `${m.firstName} ${m.lastName}`.toLowerCase().includes(q),
  );
  const canSeeHealth = !!me?.canSeeHealth;
  // Llegar de un grupo da anterior/siguiente en la ficha.
  const open = (p: ParticipantRow) =>
    router.push({
      pathname: '/comunica/grupos/persona/[personId]',
      params: { personId: p.id, groupId: group.id, from: 'group' },
    });

  return (
    <>
      <View style={styles.head}>
        <Text style={[styles.meta, { color: t.textSecondary }]}>
          {groupMetaLine(group)}
        </Text>
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Buscar por nombre…"
        />
        {nNoPhotos > 0 ? (
          <PressableFeedback
            onPress={() => {
              h.select();
              setNoPhotos((v) => !v);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: noPhotos }}
            accessibilityLabel={`¿Quién no puede salir en fotos? ${nNoPhotos}`}
            style={[
              styles.chip,
              {
                backgroundColor: noPhotos ? t.accentFill : t.card,
                borderColor: noPhotos ? t.accentFill : t.separator,
              },
            ]}
          >
            <IconSymbol
              name="eye.slash"
              size={14}
              color={noPhotos ? t.onAccent : t.textSecondary}
            />
            <Text
              style={[
                styles.chipLabel,
                { color: noPhotos ? t.onAccent : t.text },
              ]}
            >
              ¿Quién no puede salir en fotos? {nNoPhotos}
            </Text>
          </PressableFeedback>
        ) : null}
      </View>

      {placeholder ? (
        <Section title="Monitores">
          <View style={styles.skeletonRow} accessibilityLabel="Cargando">
            <Skeleton
              style={[styles.skAvatar, { backgroundColor: t.separator }]}
            />
            <Skeleton
              style={[styles.skLine, { backgroundColor: t.separator }]}
            />
          </View>
        </Section>
      ) : shownMonitors.length > 0 ? (
        <Section title="Monitores">
          {shownMonitors.map((m) => (
            // La ficha del monitor es del plan 06: hasta que exista, sin enlace.
            <View
              key={m.id}
              style={styles.monitor}
              accessible
              accessibilityLabel={`${m.firstName} ${m.lastName}, monitor`}
            >
              <PersonAvatar person={m} size={36} />
              <Text style={[styles.monitorName, { color: t.text }]}>
                <Text style={styles.bold}>{m.firstName}</Text> {m.lastName}
              </Text>
            </View>
          ))}
        </Section>
      ) : null}

      {participants.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="Este grupo no tiene participantes con relación vigente."
          titleColor={t.text}
          compact
        />
      ) : shown.length === 0 ? (
        <EmptyState
          icon="search-off"
          title={SEARCH_EMPTY}
          titleColor={t.text}
          compact
        />
      ) : (
        <Section title="Participantes">
          {shown.map((p) => (
            <PersonRow
              key={p.id}
              person={p}
              subtitle={line(p)}
              marksLabel={marksA11y(p.badges)}
              below={
                <PersonMarks
                  badges={p.badges}
                  onHealth={canSeeHealth ? () => setHealthFor(p) : undefined}
                />
              }
              onPress={() => open(p)}
              accessibilityHint="Abre su ficha"
              accessibilityActions={
                p.badges.healthNote && canSeeHealth
                  ? [{ name: 'health', label: 'Ver la salud' }]
                  : undefined
              }
              onAccessibilityAction={() => setHealthFor(p)}
              right={
                <IconSymbol
                  name="chevron.right"
                  size={16}
                  color={t.textMuted}
                />
              }
            />
          ))}
        </Section>
      )}
      <View style={styles.foot}>
        <SyncBadge generatedAt={generatedAt} />
      </View>
      <HealthSheet person={healthFor} onClose={() => setHealthFor(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  head: { gap: 12 },
  meta: { ...typography.subhead },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipLabel: { ...typography.subhead, fontWeight: '600' },
  monitor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  monitorName: { ...typography.body, flex: 1 },
  bold: { fontWeight: '600' },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  skAvatar: { width: 36, height: 36, borderRadius: radii.pillFull },
  skLine: { height: 14, width: '50%', borderRadius: radii.sm },
  foot: { alignItems: 'center' },
});
