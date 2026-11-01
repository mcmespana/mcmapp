// La ficha de una inscripción (plan 14, `sticpa_registration_detail_html`).
//
//   · Cabecera: el nombre, la línea de cuándo y los chips (estado + «Ya celebrado»). Avisos: el de después de guardar, el del estado `danger`/`warn`
//     y la descripción de necesidades especiales.
//   · «Importe de la inscripción» en grande si es mayor que 0; datos (curso, clase, tipo de participación si no es el de siempre, asistencia, personas,
//     «Tu respuesta») y el PAGO en una línea (`paymentLine.ts`).
//   · La acción principal: «Pagar 35,00 € con tarjeta» (pegada abajo) si toca; si no, «Ver la actividad» en el contenido.
//   · «Personas de contacto» con «Llamar a …»; «¿Necesitas cambiar algo?» con «Modificar mis datos» y «Cancelar mi inscripción» (texto rojo) o el motivo.
//   · No se guarda en el móvil (teléfonos de tutores, importes): sin conexión, «Necesitas conexión para ver la inscripción».

import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import EmptyState from '@/components/ui/EmptyState';
import typography from '@/constants/typography';
import { radii, shadows } from '@/constants/uiStyles';
import { comunicaNow } from '@/services/comunica';
import { isComunicaApiError } from '@/services/comunica/client';
import type { RegistrationDetail } from '@/services/comunica/contract';
import {
  useRegistration,
  useRegistrationWrites,
} from '@/hooks/comunica/useRegistrations';
import { useActiveProfile } from '@/hooks/comunica/useActiveProfile';
import { usePayLink } from '@/hooks/comunica/usePayLink';
import { isPast } from '@/utils/comunica/activityList';
import { fullDay } from '@/utils/comunica/dates';
import { euro, paymentLine, payAction } from '@/utils/comunica/paymentLine';
import { whenLine } from '@/utils/comunica/registrationList';
import {
  REGISTRATION_TEXT as TXT,
  SAVE_ERROR,
  savedNote,
  statusNote,
  type Note,
} from '@/utils/comunica/registrationNotes';
import { firstNameOf } from '@/utils/comunica/profiles';
import { madridDay } from '@/utils/comunica/madrid';
import { h } from '@/utils/haptics';
import ActiveProfileBar from '../perfiles/ActiveProfileBar';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';
import AreaScreen from '../comun/AreaScreen';
import { AreaSkeleton, isNetwork } from '../comun/AreaState';
import BottomActionBar from '../comun/BottomActionBar';
import { confirmAction } from '../comun/confirm';
import FactList, { type Fact } from '../comun/record/FactList';
import RecordNote from '../comun/record/RecordNote';
import StatusChip from '../comun/StatusChip';
import SyncBadge from '../comun/SyncBadge';
import { useComunicaTheme } from '../comun/useComunicaTheme';

export type RegistrationNoteKind =
  'signed' | 'paid' | 'saved' | 'closed' | 'payment_error';
const NOTE_KINDS: readonly string[] = [
  'signed',
  'paid',
  'saved',
  'closed',
  'payment_error',
];

