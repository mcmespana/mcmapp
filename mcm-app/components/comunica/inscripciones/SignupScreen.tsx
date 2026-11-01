// El alta corta (plan 14, `single_stic_registrations&action=create&from=stic_events`): apuntarse a una actividad.
//
//   · Arriba el resumen («Te inscribes a» / «Inscribes a Lucía en»), neutro, con «Ver la actividad».
//   · Bloqueos, por este orden: plaza ya cogida → audiencia o plazo → formulario avanzado. Con bloqueo, ni un campo: el resumen, el aviso y «Volver».
//   · Preguntas (un grupo de opciones obligatorio cada una); con precio, «¿Cómo pagas?» con los medios que dé el CRM y, con domiciliación, el IBAN;
//     necesidades especiales.
//   · «Apuntarme» / «Apuntar a Lucía»: si falta algo no se envía (error en su campo y `h.error`). Directo, con conexión, sin cola: el IBAN solo vive aquí.
//   · Al aplicarse, a la ficha nueva con «Listo: …»; con tarjeta, además el pago.

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import EmptyState from '@/components/ui/EmptyState';
import typography from '@/constants/typography';
import { isComunicaApiError } from '@/services/comunica/client';
import type { SignupForm } from '@/services/comunica/contract';
import {
  useOpenAdvancedForm,
  useSignUp,
  useSignupForm,
} from '@/hooks/comunica/useRegistrations';
import { useActiveProfile } from '@/hooks/comunica/useActiveProfile';
import { usePayLink } from '@/hooks/comunica/usePayLink';
import { dateRangeText } from '@/utils/comunica/recordDates';
import { firstNameOf } from '@/utils/comunica/profiles';
import { formatIban } from '@/utils/comunica/iban';
import {
  buildSignup,
  EMPTY_DRAFT,
  firstErrorField,
  needsPayment,
  questionTitle,
  signupErrors,
  type SignupDraft,
  type SignupErrors,
} from '@/utils/comunica/signupForm';
import { euro } from '@/utils/comunica/paymentLine';
import { SIGNUP_ERROR } from '@/utils/comunica/registrationNotes';
import { h } from '@/utils/haptics';
import ActiveProfileBar from '../perfiles/ActiveProfileBar';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';
import AreaScreen from '../comun/AreaScreen';
import { AreaSkeleton, isNetwork } from '../comun/AreaState';
import BottomActionBar from '../comun/BottomActionBar';
import RecordNote from '../comun/record/RecordNote';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import { TextFormField } from '../comun/form/FormField';
import FormSection from '../comun/form/FormSection';
import { ChoiceGroup, SpecialNeedsField } from './parts';

export const SIGNUP_NEEDS_CONNECTION = 'Necesitas conexión para apuntarte';

export default function SignupScreen({ eventId }: { eventId: string }) {
  const t = useComunicaTheme();
  const router = useRouter();
  const { active, isSelf } = useActiveProfile();
  const q = useSignupForm(active?.id, eventId);
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
          title="Esta actividad ya no está disponible"
          subtitle="Es posible que se haya retirado. Consulta el resto de actividades abiertas."
          actionLabel="Ver eventos"
          onAction={() => router.replace('/comunica/actividades' as never)}
          {...colors}
        />
      </AreaScreen>
    );
  }
  if (!q.data) {
    return (
      <AreaScreen onRefresh={() => q.refetch()}>
        <ActiveProfileBar scope="shared" section="events" />
        {q.error ? (
          <EmptyState
            icon={isNetwork(q.error) ? 'wifi-off' : 'error-outline'}
            title={
              isNetwork(q.error)
                ? SIGNUP_NEEDS_CONNECTION
                : 'No se ha podido cargar'
            }
            actionLabel="Reintentar"
            onAction={() => void q.refetch()}
            {...colors}
          />
        ) : (
          <AreaSkeleton kind="cards" />
        )}
      </AreaScreen>
    );
  }
  const childName =
    !isSelf && active && firstNameOf(active) ? firstNameOf(active) : null;
  return (
    <Form
      pid={active!.id}
      eventId={eventId}
      form={q.data}
      childName={childName}
      offline={isNetwork(q.error)}
      refetch={() => q.refetch()}
    />
  );
}

