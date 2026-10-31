// components/comunica/pasar-lista/ComunicaHome.tsx
//
// Portada «Hoy» del área nativa para el equipo (plan 04). Mismo orden y mismas
// palabras que la home de Pasar Lista del plugin (`design/pasar-lista/Main`,
// `pages/single_stic_pasar_lista.php`):
//
//   1. «Pasar lista» y la fecha del atajo (o el curso).
//   2. La cola del móvil: listas guardadas que aún no han subido.
//   3. Los eventos que empiezan o acaban hoy.
//   4. El atajo: tu grupo y su sesión.
//   5. «Te faltan N listas» y, a quien es monitor y lo eligió manual, el
//      aviso del certificado de delitos sexuales (plan 09).
//   6. Tus otros grupos.
//   7. «Pasar lista de otro grupo», por etapa.
//   8. Grupos y fichas (plan 05), pasar lista en un evento y el resumen.
//   9. Coordinación (solo a quien coordina).
//
// Con conexión, precarga las listas del atajo y de lo que falta (cinco como
// mucho), para el sábado sin red.

import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { useQueryClient } from '@tanstack/react-query';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import {
  comunicaNow,
  getComunicaApi,
  getFakeServer,
} from '@/services/comunica';
import type {
  GroupsResponse,
  Me,
  TodayResponse,
} from '@/services/comunica/contract';
import { nativeHrefFor, type Destination } from '@/services/comunica/links';
import { areaKey, STALE } from '@/hooks/comunica/useAreaQuery';
import { useEvents, usePrefetchEventRolls } from '@/hooks/comunica/events';
import { useMe } from '@/hooks/comunica/useMe';
import { useMyProfiles } from '@/hooks/comunica/useActiveProfile';
import { TEAM_ROLES } from '@/services/comunica/contract';
import { useArea } from '../comun/ComunicaAreaProvider';
import { useGroups, useToday } from '@/hooks/comunica/usePasarLista';
import { useFlushOutboxOnMount, useOutbox } from '@/hooks/comunica/useOutbox';
import { useOpenLegacy } from '@/hooks/comunica/useOpenLegacy';
import { longDay, relativeDay, shortDay } from '@/utils/comunica/dates';
import { classifyEvents, isHomeCard } from '@/utils/comunica/events';
import { madridDay, madridTime } from '@/utils/comunica/madrid';
import {
  cameLabel,
  groupLabel,
  groupTitle,
  missedLabel,
  participantsLabel,
} from '@/utils/comunica/marks';
import {
  compareGroups,
  missingRolls,
  proposeSession,
  rollIndex,
  rollKey,
  sectionParam,
  sessionsForGroup,
  stageBuckets,
  type Proposal,
} from '@/utils/comunica/pasarLista';
import { pendingDisplay } from '@/utils/comunica/rollDraft';
import { shortDate } from '@/utils/comunica/sessions';
import { scopeLabel } from '@/utils/comunica/scope';
import NotificationPermissionBanner from '@/components/NotificationPermissionBanner';
import AreaScreen from '../comun/AreaScreen';
import AreaState from '../comun/AreaState';
import DateCapsule from '../comun/DateCapsule';
import DelegationSwitcher from '../comun/DelegationSwitcher';
import RecordCard from '../comun/RecordCard';
import RoleChip from '../comun/RoleChip';
import NavRow from '../comun/NavRow';
import Section from '../comun/Section';
import { EventsEntryRow, TodayEventCard } from '../eventos/EventCards';
import SyncBadge from '../comun/SyncBadge';
import { STAGE_COLOR } from '../comun/theme';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import { noticeFor } from './RollScreen';
import HomeCertificateAlert from '../yo/HomeCertificateAlert';
import MemberHome from '../inicio/MemberHome';

/** Listas que se precargan como mucho. */
const PREFETCH_MAX = 5;

export default function ComunicaHome() {
  const { session } = useArea();
  // Quien no es del equipo (familias, miembros) tiene su portada de familia (plan 11); el equipo, lo suyo y, debajo, lo de familia.
  const roles = session.me?.roles;
  if (roles && !roles.some((r) => TEAM_ROLES.includes(r))) {
    return <FamilyHome />;
  }
  return <TeamHome />;
}

