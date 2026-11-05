// «Forma de pago» (05/11/2026): la página `single_stic_forma_pago` del plugin en nativo. Cómo paga quien ha entrado (domiciliación, transferencia o Bizum), su IBAN
// y el titular de la cuenta.
//
//   · Es de QUIEN PAGA, no de la persona que se mira: viendo a un menor se dice «Es tu forma de pago, no la de Lucía». La pantalla pinta lo que dice el servidor
//     (las opciones, lo guardado); ella no decide nada de dinero.
//   · El IBAN NO se enseña entero: llega tapado («ES93 •••• 8644») y el campo empieza VACÍO; vacío al guardar = se queda la cuenta que había. IBAN y titular solo
//     con domiciliación. El IBAN se comprueba aquí (módulo 97) y el servidor lo vuelve a comprobar.
//   · Una sola acción principal, «Guardar», pegada abajo. Escribe DIRECTO y con conexión (sin cola: lleva el IBAN). Lo que ha pasado con lo pendiente de cobro
//     se dice arriba, con las frases del plugin; si la ficha se guardó pero algún pago no, «guardado, pero…».
//   · Nada de esto se guarda en el móvil (ver `usePaymentMethod.ts`). Salir con cambios sin guardar pregunta.

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, usePreventRemove, useRouter } from 'expo-router';
import EmptyState from '@/components/ui/EmptyState';
import { scrollToTop } from '@/components/tabs/tabBarController';
import typography from '@/constants/typography';
import { isComunicaApiError } from '@/services/comunica/client';
import type { PaymentMethodInfo } from '@/services/comunica/contract';
import { useActiveProfile } from '@/hooks/comunica/useActiveProfile';
import { useMe } from '@/hooks/comunica/useMe';
import {
  usePaymentMethod,
  useSavePaymentMethod,
} from '@/hooks/comunica/usePaymentMethod';
import { formatIban } from '@/utils/comunica/iban';
import {
  buildPaymentMethodWrite,
  currentLine,
  FIELD_OF_REASON,
  formFromInfo,
  isDirectDebit,
  isDirty,
  PAYMENT_METHOD_COPY as C,
  PAYMENT_METHOD_ERRORS as ERR,
  paymentMethodErrors,
  savedMessage,
  type PaymentMethodErrors,
  type PaymentMethodForm,
} from '@/utils/comunica/paymentMethod';
import { h } from '@/utils/haptics';
import { ChoiceGroup } from '../inscripciones/parts';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';
import AreaScreen from '../comun/AreaScreen';
import AreaSecondaryButton from '../comun/AreaSecondaryButton';
import { AreaSkeleton, isNetwork } from '../comun/AreaState';
import BottomActionBar from '../comun/BottomActionBar';
import { confirmAction } from '../comun/confirm';
import { TextFormField } from '../comun/form/FormField';
import FormSection from '../comun/form/FormSection';
import RecordNote, { type RecordNoteTone } from '../comun/record/RecordNote';
import { useComunicaTheme } from '../comun/useComunicaTheme';

export default function PaymentMethodScreen() {
  const t = useComunicaTheme();
  const router = useRouter();
  const { active } = useActiveProfile();
  const q = usePaymentMethod(active?.id);
  const colors = {
    accentColor: t.accentText,
    titleColor: t.text,
    subtitleColor: t.textSecondary,
  };

  if (isComunicaApiError(q.error) && q.error.code === 'forbidden') {
    return (
      <AreaScreen>
        <Stack.Screen options={{ title: C.title }} />
        <EmptyState
          icon="lock"
          title={C.forbidden.title}
          subtitle={C.forbidden.subtitle}
          actionLabel={C.forbidden.action}
          onAction={() => router.back()}
          {...colors}
        />
      </AreaScreen>
    );
  }
  // La ficha no se puede leer (el CRM no contesta o la respuesta no vale): ni formulario ni «todavía no has indicado cómo pagas», que no sabemos. Con datos
  // viejos delante también: esto es dinero y no se guarda a ciegas.
  if (q.error && !isNetwork(q.error)) {
    return (
      <AreaScreen onRefresh={() => q.refetch()}>
        <Stack.Screen options={{ title: C.title }} />
        <RecordNote tone="warn" text={C.unreadable} />
        <AreaSecondaryButton label={C.retry} onPress={() => void q.refetch()} />
      </AreaScreen>
    );
  }
  if (!q.data || !active) {
    // Sin datos y sin red: esto no se guarda en el móvil, así que no hay nada que enseñar.
    return (
      <AreaScreen onRefresh={() => q.refetch()}>
        <Stack.Screen options={{ title: C.title }} />
        {q.error ? (
          <EmptyState
            icon="wifi-off"
            title={C.needsConnection}
            subtitle={C.needsConnectionBody}
            actionLabel={C.retry}
            onAction={() => void q.refetch()}
            {...colors}
          />
        ) : (
          <AreaSkeleton kind="cards" />
        )}
      </AreaScreen>
    );
  }
  return (
    <MethodForm
      pid={active.id}
      info={q.data}
      offline={isNetwork(q.error)}
      refetch={() => q.refetch()}
    />
  );
}

