// components/comunica/pasar-lista/ComunicaHome.tsx
//
// Portada «Hoy» del área nativa para el equipo (primer corte del plan 04).
// Mismo orden y mismas palabras que la home de Pasar Lista del plugin
// (`design/pasar-lista/Main`): el atajo a tu grupo y su sesión, «Te faltan N
// listas», tus otros grupos y «Pasar lista de otro grupo» por etapa.
//
// Falta, y lo trae el plan 04: la cola del móvil, el evento de hoy, el bloque
// de coordinación y las pantallas a las que llevan las filas.

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { comunicaNow, getFakeServer } from '@/services/comunica';
import type {
  GroupsResponse,
  TodayResponse,
} from '@/services/comunica/contract';
import { useMe } from '@/hooks/comunica/useMe';
import { useGroups, useToday } from '@/hooks/comunica/usePasarLista';
import { longDay, relativeDay, shortDay } from '@/utils/comunica/dates';
import { madridDay, madridTime } from '@/utils/comunica/madrid';
import { groupTitle, participantsLabel } from '@/utils/comunica/marks';
import {
  compareGroups,
  missingRolls,
  proposeSession,
  rollIndex,
  rollKey,
  sessionsForGroup,
  stageBuckets,
  type Proposal,
} from '@/utils/comunica/pasarLista';
import AreaScreen from '../comun/AreaScreen';
import AreaState from '../comun/AreaState';
import DateCapsule from '../comun/DateCapsule';
import RecordCard from '../comun/RecordCard';
import RoleChip from '../comun/RoleChip';
import Section from '../comun/Section';
import SyncBadge from '../comun/SyncBadge';
import { STAGE_COLOR } from '../comun/theme';
import { useComunicaTheme } from '../comun/useComunicaTheme';

/** Con más de cuatro que faltan, se enseñan tres y «Y N más». */
const MISSING_VISIBLE = 4;

export default function ComunicaHome() {
  const me = useMe();
  const groups = useGroups();
  const today = useToday();

  return (
    <AreaScreen
      onRefresh={() =>
        Promise.all([groups.refetch(), today.refetch(), me.refetch()])
      }
    >
      <AreaState query={groups} skeleton="cards">
        {(g) => (
          <AreaState query={today} skeleton="cards">
            {(td) => (
              <HomeContent
                groups={g}
                today={td}
                coordination={me.isCoordination}
                accompaniment={!!me.me?.roles.includes('accompaniment')}
              />
            )}
          </AreaState>
        )}
      </AreaState>
      <View style={styles.footer}>
        <SyncBadge generatedAt={today.generatedAt} />
        <SamplerLink />
      </View>
    </AreaScreen>
  );
}

