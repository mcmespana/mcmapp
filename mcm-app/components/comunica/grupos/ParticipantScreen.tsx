// La ficha del participante (plan 05, reglas 13-25;
// `pages/single_stic_pasar_lista_ficha.php`). Se abre para MIRAR: un teléfono,
// quién no se puede ir solo, la asistencia, los avisos. El orden es el del
// código del plugin:
//
//   identidad → «No puede irse solo/a a casa.» → botones grandes al tutor 1 →
//   lo imprescindible → Contacto → Asistencia → Avisos → Salud → Pañuelo →
//   Autorizaciones y Datos personales (plegados) → anterior/siguiente.
//
// Sin conexión se ve todo lo guardado menos la salud y los datos personales,
// que nunca se guardan en el móvil.

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import EmptyState from '@/components/ui/EmptyState';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { comunicaNow } from '@/services/comunica';
import { isComunicaApiError } from '@/services/comunica/client';
import type {
  Guardian,
  Notice,
  ParticipantProfile,
} from '@/services/comunica/contract';
import {
  outboxKeys,
  useGroupDetail,
  useHealth,
  useParticipant,
  usePersonal,
} from '@/hooks/comunica/useGrupos';
import { useMe } from '@/hooks/comunica/useMe';
import { useOutbox } from '@/hooks/comunica/useOutbox';
import { h } from '@/utils/haptics';
import { madridDay } from '@/utils/comunica/madrid';
import { groupLabel } from '@/utils/comunica/marks';
import { noticesLabel, numberNotices } from '@/utils/comunica/notices';
import {
  ageLabel,
  compareByLastName,
  neighbors,
  STAGE_LABEL,
} from '@/utils/comunica/people';
import {
  canWhatsappMinor,
  cleanPhone,
  mailtoUrl,
  telUrl,
  whatsappUrl,
  type Phone,
} from '@/utils/comunica/phone';
import { STREAK_THRESHOLD } from '@/utils/comunica/attendance';
import AreaScreen from '../comun/AreaScreen';
import AreaState from '../comun/AreaState';
import PersonAvatar from '../comun/PersonAvatar';
import { HEALTH_MARK_A11Y, MARK_TEXT } from '../comun/PersonMarks';
import SyncBadge from '../comun/SyncBadge';
import type { UploadState } from '../comun/UploadStatus';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import FichaAttendance, { useAttendance } from './FichaAttendance';
import FichaNotices from './FichaNotices';
import {
  ConsentsFold,
  FichaSection,
  openUrl,
  Pager,
  PersonalFold,
  ScarfBlock,
} from './FichaParts';
import { HEALTH_LABEL, HEALTH_OFFLINE, isOfflineError } from './healthCopy';

interface Props {
  personId: string;
  /** Llegó desde un grupo (o desde marcar): da anterior/siguiente. */
  groupId?: string;
  /** Desde marcar: la sesión, para el aviso. */
  sessionId?: string;
  /** De dónde se viene (`group`, `roll`, `courses`, `az`). */
  from?: string;
}

export default function ParticipantScreen(props: Props) {
  const t = useComunicaTheme();
  const q = useParticipant(props.personId);
  const forbidden = isComunicaApiError(q.error) && q.error.code === 'forbidden';
  return (
    <>
      <Stack.Screen options={{ title: 'Ficha', headerLargeTitle: false }} />
      {forbidden ? (
        // Sin decir si existe.
        <EmptyState
          icon="lock"
          title="No tienes acceso a esta ficha."
          titleColor={t.text}
        />
      ) : (
        <AreaState query={q} skeleton="cards">
          {(profile) => (
            <Ficha
              {...props}
              profile={profile}
              generatedAt={q.generatedAt}
              refetch={() => q.refetch()}
            />
          )}
        </AreaState>
      )}
    </>
  );
}

