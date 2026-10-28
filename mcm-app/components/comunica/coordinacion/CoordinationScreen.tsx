// components/comunica/coordinacion/CoordinationScreen.tsx
//
// La pantalla «COORDINACIÓN» (plan 06, regla 11; `single_stic_coordinacion.php`):
// lo que falta (la reunión sin pasar), las filas que dicen lo que hay —«Lista
// de monitores» y «Reuniones de programación» solo para coordinación; «Resumen
// de grupos» para todos— y «TU EQUIPO»: «Sin grupo» (con «Vincular», solo
// coordinación), Apoyo, por etapa y, plegados, los de grupos que no pasan
// lista (plugin, 24/10/2026). El buscador de la cabecera filtra el equipo.

import React, { useLayoutEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Stack, useNavigation, useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import AppTextField from '@/components/ui/AppTextField';
import EmptyState from '@/components/ui/EmptyState';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import type {
  CoordinationHome,
  TeamMember,
} from '@/services/comunica/contract';
import { useCoordination } from '@/hooks/comunica/coordination';
import { useMe } from '@/hooks/comunica/useMe';
import { useFlushOutboxOnMount, useOutbox } from '@/hooks/comunica/useOutbox';
import { useGroups, useToday } from '@/hooks/comunica/usePasarLista';
import { useColorScheme } from '@/hooks/useColorScheme';
import { h } from '@/utils/haptics';
import { shortDayMonth } from '@/utils/comunica/dates';
import {
  absencesText,
  cameText,
  memberLine,
  monitorsCountText,
} from '@/utils/comunica/monitorsRoll';
import {
  coordinationAccess,
  coordinationSubtitle,
} from '@/utils/comunica/scope';
import {
  coordinationSummaryLine,
  lastSessionStatus,
} from '@/utils/comunica/summary';
import {
  searchTeam,
  teamSections,
  withPendingAssignments,
} from '@/utils/comunica/team';
import AreaScreen from '../comun/AreaScreen';
import DelegationSwitcher from '../comun/DelegationSwitcher';
import AreaState from '../comun/AreaState';
import NavRow from '../comun/NavRow';
import PersonRow from '../comun/PersonRow';
import Section from '../comun/Section';
import UploadStatus from '../comun/UploadStatus';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import AssignSheet from '../grupos/AssignSheet';
import { memberAsPerson } from '../pasar-lista/RollRow';

export const FORBIDDEN_TEAM = {
  title:
    'Esta pantalla es de coordinación y acompañamiento. Si crees que deberías verla, avisa a la oficina técnica.',
};

export default function CoordinationScreen() {
  const q = useCoordination();
  const { me } = useMe();
  const access = coordinationAccess(me?.roles);
  useFlushOutboxOnMount();
  return (
    <>
      <Stack.Screen
        options={{
          title:
            access.accompaniment && !access.coordination
              ? 'Acompañamiento'
              : 'Coordinación',
        }}
      />
      <AreaState query={q} skeleton="list" forbidden={FORBIDDEN_TEAM}>
        {(data) => <Coordination data={data} refetch={() => q.refetch()} />}
      </AreaState>
    </>
  );
}

function Coordination({
  data,
  refetch,
}: {
  data: CoordinationHome;
  refetch: () => Promise<unknown>;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const isDark = useColorScheme() === 'dark';
  const { me } = useMe();
  const access = coordinationAccess(me?.roles);
  const today = useToday();
  const groups = useGroups();
  const { pending, outbox } = useOutbox();
  const [query, setQuery] = useState('');
  const [assignFor, setAssignFor] = useState<TeamMember | null>(null);
  const [outsideOpen, setOutsideOpen] = useState(false);
  const nativeSearch = Platform.OS !== 'web';

  // El buscador de la cabecera (iOS y Android); en web, un campo.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerSearchBarOptions: nativeSearch
        ? {
            placeholder: 'Buscar monitor o grupo…',
            hideWhenScrolling: true,
            textColor: isDark ? '#FFFFFF' : '#000000',
            onChangeText: (e: { nativeEvent: { text: string } }) =>
              setQuery(e.nativeEvent.text),
          }
        : undefined,
    });
  }, [navigation, nativeSearch, isDark]);

  // Lo que «Vincular» ya ha mandado a la cola: el monitor sale ya en su etapa.
  const assigning = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of pending) {
      if (e.kind === 'membership-group') {
        m.set(e.meta.membershipId, (e.payload as { groupId: string }).groupId);
      }
    }
    return m;
  }, [pending]);
  const { team, pendingIds } = useMemo(
    () =>
      withPendingAssignments(data.team, assigning, groups.data?.groups ?? []),
    [data.team, assigning, groups.data],
  );
  const shown = useMemo(() => searchTeam(team, query), [team, query]);
  const view = teamSections(shown);
  const status = lastSessionStatus(data.lastSession);
  const weekly = data.weeklyMonitorsRoll;
  const meeting = today.data?.pendingMeeting ?? null;

  const openMonitor = (id: string) =>
    router.push({
      pathname: '/comunica/coordinacion/monitor/[id]',
      params: { id },
    });

  const memberRow = (m: TeamMember, opts: { open: boolean }) => {
    const pendingAssign = pendingIds.has(m.id);
    const entry = pending.find(
      (e) =>
        e.kind === 'membership-group' &&
        e.meta.personId === m.id &&
        e.status !== 'applied',
    );
    return (
      <PersonRow
        key={m.id}
        person={memberAsPerson(m)}
        subtitle={memberLine(m)}
        marksLabel=""
        onPress={opts.open ? () => openMonitor(m.id) : undefined}
        accessibilityHint={opts.open ? 'Abre su ficha' : undefined}
        below={
          pendingAssign && entry ? (
            <UploadStatus
              state={entry.status}
              onRetry={() => void outbox?.retry(entry.key)}
            />
          ) : undefined
        }
        right={
          opts.open ? (
            <IconSymbol name="chevron.right" size={16} color={t.textMuted} />
          ) : undefined
        }
      />
    );
  };

  return (
    <AreaScreen onRefresh={refetch}>
      <DelegationSwitcher />
      <Text style={[styles.subtitle, { color: t.textSecondary }]}>
        {me ? coordinationSubtitle(me) : ''}
      </Text>

      {access.coordination && meeting ? (
        <Section title="Falta 1 lista" warning>
          <NavRow
            icon="calendar"
            title={meeting.name}
            subtitle={`${shortDayMonth(meeting.date)} · Recuperar`}
            onPress={() =>
              router.push({
                pathname: '/comunica/coordinacion/monitores',
                params: { tipo: 'reunion', sesion: meeting.sessionId },
              })
            }
          />
        </Section>
      ) : null}

      <Section>
        {access.coordination ? (
          <NavRow
            icon="person.3"
            title="Lista de monitores"
            subtitle={
              weekly
                ? weekly.rollCall?.status === 'taken'
                  ? `${shortDayMonth(weekly.session.date)} · pasada: ${cameText(weekly.rollCall.counts.came)}, ${absencesText(weekly.rollCall.counts.missed)}`
                  : weekly.rollCall?.status === 'skipped'
                    ? `${shortDayMonth(weekly.session.date)} · sin registro`
                    : `${shortDayMonth(weekly.session.date)} · sin pasar`
                : 'Quién ha venido el sábado'
            }
            muted={!!weekly && !weekly.rollCall}
            onPress={() => router.push('/comunica/coordinacion/monitores')}
          />
        ) : null}
        {access.coordination ? (
          <NavRow
            icon="calendar"
            title="Reuniones de programación"
            subtitle="Crearlas y pasar lista"
            onPress={() => router.push('/comunica/coordinacion/reuniones')}
          />
        ) : null}
        <NavRow
          icon="chart.bar"
          title="Resumen de grupos"
          subtitle={coordinationSummaryLine(status)}
          onPress={() => router.push('/comunica/coordinacion/resumen')}
        />
      </Section>

      {!nativeSearch ? (
        <AppTextField
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar monitor o grupo…"
          accessibilityLabel="Buscar monitor o grupo"
          accentColor={t.accentText}
        />
      ) : null}

      <Text
        style={[styles.teamTitle, { color: t.text }]}
        accessibilityRole="header"
      >
        Tu equipo · {monitorsCountText(team.length)}
      </Text>

      {data.team.length === 0 ? (
        <EmptyState
          icon="groups"
          title="No hay monitores con relación vigente en los grupos de tu alcance."
          titleColor={t.text}
          compact
        />
      ) : shown.length === 0 ? (
        <EmptyState
          icon="search"
          title="Nadie con ese nombre o grupo."
          titleColor={t.text}
          compact
        />
      ) : null}

      {view.unassigned.length > 0 ? (
        <View style={styles.block}>
          <Section
            title={`Sin grupo · ${monitorsCountText(view.unassigned.length)}`}
            warning
          >
            {view.unassigned.map((m) => (
              <PersonRow
                key={m.id}
                person={memberAsPerson(m)}
                subtitle="Sin grupo asignado"
                marksLabel=""
                accessibilityActions={
                  access.coordination
                    ? [{ name: 'assign', label: 'Vincular' }]
                    : undefined
                }
                onAccessibilityAction={(name) => {
                  if (name === 'assign') setAssignFor(m);
                }}
                right={
                  access.coordination ? (
                    <PressableFeedback
                      onPress={() => {
                        h.tap();
                        setAssignFor(m);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Vincular a ${m.firstName}`}
                      style={styles.tapTarget}
                    >
                      <Text style={[styles.link, { color: t.accentText }]}>
                        Vincular
                      </Text>
                    </PressableFeedback>
                  ) : undefined
                }
              />
            ))}
          </Section>
          <Text style={[styles.small, { color: t.textSecondary }]}>
            Tienen relación de monitor, pero no cuelgan de ningún grupo de la
            delegación. Elige el grupo que llevan y ya salen en su lista.
          </Text>
        </View>
      ) : null}

      {view.support.length > 0 ? (
        <Section title={`Apoyo · ${monitorsCountText(view.support.length)}`}>
          {view.support.map((m) => memberRow(m, { open: true }))}
        </Section>
      ) : null}

      {view.sections.map((sec) => (
        <Section
          key={sec.label}
          title={
            view.showHeaders
              ? `${sec.label} · ${monitorsCountText(sec.members.length)}`
              : undefined
          }
        >
          {sec.members.map((m) => memberRow(m, { open: true }))}
        </Section>
      ))}

      {view.outside.length > 0 ? (
        <View style={styles.block}>
          <PressableFeedback
            onPress={() => {
              h.toggle();
              setOutsideOpen((o) => !o);
            }}
            accessibilityRole="button"
            accessibilityState={{ expanded: outsideOpen }}
            style={styles.fold}
          >
            <Text style={[styles.foldTitle, { color: t.text }]}>
              Monitores de grupos que no pasan lista
            </Text>
            <Text style={[styles.small, { color: t.textSecondary }]}>
              {view.outside.length}
            </Text>
            <IconSymbol
              name={outsideOpen ? 'chevron.up' : 'chevron.down'}
              size={16}
              color={t.textMuted}
            />
          </PressableFeedback>
          {outsideOpen ? (
            <Section>
              {view.outside.map((m) => memberRow(m, { open: false }))}
            </Section>
          ) : null}
        </View>
      ) : null}

      <AssignSheet
        person={
          assignFor?.unassigned
            ? {
                id: assignFor.id,
                firstName: assignFor.firstName,
                schoolLevel: assignFor.schoolLevel,
                unassignedMembershipId: assignFor.unassigned.membershipId,
              }
            : null
        }
        groups={groups.data?.groups ?? []}
        onClose={() => setAssignFor(null)}
      />
    </AreaScreen>
  );
}

const styles = StyleSheet.create({
  subtitle: { ...typography.subhead },
  teamTitle: { ...typography.h3, paddingTop: 8 },
  block: { gap: 8 },
  small: { ...typography.caption },
  link: { ...typography.button },
  tapTarget: { minHeight: 44, justifyContent: 'center', paddingLeft: 8 },
  fold: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 4,
  },
  foldTitle: { ...typography.subhead, fontWeight: '600', flex: 1 },
});