function HomeContent({
  groups,
  today,
  coordination,
  accompaniment,
}: {
  groups: GroupsResponse;
  today: TodayResponse;
  coordination: boolean;
  accompaniment: boolean;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const now = comunicaNow();
  const todayDay = madridDay(now);

  const model = useMemo(() => {
    const index = rollIndex(today.rollCalls);
    const mine = groups.groups
      .filter((g) => groups.myGroupIds.includes(g.id))
      .sort(compareGroups);
    // El atajo: el primero de tus grupos que tenga sesión.
    let shortcut: { group: (typeof mine)[number]; proposal: Proposal } | null =
      null;
    for (const group of mine) {
      const proposal = proposeSession(
        sessionsForGroup(group, groups.stageEvents),
        now,
      );
      if (proposal) {
        shortcut = { group, proposal };
        break;
      }
    }
    const missing = missingRolls({
      groups: mine,
      stageEvents: groups.stageEvents,
      rollCalls: today.rollCalls,
      now,
      exclude: shortcut
        ? rollKey(shortcut.proposal.session.id, shortcut.group.id)
        : undefined,
    });
    const others = mine.filter((g) => g.id !== shortcut?.group.id);
    return {
      index,
      shortcut,
      missing,
      others,
      buckets: stageBuckets(groups.groups),
    };
    // `now` cambia en cada render; las reglas van por día, así que basta con
    // recalcular cuando cambian los datos o el día.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, today, todayDay]);

  const openRoll = (sessionId: string, groupId: string) =>
    router.push({
      pathname: '/comunica/lista',
      params: { sid: sessionId, gid: groupId },
    });

  const shortcut = model.shortcut;
  const shortcutRoll = shortcut
    ? model.index.get(rollKey(shortcut.proposal.session.id, shortcut.group.id))
    : undefined;
  const shownMissing =
    model.missing.length > MISSING_VISIBLE
      ? model.missing.slice(0, MISSING_VISIBLE - 1)
      : model.missing;

  return (
    <>
      <View style={styles.intro}>
        <Text
          style={[styles.title, { color: t.text }]}
          accessibilityRole="header"
        >
          Pasar lista
        </Text>
        <View style={styles.introLine}>
          <Text style={[styles.subtitle, { color: t.textSecondary }]}>
            {shortcut
              ? longDay(shortcut.proposal.session.date, true)
              : `Curso ${groups.season}`}
          </Text>
          {coordination ? (
            <RoleChip role="coordination" />
          ) : accompaniment ? (
            <RoleChip role="accompaniment" />
          ) : null}
        </View>
      </View>

      {shortcut ? (
        <RecordCard
          featured
          kicker={kickerFor(shortcut.proposal, !!shortcutRoll, todayDay)}
          code={groupTitle(shortcut.group).code}
          title={groupTitle(shortcut.group).name ?? ''}
          lines={[
            shortcutRoll
              ? [
                  shortcut.group.schoolLevels.join(', '),
                  `${shortcutRoll.counts.came} vinieron, ${shortcutRoll.counts.missed} ausencias`,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : [
                  shortcut.group.schoolLevels.join(', '),
                  `${madridTime(shortcut.proposal.session.startsAt)} – ${madridTime(shortcut.proposal.session.endsAt)}`,
                  participantsLabel(shortcut.group.counts.participants),
                ]
                  .filter(Boolean)
                  .join(' · '),
            ...(noticeText(shortcut.proposal) && !shortcutRoll
              ? [noticeText(shortcut.proposal)!]
              : []),
          ]}
          day={shortcut.proposal.session.date}
          action={{
            label: shortcutRoll ? 'Revisar la lista' : 'Pasar lista',
            onPress: () =>
              openRoll(shortcut.proposal.session.id, shortcut.group.id),
          }}
        />
      ) : null}

      {model.missing.length > 0 ? (
        <Section
          warning
          title={
            model.missing.length === 1
              ? 'Te falta 1 lista'
              : `Te faltan ${model.missing.length} listas`
          }
        >
          {shownMissing.map(({ group, session }) => (
            <MissingRow
              key={rollKey(session.id, group.id)}
              day={session.date}
              group={groupLabelOf(group)}
              onPress={() => openRoll(session.id, group.id)}
            />
          ))}
          {model.missing.length > shownMissing.length ? (
            <Text style={[styles.more, { color: t.textSecondary }]}>
              Y {model.missing.length - shownMissing.length} más
            </Text>
          ) : null}
        </Section>
      ) : null}

      {model.others.length > 0 ? (
        <Section
          title={
            model.others.length === 1 ? 'Tu otro grupo' : 'Tus otros grupos'
          }
        >
          {model.others.map((g) => {
            const p = proposeSession(
              sessionsForGroup(g, groups.stageEvents),
              now,
            );
            return (
              <NavRow
                key={g.id}
                title={groupLabelOf(g)}
                subtitle={[
                  g.schoolLevels.join(', '),
                  p ? shortDay(p.session.date) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                onPress={p ? () => openRoll(p.session.id, g.id) : undefined}
              />
            );
          })}
        </Section>
      ) : null}

      {groups.myGroupIds.length === 0 ? (
        <Text style={[styles.body, { color: t.textSecondary }]}>
          No tienes ningún grupo asignado como monitor/a, así que no hay atajo.
          Puedes pasar lista de cualquier grupo de tu delegación desde aquí
          abajo.
        </Text>
      ) : null}

      <Section title="Pasar lista de otro grupo">
        {model.buckets.map((b) => (
          <NavRow
            key={b.key}
            dot={b.stage ? STAGE_COLOR[b.stage] : t.textMuted}
            title={b.label}
            trailing={
              b.participants > 0
                ? participantsLabel(b.participants)
                : `${b.groups} grupos`
            }
          />
        ))}
      </Section>
    </>
  );
}

function kickerFor(p: Proposal, taken: boolean, today: string) {
  if (taken) return { label: 'Pasada', tone: 'positive' as const };
  if (p.notice?.kind === 'next') return { label: 'Próxima' };
  if (p.session.date === today)
    return { label: 'Hoy', tone: 'accent' as const };
  return {
    label: relativeDay(p.session.date, today),
    tone: 'warning' as const,
  };
}

function noticeText(p: Proposal): string | null {
  switch (p.notice?.kind) {
    case 'not_started':
      return `Empieza a las ${madridTime(p.notice.startsAt)} — aún no han llegado`;
    case 'days_ago':
      return p.notice.days === 1
        ? 'Es la sesión de ayer'
        : `Es la sesión de hace ${p.notice.days} días`;
    case 'next':
      return `La próxima sesión es el ${longDay(p.notice.date)}`;
    default:
      return null;
  }
}

const groupLabelOf = (g: { code: string | null; name: string }) => {
  const t = groupTitle(g);
  return [t.code, t.name].filter(Boolean).join(' · ');
};

function MissingRow({
  day,
  group,
  onPress,
}: {
  day: string;
  group: string;
  onPress: () => void;
}) {
  const t = useComunicaTheme();
  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${longDay(day)}, ${group}. Recuperar`}
      style={styles.row}
    >
      <PressableFeedback.Highlight />
      <DateCapsule day={day} />
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: t.text }]}>
          {longDay(day, true)}
        </Text>
        <Text style={[styles.rowSub, { color: t.textSecondary }]}>{group}</Text>
      </View>
      <Text style={[styles.recover, { color: t.accentText }]}>Recuperar</Text>
    </PressableFeedback>
  );
}

function NavRow({
  title,
  subtitle,
  trailing,
  dot,
  onPress,
}: {
  title: string;
  subtitle?: string;
  trailing?: string;
  dot?: string;
  onPress?: () => void;
}) {
  const t = useComunicaTheme();
  const label = [title, subtitle, trailing].filter(Boolean).join(', ');
  return (
    <PressableFeedback
      onPress={onPress}
      isDisabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.row}
    >
      <PressableFeedback.Highlight />
      {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: t.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.rowSub, { color: t.textSecondary }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? (
        <Text style={[styles.rowSub, { color: t.textSecondary }]}>
          {trailing}
        </Text>
      ) : null}
      <IconSymbol name="chevron.right" size={16} color={t.textMuted} />
    </PressableFeedback>
  );
}

/** Enlace a la muestra de componentes: solo con el servidor falso. */
function SamplerLink() {
  const t = useComunicaTheme();
  const router = useRouter();
  if (!getFakeServer()) return null;
  return (
    <PressableFeedback
      onPress={() => router.push('/comunica/muestra')}
      accessibilityRole="link"
      hitSlop={12}
    >
      <Text style={[styles.sampler, { color: t.accentText }]}>
        Datos inventados · Muestra de componentes
      </Text>
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 4 },
  introLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...typography.h2 },
  subtitle: { ...typography.subhead },
  body: { ...typography.body },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { ...typography.body, fontWeight: '600' },
  rowSub: { ...typography.caption },
  recover: { ...typography.button },
  more: { ...typography.caption, padding: 16 },
  dot: { width: 10, height: 10, borderRadius: radii.pillFull },
  footer: { alignItems: 'center', gap: 8, paddingTop: 8 },
  sampler: { ...typography.caption, fontWeight: '600' },
});