function Ficha({
  profile,
  groupId,
  sessionId,
  from,
  generatedAt,
  refetch,
}: Props & {
  profile: ParticipantProfile;
  generatedAt: string | null;
  refetch: () => Promise<unknown>;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const { me } = useMe();
  const { entries, outbox } = useOutbox();
  const p = profile.person;
  const canSeeHealth = !!me?.canSeeHealth;
  const health = useHealth(p.id, canSeeHealth);
  const personal = usePersonal(p.id, true);
  const now = comunicaNow();
  const today = madridDay(now);
  const attendance = useAttendance(profile, now);

  // Lo que está en la cola de esta persona: avisos nuevos y el pañuelo.
  const mine = entries.filter((e) => e.meta.personId === p.id);
  const pendingNotices: (Notice & { pending: true; outboxKey: string })[] = mine
    .filter((e) => e.kind === 'notice' && e.status !== 'applied')
    .map((e) => {
      const body = e.payload as Omit<Notice, 'id' | 'placedBy'>;
      return {
        id: `pendiente-${e.clientId}`,
        date: body.date > today ? today : body.date,
        reason: body.reason,
        familyNotified: body.familyNotified,
        placedBy: me?.name.split(' ')[0],
        pending: true,
        outboxKey: e.key,
      };
    });
  const appliedNotices = new Map(
    mine
      .filter((e) => e.kind === 'notice' && e.status === 'applied')
      .flatMap((e) => {
        const r = e.result as { notice?: Notice } | undefined;
        return r?.notice ? [[r.notice.id, e.key] as const] : [];
      }),
  );
  const notices = numberNotices([
    ...profile.notices.map((n) => ({
      ...n,
      outboxKey: appliedNotices.get(n.id),
    })),
    ...pendingNotices,
  ]);
  const scarfEntry = mine.find((e) => e.key === outboxKeys.scarf(p.id));
  const scarf =
    scarfEntry &&
    scarfEntry.status !== 'failed' &&
    scarfEntry.status !== 'stuck'
      ? (scarfEntry.payload as { scarf: ParticipantProfile['scarf'] }).scarf
      : profile.scarf;
  const uploadOf = (key: string) =>
    entries.find((e) => e.key === key)?.status as UploadState | undefined;

  // Contacto: el tutor 1 es el primero de la familia con teléfono.
  const tutor = profile.guardians.find((g) => cleanPhone(g.phone));
  const tutorPhone = tutor ? cleanPhone(tutor.phone)! : null;
  const ownPhone = cleanPhone(profile.phones.own);
  const emergency = cleanPhone(profile.phones.emergency);
  const hasContactRows =
    !!ownPhone || profile.guardians.length > 0 || !!emergency;

  // Lo imprescindible.
  const food = (health.data?.items ?? [])
    .filter((i) => i.kind === 'allergies' || i.kind === 'intolerances')
    .map((i) => i.text.trim())
    .filter(Boolean);
  const essentials: { key: string; text: string; tone: 'warn' | 'danger' }[] =
    [];
  if (food.length) {
    essentials.push({ key: 'food', text: food.join(' · '), tone: 'warn' });
  } else if (!health.data && profile.badges.healthNote) {
    essentials.push({ key: 'mark', text: MARK_TEXT.healthNote, tone: 'warn' });
  }
  if (attendance.streak >= STREAK_THRESHOLD) {
    essentials.push({
      key: 'streak',
      text: `${attendance.streak} faltas seguidas`,
      tone: 'danger',
    });
  }
  if (notices.length > 0) {
    essentials.push({
      key: 'notices',
      text: noticesLabel(notices.length),
      tone: 'warn',
    });
  }

  // Anterior / siguiente: solo llegando desde un grupo, sin dar la vuelta.
  const fromGroup = !!groupId && (from === 'group' || from === 'roll');
  const group = useGroupDetail(fromGroup ? groupId! : '');
  const sorted = useMemo(
    () => [...(group.data?.participants ?? [])].sort(compareByLastName),
    [group.data],
  );
  const near = fromGroup ? neighbors(sorted, p.id) : { prev: null, next: null };
  const go = (id: string) =>
    // `replace`: «atrás» vuelve al sitio de origen y no arrastra `sessionId`.
    router.replace({
      pathname: '/comunica/grupos/persona/[personId]',
      params: { personId: id, groupId: groupId!, from: 'group' },
    });

  const identity = [
    profile.group ? groupLabel(profile.group) : 'Sin grupo',
    profile.group?.stage ? STAGE_LABEL[profile.group.stage] : null,
    p.schoolLevel?.label ?? null,
    ageLabel(p.age),
  ]
    .filter(Boolean)
    .join(' · ');

  const healthItems = health.data?.items.filter((i) => i.text.trim()) ?? [];

  return (
    <AreaScreen onRefresh={refetch}>
      {/* Identidad */}
      <View style={styles.identity}>
        <PersonAvatar person={p} size={72} background={t.card} />
        <View style={styles.identityBody}>
          <Text
            style={[styles.name, { color: t.text }]}
            accessibilityRole="header"
          >
            {p.fullName}
          </Text>
          <Text style={[styles.identityLine, { color: t.textSecondary }]}>
            {identity}
          </Text>
        </View>
      </View>

      {profile.consents.goHomeAlone === false ? (
        <View
          style={[styles.homeAlone, { backgroundColor: t.warningSoft }]}
          accessibilityRole="alert"
        >
          <IconSymbol
            name="exclamationmark.triangle.fill"
            size={18}
            color={t.warningIcon}
          />
          <Text style={[styles.homeAloneText, { color: t.warningText }]}>
            No puede irse solo/a a casa.
          </Text>
        </View>
      ) : null}

      {tutor && tutorPhone ? (
        <QuickButtons guardian={tutor} phone={tutorPhone} />
      ) : null}

      {essentials.length > 0 ? (
        <View style={styles.essentials}>
          {essentials.map((e) => {
            const chip = t.chip(e.tone === 'danger' ? 'negative' : 'warning');
            return (
              <View
                key={e.key}
                style={[styles.essential, { backgroundColor: chip.background }]}
                accessible
                accessibilityLabel={
                  e.key === 'mark' ? HEALTH_MARK_A11Y : e.text
                }
              >
                <IconSymbol
                  name={
                    e.key === 'streak'
                      ? 'clock'
                      : e.key === 'notices'
                        ? 'exclamationmark.triangle.fill'
                        : 'cross.case.fill'
                  }
                  size={14}
                  color={e.tone === 'danger' ? t.dangerText : t.warningIcon}
                />
                <Text style={[styles.essentialText, { color: chip.text }]}>
                  {e.text}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {/* Contacto */}
      <FichaSection title="Contacto">
        {hasContactRows ? (
          <View style={[styles.list, { backgroundColor: t.card }]}>
            {ownPhone ? (
              <ContactRow
                name={p.firstName}
                tag="Suyo"
                sub={ownPhone.display}
                phone={ownPhone}
                whatsapp={canWhatsappMinor(profile.consents.whatsapp)}
              />
            ) : null}
            {profile.guardians.map((g) => {
              const ph = cleanPhone(g.phone);
              const rel = g.relationship;
              return (
                <ContactRow
                  key={g.id}
                  name={g.fullName}
                  sub={
                    ph
                      ? [rel, ph.display].filter(Boolean).join(' · ')
                      : [rel, 'sin teléfono'].filter(Boolean).join(' · ')
                  }
                  phone={ph}
                  whatsapp
                  email={g.email}
                />
              );
            })}
            {emergency ? (
              <ContactRow
                name="Emergencias"
                sub={emergency.display}
                phone={emergency}
                whatsapp={false}
              />
            ) : null}
          </View>
        ) : null}
        {!hasContactRows ? (
          <Hint text="Esta ficha no tiene familia ni teléfonos que esta pantalla pueda ver. Avisa a coordinación: o faltan en el CRM, o el entorno personal no está asignado a la delegación." />
        ) : !tutor ? (
          <Hint text="Nadie de la familia tiene teléfono en el CRM. Avisa a coordinación para que lo completen." />
        ) : null}
      </FichaSection>

      <FichaAttendance profile={profile} model={attendance} />

      <FichaNotices
        personId={p.id}
        firstName={p.firstName}
        notices={notices}
        limit={profile.noticeLimit}
        uploadOf={uploadOf}
        onRetry={(k) => void outbox?.retry(k)}
        today={today}
        sessionId={sessionId}
      />

      {/* Salud: solo con permiso y solo con conexión; sin texto, no sale. */}
      {canSeeHealth ? (
        healthItems.length > 0 ? (
          <FichaSection title="Salud">
            <View
              style={[styles.list, styles.pad, { backgroundColor: t.card }]}
            >
              {healthItems.map((i, n) => (
                <View key={`${i.kind}-${n}`} style={styles.healthItem}>
                  <Text style={[styles.caption, { color: t.textSecondary }]}>
                    {HEALTH_LABEL[i.kind]}
                  </Text>
                  <Text style={[styles.body, { color: t.text }]}>{i.text}</Text>
                </View>
              ))}
            </View>
          </FichaSection>
        ) : health.error && isOfflineError(health.error) ? (
          <FichaSection title="Salud">
            <Hint text={HEALTH_OFFLINE} />
          </FichaSection>
        ) : null
      ) : null}

      <ScarfBlock
        personId={p.id}
        firstName={p.firstName}
        scarf={scarf}
        upload={scarfEntry?.status as UploadState | undefined}
        onRetry={() => scarfEntry && void outbox?.retry(scarfEntry.key)}
      />

      <View style={styles.folds}>
        <ConsentsFold consents={profile.consents} />
        <PersonalFold query={personal} />
      </View>

      {fromGroup ? <Pager prev={near.prev} next={near.next} onGo={go} /> : null}

      <View style={styles.foot}>
        <SyncBadge generatedAt={generatedAt} />
      </View>
    </AreaScreen>
  );
}

function QuickButtons({
  guardian,
  phone,
}: {
  guardian: Guardian;
  phone: Phone;
}) {
  const t = useComunicaTheme();
  const first =
    guardian.firstName?.trim() || guardian.fullName.split(' ')[0] || '';
  const rel = guardian.relationship.trim().toLowerCase();
  const call = rel ? `Llamar a ${first} (${rel})` : `Llamar a ${first}`;
  return (
    <View style={styles.quick}>
      <PressableFeedback
        onPress={() => {
          h.tap();
          void openUrl(whatsappUrl(phone));
        }}
        accessibilityRole="button"
        accessibilityLabel={`WhatsApp a ${guardian.fullName}`}
        style={[styles.quickButton, { backgroundColor: t.card }]}
      >
        <PressableFeedback.Highlight />
        <IconSymbol name="message.fill" size={18} color={t.accentText} />
        <Text style={[styles.quickLabel, { color: t.accentText }]}>
          WhatsApp a {first}
        </Text>
      </PressableFeedback>
      <PressableFeedback
        onPress={() => {
          h.tap();
          void openUrl(telUrl(phone));
        }}
        accessibilityRole="button"
        accessibilityLabel={`Llamar a ${guardian.fullName}`}
        style={[styles.quickButton, { backgroundColor: t.accentFill }]}
      >
        <PressableFeedback.Scale />
        <IconSymbol name="phone.fill" size={18} color={t.onAccent} />
        <Text style={[styles.quickLabel, { color: t.onAccent }]}>{call}</Text>
      </PressableFeedback>
    </View>
  );
}

function ContactRow({
  name,
  tag,
  sub,
  phone,
  whatsapp,
  email,
}: {
  name: string;
  tag?: string;
  sub: string;
  phone: Phone | null;
  whatsapp: boolean;
  email?: string;
}) {
  const t = useComunicaTheme();
  const tagChip = t.chip('accent');
  return (
    <View style={[styles.contact, { borderTopColor: t.separator }]}>
      <View style={styles.contactBody}>
        <View style={styles.contactName}>
          <Text style={[styles.body, styles.bold, { color: t.text }]}>
            {name}
          </Text>
          {tag ? (
            <View style={[styles.tag, { backgroundColor: tagChip.background }]}>
              <Text style={[styles.tagText, { color: tagChip.text }]}>
                {tag}
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          style={[
            styles.caption,
            { color: phone ? t.textSecondary : t.textMuted },
          ]}
        >
          {sub}
        </Text>
        {email ? (
          <PressableFeedback
            onPress={() => void openUrl(mailtoUrl(email))}
            accessibilityRole="link"
            accessibilityLabel={`Escribir a ${email}`}
            hitSlop={6}
          >
            <Text style={[styles.caption, { color: t.accentText }]}>
              {email}
            </Text>
          </PressableFeedback>
        ) : null}
      </View>
      {phone ? (
        <View style={styles.contactActions}>
          {whatsapp ? (
            <RoundButton
              icon="message.fill"
              label={`WhatsApp a ${name}`}
              onPress={() => void openUrl(whatsappUrl(phone))}
            />
          ) : null}
          <RoundButton
            icon="phone.fill"
            label={`Llamar a ${name}`}
            onPress={() => void openUrl(telUrl(phone))}
          />
        </View>
      ) : null}
    </View>
  );
}

function RoundButton({
  icon,
  label,
  onPress,
}: {
  icon: 'message.fill' | 'phone.fill';
  label: string;
  onPress: () => void;
}) {
  const t = useComunicaTheme();
  return (
    <PressableFeedback
      onPress={() => {
        h.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.round, { backgroundColor: t.backgroundSunken }]}
    >
      <PressableFeedback.Highlight />
      <IconSymbol name={icon} size={18} color={t.accentText} />
    </PressableFeedback>
  );
}

function Hint({ text }: { text: string }) {
  const t = useComunicaTheme();
  return (
    <View style={styles.hint}>
      <IconSymbol
        name="exclamationmark.triangle.fill"
        size={14}
        color={t.textMuted}
      />
      <Text style={[styles.caption, styles.flex, { color: t.textSecondary }]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  identityBody: { flex: 1, gap: 4 },
  name: { ...typography.h2 },
  identityLine: { ...typography.subhead },
  homeAlone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: radii.md,
  },
  homeAloneText: { ...typography.body, fontWeight: '700', flex: 1 },
  quick: { gap: 10 },
  quickButton: {
    minHeight: 52,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  quickLabel: { ...typography.button, flexShrink: 1, textAlign: 'center' },
  essentials: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  essential: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
    maxWidth: '100%',
  },
  essentialText: { ...typography.subhead, fontWeight: '600', flexShrink: 1 },
  list: { borderRadius: radii.lg, overflow: 'hidden' },
  pad: { padding: 16, gap: 12 },
  contact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: -StyleSheet.hairlineWidth,
  },
  contactBody: { flex: 1, gap: 2 },
  contactName: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  contactActions: { flexDirection: 'row', gap: 8 },
  tag: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radii.xs },
  tagText: { ...typography.footnote, fontWeight: '700' },
  round: {
    width: 44,
    height: 44,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  body: { ...typography.body },
  bold: { fontWeight: '600' },
  caption: { ...typography.caption },
  flex: { flex: 1 },
  hint: { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
  healthItem: { gap: 2 },
  folds: { gap: 12 },
  foot: { alignItems: 'center' },
});
