// La ficha de un pago (plan 15, `sticpa_payment_detail_html`): el concepto, la fecha en palabras, el chip, el IMPORTE como dato grande con el medio debajo y los
// datos (Tipo, Cuenta enmascarada, Concepto, Descripción, Para, la referencia o el nº de operación). Un devuelto dice por qué y qué hacer. «Pagar 35,00 € con
// tarjeta» solo si se puede, pegada abajo. Nada se guarda en el móvil; sin conexión, «Necesitas conexión…».

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import EmptyState from '@/components/ui/EmptyState';
import typography from '@/constants/typography';
import { isComunicaApiError } from '@/services/comunica/client';
import { useActiveProfile } from '@/hooks/comunica/useActiveProfile';
import { usePayment } from '@/hooks/comunica/usePayments';
import { fullDay } from '@/utils/comunica/dates';
import {
  amountSpoken,
  canPay,
  centsToEuro,
  CONFIRMING_NOTE,
  detailFacts,
  isManualPending,
  MANUAL_METHOD_NOTE,
  paymentChip,
  PAYMENTS_TEXT as TXT,
  rejectionNote,
} from '@/utils/comunica/payments';
import ActiveProfileBar from '../perfiles/ActiveProfileBar';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';
import AreaScreen from '../comun/AreaScreen';
import { AreaSkeleton, isNetwork } from '../comun/AreaState';
import BottomActionBar from '../comun/BottomActionBar';
import FactList, { type Fact } from '../comun/record/FactList';
import RecordNote from '../comun/record/RecordNote';
import StatusChip from '../comun/StatusChip';
import SyncBadge from '../comun/SyncBadge';
import { useComunicaTheme } from '../comun/useComunicaTheme';

const ICONS: Record<
  string,
  React.ComponentProps<typeof FactList>['facts'][number]['icon']
> = {
  Tipo: 'doc.text',
  Cuenta: 'creditcard',
  Concepto: 'doc.text',
  Descripción: 'doc.text',
  Para: 'person.crop.circle',
  'Nº de operación': 'ticket',
  Referencia: 'ticket',
};

export default function PaymentDetailScreen({ id }: { id: string }) {
  const t = useComunicaTheme();
  const router = useRouter();
  const { active } = useActiveProfile();
  const q = usePayment(active?.id, id);
  const toList = () => router.replace('/comunica/pagos' as never);
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
          title={TXT.unavailable}
          subtitle={TXT.unavailableBody}
          actionLabel={TXT.seeAll}
          onAction={toList}
          {...colors}
        />
      </AreaScreen>
    );
  }
  if (!q.data) {
    return (
      <AreaScreen onRefresh={() => q.refetch()}>
        <ActiveProfileBar scope="shared" section="payments" />
        {q.error ? (
          <EmptyState
            icon={isNetwork(q.error) ? 'wifi-off' : 'error-outline'}
            title={
              isNetwork(q.error)
                ? TXT.needsConnection
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
  const d = q.data;
  const chip = paymentChip(d);
  const reject = rejectionNote(d);
  const facts: Fact[] = detailFacts(d).map((f) => ({
    icon: ICONS[f.label] ?? 'doc.text',
    label: f.label,
    value: f.value,
  }));
  return (
    <AreaScreen
      onRefresh={() => q.refetch()}
      footer={
        canPay(d) ? (
          <BottomActionBar>
            {isNetwork(q.error) ? (
              <Text style={[styles.hint, { color: t.textSecondary }]}>
                Necesitas conexión para pagar
              </Text>
            ) : null}
            <AreaPrimaryButton
              label={`Pagar ${centsToEuro(d.amountCents)} con tarjeta`}
              onPress={() =>
                router.push({
                  pathname: '/comunica/pagos/pagar',
                  params: { pago: d.id },
                } as never)
              }
              disabled={isNetwork(q.error)}
              haptic
            />
          </BottomActionBar>
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: 'Pago' }} />
      <ActiveProfileBar scope="shared" section="payments" />
      <View style={styles.hero}>
        {chip ? <StatusChip label={chip.label} tone={chip.tone} /> : null}
        <Text
          accessibilityRole="header"
          style={[styles.name, { color: t.text }]}
        >
          {d.title}
        </Text>
        {d.date ? (
          <Text style={[styles.when, { color: t.textSecondary }]}>
            {fullDay(d.date)}
          </Text>
        ) : null}
      </View>
      <View style={styles.amountBox}>
        <Text
          accessibilityLabel={amountSpoken(d.amountCents)}
          style={[styles.amount, { color: t.text }]}
          maxFontSizeMultiplier={1.3}
        >
          {centsToEuro(d.amountCents)}
        </Text>
        <Text style={[styles.method, { color: t.textSecondary }]}>
          {[d.statusLabel, d.methodLabel].filter(Boolean).join(' · ')}
        </Text>
      </View>
      {reject ? <RecordNote tone="danger" text={reject} /> : null}
      {d.confirmingSince ? <RecordNote text={CONFIRMING_NOTE} /> : null}
      {isManualPending(d) ? <RecordNote text={MANUAL_METHOD_NOTE} /> : null}
      <FactList facts={facts} />
      <View style={styles.sync}>
        <SyncBadge generatedAt={q.generatedAt} />
      </View>
    </AreaScreen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 8 },
  name: { ...typography.h1 },
  when: { ...typography.body },
  amountBox: { gap: 2 },
  amount: { ...typography.h0, fontVariant: ['tabular-nums'] },
  method: { ...typography.body },
  hint: { ...typography.caption, textAlign: 'center' },
  sync: { alignItems: 'center' },
});
