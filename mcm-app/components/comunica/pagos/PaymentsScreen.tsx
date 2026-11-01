// «Pagos» (plan 15, `sticpa_payments_list_html`): «¿qué debo, de qué y cómo lo pago?». Tres bloques (más «Otros»): «Pendiente de pagar», «Se cobrará por
// domiciliación» y «Pagado». El dinero es DE QUIEN PAGA: viéndose a sí mismo, todo lo que paga (con «Para Lucía»); viendo a un hijo, solo lo de ese hijo.
//
//   · Siempre con conexión y sin guardar nada en el móvil (importes, concepto, cuenta). Sin conexión y sin lo de esta sesión: «Necesitas conexión…».
//   · Si la app se cerró a mitad de un pago, aquí se comprueba y se dice una vez cómo acabó.
//   · Mientras el banco confirma un pago, ni la lista ni la ficha ofrecen pagarlo: chip «Comprobando el pago».

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import EmptyState from '@/components/ui/EmptyState';
import typography from '@/constants/typography';
import { useActiveProfile } from '@/hooks/comunica/useActiveProfile';
import { usePayments, useResumedAttempt } from '@/hooks/comunica/usePayments';
import { firstNameOf } from '@/utils/comunica/profiles';
import { paymentBlocks, PAYMENTS_TEXT as TXT } from '@/utils/comunica/payments';
import type { Payment } from '@/services/comunica/contract';
import ActiveProfileBar from '../perfiles/ActiveProfileBar';
import AreaScreen from '../comun/AreaScreen';
import AreaState, { isNetwork } from '../comun/AreaState';
import RecordNote from '../comun/record/RecordNote';
import SyncBadge from '../comun/SyncBadge';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import PaymentCard from './PaymentCard';

/** `note`: «pagado» (la vuelta del banco por la web) o «error» (una vuelta KO): los textos del plugin. */
export default function PaymentsScreen({ note }: { note?: string }) {
  const t = useComunicaTheme();
  const router = useRouter();
  const { active, isSelf } = useActiveProfile();
  const q = usePayments(active?.id);
  const resumed = useResumedAttempt(active?.id);
  const first = active ? firstNameOf(active) : '';
  const child = !isSelf && first ? first : null;
  const open = (p: Payment) =>
    router.push({
      pathname: '/comunica/pagos/[id]',
      params: { id: p.id },
    } as never);
  const pay = (p: Payment) =>
    router.push({
      pathname: '/comunica/pagos/pagar',
      params: { pago: p.id },
    } as never);

  return (
    <AreaScreen onRefresh={() => q.refetch()}>
      <ActiveProfileBar scope="shared" section="payments" />
      {note === 'pagado' ? <RecordNote tone="ok" text={TXT.paidNote} /> : null}
      {note === 'error' ? (
        <RecordNote tone="warn" text={TXT.errorNote} />
      ) : null}
      {resumed?.state === 'paid' ? (
        <RecordNote tone="ok" text="Pago hecho." />
      ) : resumed?.state === 'confirming' ? (
        <RecordNote text="Estamos esperando la confirmación del banco. En unos minutos lo verás como pagado." />
      ) : null}
      {q.error && !q.data && isNetwork(q.error) ? (
        <EmptyState
          icon="wifi-off"
          title={TXT.needsConnection}
          actionLabel="Reintentar"
          onAction={() => void q.refetch()}
          accentColor={t.accentText}
          titleColor={t.text}
          subtitleColor={t.textSecondary}
        />
      ) : (
        <AreaState query={q} skeleton="cards">
          {(data) => {
            const blocks = paymentBlocks(data.payments);
            if (blocks.length === 0)
              return (
                <EmptyState
                  icon="inbox"
                  title={child ? TXT.emptyOf(child) : TXT.emptyOwn}
                  subtitle={TXT.emptyBody}
                  titleColor={t.text}
                  subtitleColor={t.textSecondary}
                />
              );
            return (
              <View style={styles.list}>
                {blocks.map((b) => (
                  <View key={b.key} style={styles.block}>
                    <Text
                      accessibilityRole="header"
                      style={[styles.blockTitle, { color: t.textSecondary }]}
                    >
                      {b.title}
                    </Text>
                    {b.payments.map((p) => (
                      <PaymentCard
                        key={p.id}
                        payment={p}
                        onOpen={() => open(p)}
                        onPay={() => pay(p)}
                      />
                    ))}
                  </View>
                ))}
                <View style={styles.sync}>
                  <SyncBadge generatedAt={q.generatedAt} />
                </View>
              </View>
            );
          }}
        </AreaState>
      )}
    </AreaScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 20 },
  block: { gap: 12 },
  blockTitle: { ...typography.caption, textTransform: 'uppercase' },
  sync: { alignItems: 'center' },
});
