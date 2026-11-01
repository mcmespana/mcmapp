// «Pagar con tarjeta» (plan 15, `single_stic_payment_form`): un RESUMEN, no un formulario. Nada editable salvo el importe tras «Pagar otra cantidad».
//
//   · Parámetros `pago=<id>` o `inscripcion=<id>`; sin ninguno no hay pantalla de pago (nunca un donativo).
//   · Rebotes: `nothing_to_pay`, `not_payable`, `missing_payer_data` (a «Completar mis datos», en el perfil de quien paga).
//   · «Pagar otra cantidad»: «¿Cuánto vas a pagar?», coma o punto, mínimo 1 €, sin tope; más del doble de lo indicado pide confirmar. Es un descuento, no un
//     pago parcial: lo que no se paga no queda pendiente.
//   · El botón repite el importe («Pagar 20,50 €»), se apaga si no vale y NO se puede pulsar dos veces.
//   · La pasarela del banco, en una hoja (`CardGatewaySheet`); el resultado, en esta misma pantalla. El servidor decide si está pagado: aquí nunca.
//   · Sin conexión, «Necesitas conexión para pagar».

import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { PressableFeedback } from 'heroui-native';
import EmptyState from '@/components/ui/EmptyState';
import typography from '@/constants/typography';
import { useActiveProfile } from '@/hooks/comunica/useActiveProfile';
import {
  useCardCheckout,
  useCardPayment,
  type PaySource,
} from '@/hooks/comunica/usePayments';
import type { CardCheckout } from '@/services/comunica/contract';
import {
  parseBrowserReturn,
  resultCopy,
  type GatewayResult,
} from '@/utils/comunica/cardAttempt';
import {
  amountChanged,
  amountSpoken,
  centsToEuro,
  doubleCheckText,
  needsDoubleCheck,
  parseEuroAmount,
} from '@/utils/comunica/payments';
import { h } from '@/utils/haptics';
import ActiveProfileBar from '../perfiles/ActiveProfileBar';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';
import AreaScreen from '../comun/AreaScreen';
import { AreaSkeleton, isNetwork } from '../comun/AreaState';
import BottomActionBar from '../comun/BottomActionBar';
import { confirmAction } from '../comun/confirm';
import FactList, { type Fact } from '../comun/record/FactList';
import RecordNote from '../comun/record/RecordNote';
import { TextFormField } from '../comun/form/FormField';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import CardGatewaySheet from './CardGatewaySheet';
import PaymentResult from './PaymentResult';

const OTHER_NOTE =
  'Solo si te han dicho que pagues otra cantidad: un descuento, una beca, un arreglo con tu delegación. Lo que pagues es lo que quedará como pagado.';
const BROWSER_RETURN = 'mcmapp://comunica/pagos/vuelta';