interface Outcome {
  tone: RecordNoteTone;
  text: string;
}

function MethodForm({
  pid,
  info,
  offline,
  refetch,
}: {
  pid: string;
  info: PaymentMethodInfo;
  offline: boolean;
  refetch: () => Promise<unknown>;
}) {
  const t = useComunicaTheme();
  const { me } = useMe();
  const payerName = me?.name ?? '';
  const { save, saving } = useSavePaymentMethod(pid);
  const [form, setForm] = useState<PaymentMethodForm>(() =>
    formFromInfo(info, payerName),
  );
  const [shown, setShown] = useState<PaymentMethodErrors>({});
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const dirty = isDirty(info, form, payerName);
  const direct = isDirectDebit(form.kind);

  usePreventRemove(dirty, ({ repeat }) => {
    void confirmAction(
      C.leave.title,
      C.leave.message,
      C.leave.action,
      true,
    ).then((leave) => {
      if (leave) repeat();
    });
  });

  const set = (patch: Partial<PaymentMethodForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    setOutcome(null);
  };
  /** Al tocar un campo, su error se va; el resto se queda hasta que se arregle. */
  const clear = (field: keyof PaymentMethodErrors) =>
    setShown((s) => ({ ...s, [field]: undefined }));

  const finish = (o: Outcome) => {
    setOutcome(o);
    // El botón está pegado abajo y el aviso, arriba: se sube para que se vea.
    scrollToTop('comunica');
  };

  const onSave = async () => {
    const e = paymentMethodErrors(info, form);
    setShown(e);
    if (Object.keys(e).length > 0) {
      h.error();
      return;
    }
    if (offline) return;
    setOutcome(null);
    try {
      const r = await save(buildPaymentMethodWrite(form));
      // Lo guardado manda: el IBAN vuelve a estar vacío y la forma es la releída.
      setForm(formFromInfo(r.current, payerName));
      if (r.partial) {
        h.error();
        finish({ tone: 'warn', text: ERR.partial });
      } else {
        h.formSuccess();
        finish({ tone: 'ok', text: savedMessage(r) });
      }
    } catch (err) {
      h.error();
      if (isComunicaApiError(err) && err.code === 'validation') {
        const field = FIELD_OF_REASON[err.reason ?? ''];
        if (field) {
          setShown({ [field]: ERR[field] });
          return;
        }
      }
      finish({ tone: 'danger', text: ERR.generic });
    }
  };

  const forName = info.forName?.trim() || null;
  const context = forName ? C.contextFor(forName) : null;

  return (
    <AreaScreen
      onRefresh={refetch}
      footer={
        <BottomActionBar>
          {offline ? (
            <Text style={[styles.offline, { color: t.textSecondary }]}>
              {C.offlineSave}
            </Text>
          ) : null}
          <AreaPrimaryButton
            label={saving ? C.saving : C.save}
            onPress={() => void onSave()}
            disabled={offline}
            loading={saving}
            haptic
          />
        </BottomActionBar>
      }
    >
      <Stack.Screen options={{ title: C.title }} />
      {outcome ? <RecordNote tone={outcome.tone} text={outcome.text} /> : null}

      <View style={styles.intro}>
        <Text style={[styles.body, { color: t.text }]}>
          {context ? (
            <>
              {context.before}
              <Text style={styles.strong}>{context.strong}</Text>
              {context.after}
            </>
          ) : (
            C.contextOwn
          )}
        </Text>
        <Text style={[styles.body, { color: t.textSecondary }]}>
          {currentLine(info)}
        </Text>
      </View>

      <ChoiceGroup
        title={C.question}
        options={info.options.map((o) => ({ value: o.kind, label: o.label }))}
        value={form.kind}
        onChange={(kind) => {
          set({ kind });
          clear('kind');
        }}
        error={shown.kind}
      />

      {direct ? (
        <FormSection title="Domiciliación">
          <TextFormField
            label={C.iban}
            value={formatIban(form.iban)}
            onChangeText={(v) => {
              set({ iban: v });
              clear('iban');
            }}
            onBlur={() => setShown(paymentMethodErrors(info, form))}
            placeholder={info.ibanMasked ?? C.ibanPlaceholder}
            hint={info.ibanMasked ? C.ibanHintSaved : C.ibanHintNew}
            error={shown.iban}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            textContentType="none"
            importantForAutofill="no"
            maxLength={42}
          />
          <TextFormField
            label={C.holder}
            value={form.holder}
            onChangeText={(v) => {
              set({ holder: v });
              clear('holder');
            }}
            error={shown.holder}
            autoComplete="name"
            textContentType="name"
            maxLength={255}
          />
        </FormSection>
      ) : null}

      <Text style={[styles.effect, { color: t.textSecondary }]}>
        {C.effect}
      </Text>
    </AreaScreen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 8 },
  body: { ...typography.body },
  strong: { fontWeight: '700' },
  effect: { ...typography.caption, paddingHorizontal: 4 },
  offline: { ...typography.caption, textAlign: 'center' },
});