/** La portada de quien no es del equipo: solo la parte de familia, con su «¿A quién ves?» si tiene hijos (plan 11). */
function FamilyHome() {
  const router = useRouter();
  const profiles = useMyProfiles();
  return (
    <AreaScreen onRefresh={() => profiles.refetch()}>
      <MemberHome />
      <NavRow
        icon="person.crop.circle"
        title="Tu cuenta"
        subtitle="Salir o entrar con otra persona"
        onPress={() => router.push('/comunica/yo')}
      />
    </AreaScreen>
  );
}

function TeamHome() {
  const me = useMe();
  const groups = useGroups();
  const today = useToday();
  useFlushOutboxOnMount();

  return (
    <AreaScreen
      onRefresh={() =>
        Promise.all([groups.refetch(), today.refetch(), me.refetch()])
      }
    >
      {/* Quien trabaja con varias delegaciones elige aquí (plan 17). */}
      <DelegationSwitcher />
      <AreaState
        query={groups}
        skeleton="cards"
        empty={{
          title: 'No hay grupos de tu delegación en este curso.',
          subtitle: 'Si crees que es un error, avisa a coordinación.',
          isEmpty: (d) => d.groups.length === 0,
        }}
      >
        {(g) => (
          <AreaState query={today} skeleton="cards">
            {(td) => <HomeContent groups={g} today={td} me={me.me} />}
          </AreaState>
        )}
      </AreaState>
      {/* Lo de familia (plan 11), debajo de lo del equipo; si falla, no sale. */}
      <MemberHome embedded />
      <View style={styles.footer}>
        <SyncBadge generatedAt={today.generatedAt} />
        <SamplerLink />
      </View>
    </AreaScreen>
  );
}

/** Un destino del plugin: nativo si ya lo hay, si no al legado con sesión. */
function useGoTo() {
  const router = useRouter();
  const openLegacy = useOpenLegacy();
  return (destination: Destination, title: string) => {
    const native = nativeHrefFor(destination);
    if (native) router.push(native as never);
    else void openLegacy(destination, title);
  };
}