export default function RegistrationDetailScreen({
  registrationId,
  note,
  waiting = false,
}: {
  registrationId: string;
  /** Lo que se acaba de hacer (apuntarse, guardar…): el aviso de arriba. */
  note?: string;
  /** Recién vuelto del pago con tarjeta (`msg=pagado`): «esperando al banco». */
  waiting?: boolean;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const { active, isSelf } = useActiveProfile();
  const q = useRegistration(active?.id, registrationId);
  const toList = () => router.replace('/comunica/inscripciones' as never);
  const colors = {
    accentColor: t.accentText,
    titleColor: t.text,
    subtitleColor: t.textSecondary,
  };

  if (
    isComunicaApiError(q.error) &&
    ['forbidden', 'not_found'].includes(q.error.code)
  ) {
    return (
      <AreaScreen>
        <EmptyState
          icon="lock"
          title="Esta inscripción ya no está disponible"
          actionLabel="Ver mis inscripciones"
          onAction={toList}
          {...colors}
        />
      </AreaScreen>
    );
  }
  if (!q.data) {
    return (
      <AreaScreen onRefresh={() => q.refetch()}>
        <ActiveProfileBar scope="personal" section="registrations" />
        {isNetwork(q.error) ? (
          <EmptyState
            icon="wifi-off"
            title="Necesitas conexión para ver la inscripción"
            subtitle="Por seguridad, no se guarda en el móvil."
            actionLabel="Reintentar"
            onAction={() => void q.refetch()}
            {...colors}
          />
        ) : q.error ? (
          <EmptyState
            icon="error-outline"
            title="No se ha podido cargar"
            actionLabel="Ver mis inscripciones"
            onAction={toList}
            {...colors}
          />
        ) : (
          <AreaSkeleton kind="cards" />
        )}
      </AreaScreen>
    );
  }
  const first = active ? firstNameOf(active) : '';
  return (
    <Detail
      pid={active!.id}
      reg={q.data}
      child={!isSelf && first ? first : null}
      note={
        NOTE_KINDS.includes(note ?? '') ? (note as RegistrationNoteKind) : null
      }
      waiting={waiting}
      offline={isNetwork(q.error)}
      generatedAt={q.generatedAt}
      refetch={() => q.refetch()}
    />
  );
}

function Detail({
  pid,
  reg,
  child,
  note,
  waiting,
  offline,
  generatedAt,
  refetch,
}: {
  pid: string;
  reg: RegistrationDetail;
  child: string | null;
  note: RegistrationNoteKind | null;
  waiting: boolean;
  offline: boolean;
  generatedAt: string | null;
  refetch: () => Promise<unknown>;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const { cancel, busy } = useRegistrationWrites(pid, reg.id);
  const { pay, view } = usePayLink();
  const [cancelError, setCancelError] = React.useState<Note | null>(null);
  const today = madridDay(comunicaNow());
  const past = isPast(
    { startDate: reg.eventStart, endDate: reg.eventEnd },
    today,
  );
  const line = paymentLine(reg.payment, { waiting });
  const action = payAction(reg, { waiting, past });
  const status = statusNote(reg.status);
  const savedFirst = note ? savedNote(note, child) : null;
  const when = whenLine(reg, child);
  const seeEvent = () =>
    reg.eventId
      ? router.push({
          pathname: '/comunica/actividades/[eventId]',
          params: { eventId: reg.eventId },
        } as never)
      : undefined;

  const facts: Fact[] = [];
  if (reg.eventStart && reg.signedOn)
    facts.push({
      icon: 'calendar',
      label: 'Fecha de inscripción',
      value: fullDay(reg.signedOn),
    });
  if (reg.schoolLevel)
    facts.push({
      icon: 'graduationcap',
      label: 'Curso escolar',
      value: reg.schoolLevel,
    });
  if (reg.classLabel)
    facts.push({ icon: 'person.3', label: 'Clase', value: reg.classLabel });
  if (reg.participation)
    facts.push({
      icon: 'ticket',
      label: 'Tipo de participación',
      value: reg.participation,
    });
  if (reg.attendancePercent != null && reg.attendancePercent > 0)
    facts.push({
      icon: 'chart.pie',
      label: 'Asistencia',
      value: `${reg.attendancePercent} %`,
    });
  if (reg.attendees > 1)
    facts.push({
      icon: 'person.2',
      label: 'Personas',
      value: String(reg.attendees),
    });
  reg.answers.forEach((a, i) =>
    a
      ? facts.push({
          icon: 'list.bullet.clipboard',
          label:
            reg.answers.length > 1 ? `Tu respuesta (${i + 1})` : 'Tu respuesta',
          value: a,
        })
      : null,
  );
  if (line)
    facts.push({
      icon: 'creditcard',
      label: 'Pago',
      value: line.text,
      ...(line.viewPaymentId
        ? {
            onPress: () => void view(line.viewPaymentId!),
            actionLabel: `Ver el pago. ${line.text}`,
          }
        : {}),
    });

  const onCancel = async () => {
    const ok = await confirmAction(
      TXT.cancelTitle,
      TXT.cancelBody,
      TXT.cancelConfirm,
      true,
      TXT.cancelKeep,
    );
    if (!ok) return;
    setCancelError(null);
    try {
      await cancel();
      h.remove();
      router.replace({
        pathname: '/comunica/inscripciones',
        params: { note: 'cancelled' },
      } as never);
    } catch (e) {
      h.error();
      if (isComunicaApiError(e) && e.code === 'conflict') {
        setCancelError(savedNote('closed', child));
        await refetch();
        return;
      }
      setCancelError({ tone: 'danger', text: SAVE_ERROR });
    }
  };

  const m = reg.manage;
  return (
    <AreaScreen
      onRefresh={refetch}
      footer={
        action ? (
          <BottomActionBar>
            {offline ? (
              <Text style={[styles.hint, { color: t.textSecondary }]}>
                Necesitas conexión para pagar
              </Text>
            ) : null}
            <AreaPrimaryButton
              label={action.label}
              onPress={() => void pay(action.paymentId)}
              disabled={offline}
              haptic
            />
          </BottomActionBar>
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: 'Inscripción' }} />
      <ActiveProfileBar scope="personal" section="registrations" />

      {savedFirst ? (
        <RecordNote tone={savedFirst.tone} text={savedFirst.text} />
      ) : null}

      <View style={styles.hero}>
        <View style={styles.chips}>
          {reg.status.label ? (
            <StatusChip
              label={reg.status.label}
              tone={
                reg.status.tone === 'ok'
                  ? 'positive'
                  : reg.status.tone === 'warn'
                    ? 'warning'
                    : reg.status.tone === 'danger'
                      ? 'negative'
                      : 'neutral'
              }
            />
          ) : null}
          {past ? <StatusChip label="Ya celebrado" tone="neutral" /> : null}
        </View>
        <Text
          accessibilityRole="header"
          style={[styles.name, { color: t.text }]}
        >
          {reg.title}
        </Text>
        {when ? (
          <Text style={[styles.when, { color: t.textSecondary }]}>{when}</Text>
        ) : null}
      </View>

      {status ? <RecordNote tone={status.tone} text={status.text} /> : null}
      {reg.specialNeedsDescription ? (
        <RecordNote text={reg.specialNeedsDescription} />
      ) : null}

      {reg.amount != null && reg.amount > 0 ? (
        <View style={styles.amount}>
          <Text style={[styles.amountLabel, { color: t.textSecondary }]}>
            Importe de la inscripción
          </Text>
          <Text style={[styles.amountValue, { color: t.text }]}>
            {euro(reg.amount)}
          </Text>
        </View>
      ) : null}

      <FactList facts={facts} />
      {line?.notice ? (
        <RecordNote tone={line.notice.tone} text={line.notice.text} />
      ) : null}

      {!action && reg.eventId ? (
        <Secondary label="Ver la actividad" onPress={seeEvent} />
      ) : null}

      {reg.contacts.length > 0 ? (
        <View style={styles.block}>
          <Text
            accessibilityRole="header"
            style={[styles.heading, { color: t.text }]}
          >
            Personas de contacto
          </Text>
          {reg.contacts.map((c, i) => (
            <View
              key={i}
              style={[
                styles.contact,
                shadows.card,
                { backgroundColor: t.card },
              ]}
            >
              <Text style={[styles.contactName, { color: t.text }]}>
                {c.name}
              </Text>
              <Text style={[styles.contactLine, { color: t.textSecondary }]}>
                {[c.relationship, c.phone, c.email].filter(Boolean).join(' · ')}
              </Text>
              {c.phone ? (
                <Secondary
                  label={`Llamar a ${c.name}`}
                  onPress={() =>
                    void Linking.openURL(`tel:${c.phone}`).catch(
                      () => undefined,
                    )
                  }
                />
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {m.canEdit || m.canCancel || m.reason ? (
        <View style={styles.block}>
          <Text
            accessibilityRole="header"
            style={[styles.heading, { color: t.text }]}
          >
            ¿Necesitas cambiar algo?
          </Text>
          {!m.canEdit && !m.canCancel && m.reason ? (
            <RecordNote tone="warn" text={m.reason} />
          ) : null}
          {m.canEdit ? (
            <Secondary
              label="Modificar mis datos"
              onPress={() =>
                router.push({
                  pathname:
                    '/comunica/inscripciones/[registrationId]/modificar',
                  params: { registrationId: reg.id },
                } as never)
              }
            />
          ) : null}
          {m.canCancel ? (
            <PressableFeedback
              onPress={() => void onCancel()}
              isDisabled={busy === 'cancel' || offline}
              accessibilityRole="button"
              accessibilityLabel="Cancelar mi inscripción"
              style={styles.cancel}
            >
              <Text style={[styles.cancelLabel, { color: t.dangerText }]}>
                {busy === 'cancel' ? 'Cancelando…' : 'Cancelar mi inscripción'}
              </Text>
            </PressableFeedback>
          ) : null}
          {m.canEdit && !m.canCancel && m.reason ? (
            <Text style={[styles.hint, { color: t.textSecondary }]}>
              {m.reason}
            </Text>
          ) : null}
          {m.canEdit && m.canCancel && m.until ? (
            <Text style={[styles.hint, { color: t.textSecondary }]}>
              {`Hasta el ${fullDay(m.until)}.`}
            </Text>
          ) : null}
          {cancelError ? (
            <RecordNote tone={cancelError.tone} text={cancelError.text} />
          ) : null}
        </View>
      ) : null}

      <View style={styles.sync}>
        <SyncBadge generatedAt={generatedAt} />
      </View>
    </AreaScreen>
  );
}

function Secondary({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useComunicaTheme();
  return (
    <PressableFeedback
      onPress={() => {
        h.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.secondary, { borderColor: t.accentText }]}
    >
      <Text style={[styles.secondaryLabel, { color: t.accentText }]}>
        {label}
      </Text>
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 8 },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  name: { ...typography.h1 },
  when: { ...typography.body },
  amount: { gap: 2 },
  amountLabel: { ...typography.caption },
  amountValue: { ...typography.h1, fontVariant: ['tabular-nums'] },
  block: { gap: 12 },
  heading: { ...typography.title },
  contact: { borderRadius: radii.lg, padding: 16, gap: 6 },
  contactName: { ...typography.title },
  contactLine: { ...typography.subhead },
  secondary: {
    minHeight: 48,
    borderWidth: 1.5,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  secondaryLabel: { ...typography.button },
  cancel: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  cancelLabel: { ...typography.button },
  hint: { ...typography.caption, textAlign: 'center' },
  sync: { alignItems: 'center' },
});