export default function PayScreen({
  pago,
  inscripcion,
}: {
  pago?: string;
  inscripcion?: string;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const { active } = useActiveProfile();
  const source: PaySource | null = pago
    ? { payment: pago }
    : inscripcion
      ? { registration: inscripcion }
      : null;
  const q = useCardCheckout(active?.id, source);
  const toPayments = () => router.replace('/comunica/pagos' as never);
  const colors = {
    accentColor: t.accentText,
    titleColor: t.text,
    subtitleColor: t.textSecondary,
  };

  const rebound = (
    title: string,
    subtitle: string,
    action?: { label: string; on: () => void },
  ) => (
    <AreaScreen>
      <Stack.Screen options={{ title: 'Pagar' }} />
      <EmptyState
        icon="info-outline"
        title={title}
        subtitle={subtitle}
        actionLabel={action?.label ?? 'Ver mis pagos'}
        onAction={action?.on ?? toPayments}
        {...colors}
      />
    </AreaScreen>
  );

  // Sin pago ni inscripción no hay pantalla de pago (nunca un donativo).
  if (!source)
    return rebound(
      'No hay nada que pagar aquí',
      'Lo que tengas pendiente de pagar está en Pagos.',
    );
  if (!q.data) {
    return (
      <AreaScreen>
        <Stack.Screen options={{ title: 'Pagar' }} />
        {q.error ? (
          <EmptyState
            icon={isNetwork(q.error) ? 'wifi-off' : 'error-outline'}
            title={
              isNetwork(q.error)
                ? 'Necesitas conexión para pagar'
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
  const c = q.data.checkout;
  if (!c.payable) {
    if (c.reason === 'nothing_to_pay')
      return rebound(
        'No hay nada que pagar aquí',
        'Lo que tengas pendiente de pagar está en Pagos.',
      );
    if (c.reason === 'not_payable')
      return rebound(
        'Este pago no está pendiente',
        'Puede que ya esté pagado o que se cobre por domiciliación. Míralo en Pagos.',
      );
    return rebound(
      'Te faltan datos para poder pagar',
      'Necesitamos tu nombre, apellidos, correo y documento de identidad. Complétalos en tus datos y vuelve al pago.',
      {
        label: 'Completar mis datos',
        // En el perfil de QUIEN PAGA, no del hijo.
        on: () =>
          router.push({
            pathname: '/comunica/datos',
            params: { yo: '1', completar: 'pago' },
          } as never),
      },
    );
  }
  return (
    <PayFlow
      pid={active!.id}
      source={source}
      checkout={c}
      offline={isNetwork(q.error)}
    />
  );
}

function PayFlow({
  pid,
  source,
  checkout,
  offline,
}: {
  pid: string;
  source: PaySource;
  checkout: Extract<CardCheckout['checkout'], { payable: true }>;
  offline: boolean;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const card = useCardPayment({ pid, source });
  const [other, setOther] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const indicated = checkout.amountCents;
  const fromRegistration = typeof checkout.returnTo === 'object';

  const parsed = other
    ? parseEuroAmount(text)
    : { ok: true as const, cents: indicated };
  const cents = parsed.ok ? parsed.cents : null;
  const label = cents != null ? `Pagar ${centsToEuro(cents)}` : 'Pagar';
  const phase = card.phase;

  // `h` al acabar: bien o mal.
  const resultKind = phase.kind === 'result' ? phase.result : null;
  useEffect(() => {
    if (resultKind === 'paid') h.formSuccess();
    else if (resultKind === 'failed' || resultKind === 'cancelled') h.error();
    if (phase.kind !== 'summary' && phase.kind !== 'result') return;
    busy.current = false;
  }, [resultKind, phase.kind]);

  const onPay = async () => {
    if (busy.current || cents == null) return;
    if (!parsed.ok) {
      setError(parsed.message);
      h.error();
      return;
    }
    if (needsDoubleCheck(parsed.cents, indicated)) {
      const ok = await confirmAction(
        '¿Es correcto?',
        doubleCheckText(parsed.cents, indicated),
        `Pagar ${centsToEuro(parsed.cents)}`,
        false,
        'Corregir',
      );
      if (!ok) return;
    }
    busy.current = true;
    setError(null);
    await card.start(parsed.cents);
  };

  const openBrowser = async () => {
    if (cents == null) return;
    await card.startBrowser(cents, async (url) => {
      const r = await WebBrowser.openAuthSessionAsync(url, BROWSER_RETURN);
      if (r.type !== 'success') return 'closed' as GatewayResult;
      return parseBrowserReturn(r.url)?.returned ?? 'closed';
    });
  };

  const toDestination = (note?: string) => {
    const registrationId =
      (phase.kind === 'result' && phase.registrationId) ||
      (typeof checkout.returnTo === 'object'
        ? checkout.returnTo.registration
        : null);
    if (fromRegistration && registrationId)
      router.replace({
        pathname: '/comunica/inscripciones/[registrationId]',
        params: { registrationId, ...(note ? { msg: 'pagado' } : {}) },
      } as never);
    else router.replace('/comunica/pagos' as never);
  };

  // ── El resultado, en esta misma pantalla ──
  if (phase.kind === 'result') {
    const copy = resultCopy(phase.result, {
      child: checkout.forName ?? null,
      fromRegistration,
    });
    const isRetry =
      phase.result === 'failed' ||
      phase.result === 'cancelled' ||
      phase.result === 'create_failed';
    return (
      <AreaScreen>
        <Stack.Screen options={{ title: 'Pagar' }} />
        <PaymentResult
          copy={copy}
          onPrimary={() =>
            isRetry
              ? void card.retry()
              : toDestination(
                  phase.result === 'paid' ? undefined : 'confirming',
                )
          }
          onSecondary={() => router.back()}
        />
      </AreaScreen>
    );
  }

  const facts: Fact[] = [
    { icon: 'person.crop.circle', label: 'Paga', value: checkout.payer.name },
    ...(checkout.forName
      ? [{ icon: 'person.2' as const, label: 'Para', value: checkout.forName }]
      : []),
    { icon: 'doc.text', label: 'Concepto', value: checkout.concept },
    { icon: 'creditcard', label: 'Importe', value: centsToEuro(indicated) },
  ];
  const working = phase.kind !== 'summary';

  return (
    <AreaScreen
      footer={
        <BottomActionBar>
          {offline ? (
            <Text style={[styles.hint, { color: t.textSecondary }]}>
              Necesitas conexión para pagar
            </Text>
          ) : null}
          <AreaPrimaryButton
            label={label}
            onPress={() => void onPay()}
            disabled={offline || cents == null}
            loading={working}
            accessibilityLabel={
              cents != null ? `Pagar ${amountSpoken(cents)}` : 'Pagar'
            }
            haptic
          />
        </BottomActionBar>
      }
    >
      <Stack.Screen options={{ title: 'Pagar' }} />
      <ActiveProfileBar scope="shared" section="payments" />
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: t.text }]}
      >
        Pagar con tarjeta
      </Text>
      <FactList facts={facts} />
      <Text style={[styles.hint, { color: t.textSecondary }]}>
        Pagarás en la página del banco: la app no guarda los datos de tu
        tarjeta.
      </Text>

      <PressableFeedback
        onPress={() => {
          h.toggle();
          setOther((v) => !v);
          setError(null);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: other }}
        accessibilityLabel="Pagar otra cantidad"
        style={styles.otherToggle}
      >
        <Text style={[styles.toggleLabel, { color: t.accentText }]}>
          {other ? `Pagar ${centsToEuro(indicated)}` : 'Pagar otra cantidad'}
        </Text>
      </PressableFeedback>
      {other ? (
        <View style={styles.other}>
          <TextFormField
            label="¿Cuánto vas a pagar?"
            value={text}
            onChangeText={(v) => {
              setText(v);
              setError(null);
            }}
            error={
              error ?? (text !== '' && !parsed.ok ? parsed.message : undefined)
            }
            hint={OTHER_NOTE}
            keyboardType="decimal-pad"
            inputMode="decimal"
            maxLength={12}
          />
          {parsed.ok &&
          text !== '' &&
          amountChanged(parsed.cents, indicated) ? (
            <RecordNote
              text={`Indicado: ${centsToEuro(indicated)}. Pagarás: ${centsToEuro(parsed.cents)}.`}
            />
          ) : null}
        </View>
      ) : null}

      {phase.kind === 'paying' && card.attempt ? (
        <CardGatewaySheet
          attempt={card.attempt}
          amountLabel={centsToEuro(card.amountCents)}
          onResult={(r) => void card.onGateway(r)}
          onRetry={() => void card.retry()}
          onBrowser={() => void openBrowser()}
        />
      ) : null}
    </AreaScreen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h2 },
  hint: { ...typography.caption },
  otherToggle: { minHeight: 44, justifyContent: 'center' },
  toggleLabel: { ...typography.button },
  other: { gap: 12 },
});