function HomeContent({
  groups,
  today,
  me,
}: {
  groups: GroupsResponse;
  today: TodayResponse;
  me: Me | null;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const goTo = useGoTo();
  const { pending } = useOutbox();
  const now = comunicaNow();
  const todayDay = madridDay(now);
  const coordination = !!me?.roles.includes('coordination');
  const accompaniment = !!me?.roles.includes('accompaniment');

  const queuedRolls = pending.filter((e) => e.kind === 'roll');
  const queuedEventRolls = pending.filter((e) => e.kind === 'event-roll');
  const queuedCount = queuedRolls.length + queuedEventRolls.length;

  // Eventos (plan 07): la tarjeta sale solo si el evento EMPIEZA o ACABA hoy;
  // la fila, siempre que haya eventos este curso. Y se precargan sus listas.
  const events = useEvents();
  usePrefetchEventRolls(events.data?.events);
  const eventBuckets = events.data
    ? classifyEvents(events.data.events, todayDay)
    : null;
  const homeEvents = eventBuckets?.today.filter(isHomeCard) ?? [];
  const eventsCount = eventBuckets?.count ?? today.eventsThisSeason;

  const model = useMemo(() => {
    const index = rollIndex(today.rollCalls);
    const mine = groups.groups
      .filter((g) => groups.myGroupIds.includes(g.id))
      .sort(compareGroups);
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
    const queued = new Set(
      queuedRolls.map((e) => `${e.meta.sessionId}:${e.meta.groupId}`),
    );
    const missing = missingRolls({
      groups: mine,
      stageEvents: groups.stageEvents,
      rollCalls: today.rollCalls,
      now,
      queued,
      exclude: shortcut
        ? rollKey(shortcut.proposal.session.id, shortcut.group.id)
        : undefined,
    });
    return {
      index,
      shortcut,
      missing,
      others: mine.filter((g) => g.id !== shortcut?.group.id),
      buckets: stageBuckets(groups.groups),
    };
    // `now` cambia en cada render; las reglas van por día.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, today, todayDay, queuedRolls.length]);

  // Precarga para el sábado sin red: el atajo y lo que falta.
  useEffect(() => {
    const wanted = [
      ...(model.shortcut
        ? [
            {
              sid: model.shortcut.proposal.session.id,
              gid: model.shortcut.group.id,
            },
          ]
        : []),
      ...model.missing.map((m) => ({ sid: m.session.id, gid: m.group.id })),
    ].slice(0, PREFETCH_MAX);
    for (const { sid, gid } of wanted) {
      void qc.prefetchQuery({
        queryKey: areaKey(['pasar-lista', 'roll', sid, gid]),
        queryFn: () => getComunicaApi().getRoll(sid, gid),
        staleTime: STALE.state,
        meta: { persist: true },
      });
    }
  }, [model, qc, todayDay]);

  const openRoll = (sessionId: string, groupId: string) =>
    router.push({
      pathname: '/comunica/pasar-lista/[groupId]',
      params: { groupId, sesion: sessionId },
    });

  const shortcut = model.shortcut;
  const shortcutRoll = shortcut
    ? model.index.get(rollKey(shortcut.proposal.session.id, shortcut.group.id))
    : undefined;
  const { shown, more } = pendingDisplay(model.missing);
  const missingGroups = new Set(model.missing.map((m) => m.group.id));

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

      {/* Plan 08: sin permiso, invitar a activar los avisos del área. */}
      <NotificationPermissionBanner
        placement="comunica"
        accentColor={t.accentText}
      />

      {queuedCount > 0 ? (
        <Section
          warning
          title={
            queuedCount === 1
              ? 'Tienes una lista guardada solo en el móvil'
              : `Tienes ${queuedCount} listas guardadas solo en el móvil`
          }
        >
          <Text style={[styles.pad, { color: t.text }]}>
            Se envía sola con cobertura; si no, ábrela y guárdala:
          </Text>
          {queuedRolls.map((e) => (
            <NavRow
              key={e.key}
              title={`${e.meta.label} · ${shortDate(e.meta.date)}`}
              subtitle={
                e.status === 'stuck' || e.status === 'failed'
                  ? 'No se ha podido enviar'
                  : undefined
              }
              onPress={() => openRoll(e.meta.sessionId, e.meta.groupId)}
            />
          ))}
          {queuedEventRolls.map((e) => (
            <NavRow
              key={e.key}
              title={e.meta.label}
              subtitle={
                e.status === 'stuck' || e.status === 'failed'
                  ? 'No se ha podido enviar'
                  : undefined
              }
              onPress={() =>
                router.push({
                  pathname: '/comunica/eventos/[eventId]',
                  params: { eventId: e.meta.eventId },
                })
              }
            />
          ))}
        </Section>
      ) : null}

      {homeEvents.map((c) => (
        <TodayEventCard key={c.event.id} item={c} />
      ))}

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
                  `${cameLabel(shortcutRoll.counts.came)}, ${missedLabel(shortcutRoll.counts.missed)}`,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : [
                  shortcut.group.schoolLevels.join(', '),
                  `${madridTime(shortcut.proposal.session.startsAt)} – ${madridTime(shortcut.proposal.session.endsAt)}`,
                  shortcut.group.counts.participants !== null
                    ? participantsLabel(shortcut.group.counts.participants)
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · '),
            ...(noticeFor(shortcut.proposal) && !shortcutRoll
              ? [noticeFor(shortcut.proposal)!]
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
          {shown.map(({ group, session }) => (
            <MissingRow
              key={rollKey(session.id, group.id)}
              day={session.date}
              group={groupLabel(group)}
              onPress={() => openRoll(session.id, group.id)}
            />
          ))}
          {more > 0 ? (
            <NavRow
              title={`Y ${more} más · Ver todas`}
              onPress={() =>
                missingGroups.size === 1
                  ? router.push({
                      pathname: '/comunica/pasar-lista/[groupId]/historial',
                      params: { groupId: [...missingGroups][0] },
                    })
                  : router.push('/comunica/pasar-lista/grupos')
              }
            />
          ) : null}
        </Section>
      ) : null}

      {/* Plan 09: «Te falta subir tu Certificado…», solo a monitores. */}
      <HomeCertificateAlert me={me} />

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
                title={groupLabel(g)}
                subtitle={[
                  g.schoolLevels.join(', '),
                  p ? shortDay(p.session.date) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                onPress={() =>
                  router.push({
                    pathname: '/comunica/pasar-lista/[groupId]',
                    params: { groupId: g.id },
                  })
                }
              />
            );
          })}
        </Section>
      ) : null}

      {groups.myGroupIds.length === 0 ? (
        <Text style={[styles.body, { color: t.textSecondary }]}>
          No tienes ningún grupo asignado como monitor/a, así que no hay atajo.
          Puedes pasar lista de cualquier grupo desde la lista de abajo.
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
                : b.groups === 1
                  ? '1 grupo'
                  : `${b.groups} grupos`
            }
            onPress={() =>
              router.push({
                pathname: '/comunica/pasar-lista/grupos',
                params: { seccion: sectionParam(b) },
              })
            }
          />
        ))}
        <NavRow
          title="Ver todos los grupos"
          trailing={
            groups.groups.length === 1
              ? '1 grupo'
              : `${groups.groups.length} grupos`
          }
          onPress={() => router.push('/comunica/pasar-lista/grupos')}
        />
      </Section>

      <Section>
        <NavRow
          icon="person.2"
          title="Grupos y fichas"
          subtitle="Teléfonos y fichas, sin pasar lista"
          onPress={() => router.push('/comunica/grupos')}
        />
        {eventsCount > 0 ? <EventsEntryRow count={eventsCount} /> : null}
        <NavRow
          icon="chart.bar"
          title="Resumen de grupos"
          onPress={() =>
            goTo(
              { internalpage: 'single_stic_pasar_lista_resumen' },
              'Resumen de grupos',
            )
          }
        />
      </Section>

      {coordination || accompaniment ? (
        <Section
          title={
            coordination
              ? `Coordinación · ${scopeLabel(me?.scope ?? 'delegation')}`
              : 'Acompañamiento'
          }
        >
          {coordination && today.pendingMeeting ? (
            <MissingRow
              day={today.pendingMeeting.date}
              group={today.pendingMeeting.name}
              onPress={() =>
                router.push({
                  pathname: '/comunica/coordinacion/monitores',
                  params: {
                    tipo: 'reunion',
                    sesion: today.pendingMeeting!.sessionId,
                  },
                })
              }
            />
          ) : null}
          {coordination ? (
            <NavRow
              icon="person.3"
              title="Lista de monitores"
              subtitle="Quién ha venido el sábado"
              onPress={() => router.push('/comunica/coordinacion/monitores')}
            />
          ) : null}
          {coordination ? (
            <NavRow
              icon="calendar"
              title="Reuniones de programación"
              subtitle="Crearlas y pasar lista"
              onPress={() => router.push('/comunica/coordinacion/reuniones')}
            />
          ) : null}
          <NavRow
            icon="person.2"
            title="Tu equipo"
            subtitle="Los monitores, sus fichas y seguimientos"
            onPress={() => router.push('/comunica/coordinacion')}
          />
        </Section>
      ) : null}
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
      <DateCapsule day={day} />
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: t.text }]}>
          {longDay(day, true)}
        </Text>
        <Text style={[styles.rowSub, { color: t.textSecondary }]}>{group}</Text>
      </View>
      <Text style={[styles.action, { color: t.accentText }]}>Recuperar</Text>
      <PressableFeedback.Highlight />
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
      style={styles.samplerLink}
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
  pad: { ...typography.subhead, paddingHorizontal: 16, paddingTop: 12 },
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
  action: { ...typography.button },
  dot: { width: 10, height: 10, borderRadius: radii.pillFull },
  footer: { alignItems: 'center', gap: 8, paddingTop: 8 },
  sampler: { ...typography.caption, fontWeight: '600' },
  samplerLink: { minHeight: 44, justifyContent: 'center' },
});