function Summary({
  form,
  childName,
  onSee,
}: {
  form: SignupForm;
  childName: string | null;
  onSee: () => void;
}) {
  const t = useComunicaTheme();
  const dates = dateRangeText(form.event.startDate, form.event.endDate);
  return (
    <View style={styles.summary}>
      <Text style={[styles.kicker, { color: t.textSecondary }]}>
        {childName ? `Inscribes a ${childName} en` : 'Te inscribes a'}
      </Text>
      <Text accessibilityRole="header" style={[styles.name, { color: t.text }]}>
        {form.event.name}
      </Text>
      {dates ? (
        <Text style={[styles.body, { color: t.textSecondary }]}>{dates}</Text>
      ) : null}
      {form.event.description ? (
        <Text style={[styles.body, { color: t.text }]} numberOfLines={4}>
          {form.event.description}
        </Text>
      ) : null}
      <Text
        accessibilityRole="link"
        onPress={onSee}
        style={[styles.link, { color: t.accentText }]}
      >
        Ver la actividad
      </Text>
    </View>
  );
}

function Form({
  pid,
  eventId,
  form,
  childName,
  offline,
  refetch,
}: {
  pid: string;
  eventId: string;
  form: SignupForm;
  childName: string | null;
  offline: boolean;
  refetch: () => Promise<unknown>;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const { submit, sending } = useSignUp(pid);
  const openAdvanced = useOpenAdvancedForm(pid);
  const { pay } = usePayLink();
  const [draft, setDraft] = useState<SignupDraft>(EMPTY_DRAFT);
  const [shown, setShown] = useState<SignupErrors>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [advancedError, setAdvancedError] = useState(false);
  const seeEvent = () =>
    router.push({
      pathname: '/comunica/actividades/[eventId]',
      params: { eventId },
    } as never);
  const set = (patch: Partial<SignupDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setFailed(null);
  };
  const blocked = form.blocked;
  const pays = needsPayment(form);

  // ── Con bloqueo, ni un campo ──
  if (blocked) {
    return (
      <AreaScreen
        footer={
          blocked.reason === 'advanced_form' ? (
            <PrimaryFooter
              label="Ir al formulario de inscripción"
              onPress={async () => {
                const r = await openAdvanced(eventId);
                if (r !== 'opened') setAdvancedError(true);
              }}
            />
          ) : undefined
        }
      >
        <Stack.Screen options={{ title: 'Inscripción' }} />
        <Summary form={form} childName={childName} onSee={seeEvent} />
        {blocked.reason === 'already_registered' ? (
          <RecordNote
            tone="ok"
            title={
              childName
                ? `${childName} ya tiene su plaza`
                : 'Ya tienes tu plaza'
            }
            text={
              childName
                ? `${childName} ya tiene una inscripción activa para esta actividad. No hace falta repetirla.`
                : 'Ya tienes una inscripción activa para esta actividad. No hace falta repetirla.'
            }
          />
        ) : blocked.reason === 'advanced_form' ? (
          <RecordNote
            title="Esta actividad tiene su propio formulario"
            text="La inscripción se hace en el formulario de la actividad, que pide algún dato más. Te lo abrimos con tus datos ya puestos."
          />
        ) : (
          <RecordNote
            tone="warn"
            title={blocked.title}
            text={blocked.message}
          />
        )}
        {advancedError ? (
          <RecordNote
            tone="warn"
            text="No hemos podido abrir el formulario. Inténtalo otra vez en un rato."
          />
        ) : null}
        <BackLink
          registrationId={
            blocked.reason === 'already_registered'
              ? blocked.registrationId
              : null
          }
        />
      </AreaScreen>
    );
  }

  const onSend = async () => {
    const e = signupErrors(form, draft);
    setShown(e);
    if (firstErrorField(e)) {
      h.error();
      return;
    }
    if (offline) return;
    setFailed(null);
    try {
      const r = await submit((clientId) =>
        buildSignup(form, draft, clientId, eventId),
      );
      h.formSuccess();
      router.replace({
        pathname: '/comunica/inscripciones/[registrationId]',
        params: {
          registrationId: r.registrationId,
          note: r.payment === 'error' ? 'payment_error' : 'signed',
        },
      } as never);
      // Con tarjeta, además el pago (plan 15): al volver atrás se cae en la inscripción.
      if (draft.method === 'card' && r.payment === 'noted')
        void pay(r.cardPaymentId);
    } catch (e2) {
      h.error();
      if (isComunicaApiError(e2)) {
        if (
          e2.code === 'validation' &&
          (e2.reason === 'answers' || e2.reason === 'payment')
        ) {
          setShown(
            e2.reason === 'answers'
              ? { answers: e2.message }
              : { payment: e2.message },
          );
          return;
        }
        if (e2.code === 'conflict' || e2.code === 'forbidden') {
          // El servidor es el guard: se vuelve a mirar y sale su bloqueo.
          await refetch();
          return;
        }
      }
      setFailed(SIGNUP_ERROR);
    }
  };

  const label = childName ? `Apuntar a ${childName}` : 'Apuntarme';
  return (
    <AreaScreen
      onRefresh={refetch}
      footer={
        <PrimaryFooter
          label={label}
          onPress={() => void onSend()}
          note={offline ? SIGNUP_NEEDS_CONNECTION : undefined}
          disabled={offline}
          loading={sending}
        />
      }
    >
      <Stack.Screen options={{ title: 'Inscripción' }} />
      <ActiveProfileBar scope="shared" section="events" />
      <Summary form={form} childName={childName} onSee={seeEvent} />

      {form.questions.map((q, i) => (
        <ChoiceGroup
          key={q.n}
          title={questionTitle(q, form.questions.length)}
          options={q.options.map((o, k) => ({ value: k + 1, label: o }))}
          value={draft.answers[q.n]}
          onChange={(v) => {
            set({ answers: { ...draft.answers, [q.n]: v } });
            setShown((s) => ({ ...s, answers: undefined }));
          }}
          error={i === form.questions.length - 1 ? shown.answers : undefined}
        />
      ))}

      {pays ? (
        <View style={styles.pay}>
          <View style={styles.payHead}>
            <Text
              accessibilityRole="header"
              style={[styles.payTitle, { color: t.text }]}
            >
              ¿Cómo pagas?
            </Text>
            <Text style={[styles.price, { color: t.text }]}>
              {euro(form.price!)}
            </Text>
          </View>
          <ChoiceGroup
            title="¿Cómo pagas?"
            options={form.paymentMethods.map((m) => ({
              value: m.key,
              label: m.label,
              icon: m.key === 'card' ? 'creditcard' : 'house',
              note: m.key === 'card' ? 'Pago online' : undefined,
            }))}
            value={draft.method}
            onChange={(v) => {
              set({ method: v });
              setShown((s) => ({ ...s, payment: undefined }));
            }}
            error={shown.payment}
          />
          {draft.method === 'direct_debit' ? (
            <FormSection title="Domiciliación">
              <TextFormField
                label="IBAN"
                value={formatIban(draft.iban)}
                onChangeText={(v) => set({ iban: v })}
                onBlur={() => setShown(signupErrors(form, draft))}
                error={shown.iban}
                autoCapitalize="characters"
                autoCorrect={false}
                autoComplete="off"
                textContentType="none"
                importantForAutofill="no"
                maxLength={42}
              />
            </FormSection>
          ) : null}
        </View>
      ) : null}

      <SpecialNeedsField
        def={form.specialNeeds}
        value={draft.specialNeeds}
        description={draft.specialNeedsDescription}
        onValue={(v) => set({ specialNeeds: v })}
        onDescription={(v) => set({ specialNeedsDescription: v })}
      />

      {failed ? <RecordNote tone="danger" text={failed} /> : null}
    </AreaScreen>
  );
}

/** La única acción principal de la pantalla, pegada abajo (con su nota encima si la hay). */
function PrimaryFooter({
  label,
  onPress,
  note,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  note?: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  const t = useComunicaTheme();
  return (
    <BottomActionBar>
      {note ? (
        <Text style={[styles.note, { color: t.textSecondary }]}>{note}</Text>
      ) : null}
      <AreaPrimaryButton
        label={label}
        onPress={onPress}
        disabled={disabled}
        loading={loading}
        haptic
      />
    </BottomActionBar>
  );
}

function BackLink({ registrationId }: { registrationId: string | null }) {
  const t = useComunicaTheme();
  const router = useRouter();
  return (
    <View style={styles.back}>
      {registrationId ? (
        <Text
          accessibilityRole="link"
          onPress={() =>
            router.replace({
              pathname: '/comunica/inscripciones/[registrationId]',
              params: { registrationId },
            } as never)
          }
          style={[styles.link, { color: t.accentText }]}
        >
          Ver la inscripción
        </Text>
      ) : null}
      <Text
        accessibilityRole="link"
        onPress={() => router.back()}
        style={[styles.link, { color: t.accentText }]}
      >
        Volver
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { gap: 6 },
  kicker: { ...typography.subhead },
  name: { ...typography.h2 },
  body: { ...typography.body },
  link: { ...typography.button, minHeight: 44, textAlignVertical: 'center' },
  pay: { gap: 12 },
  payHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  payTitle: { ...typography.title },
  price: { ...typography.title, fontVariant: ['tabular-nums'] },
  note: { ...typography.caption, textAlign: 'center' },
  back: { gap: 4 },
});
