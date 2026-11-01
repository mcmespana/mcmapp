// La tarjeta de un pago en «Pagos» (plan 15, `sticpa_payments_card`): cápsula con la fecha, el concepto, sus líneas («Para Lucía», el medio), el chip SOLO si
// dice algo que el bloque no dice (un devuelto, «Comprobando el pago») y el importe a la derecha, GRANDE y con cifras tabulares. Tocar la tarjeta abre la
// ficha. «Pagar con tarjeta» va al pie en estilo secundario (un solo principal por pantalla: con cinco tarjetas serían cinco degradados).

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import typography from '@/constants/typography';
import { radii, shadows } from '@/constants/uiStyles';
import type { Payment } from '@/services/comunica/contract';
import {
  amountSpoken,
  canPay,
  centsToEuro,
  paymentChip,
  paymentLines,
} from '@/utils/comunica/payments';
import { h } from '@/utils/haptics';
import DateCapsule from '../comun/DateCapsule';
import StatusChip from '../comun/StatusChip';
import { useComunicaTheme } from '../comun/useComunicaTheme';

export default function PaymentCard({
  payment: p,
  onOpen,
  onPay,
}: {
  payment: Payment;
  onOpen: () => void;
  onPay: () => void;
}) {
  const t = useComunicaTheme();
  const chip = paymentChip(p);
  const lines = paymentLines(p);
  const label = [chip?.label, p.title, ...lines, amountSpoken(p.amountCents)]
    .filter(Boolean)
    .join(', ');
  return (
    <PressableFeedback
      onPress={() => {
        h.tap();
        onOpen();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Abre el pago"
      style={[styles.card, shadows.card, { backgroundColor: t.card }]}
    >
      <View style={styles.top}>
        {p.date ? <DateCapsule day={p.date} /> : null}
        <View style={styles.main}>
          {chip ? <StatusChip label={chip.label} tone={chip.tone} /> : null}
          <Text style={[styles.title, { color: t.text }]} numberOfLines={3}>
            {p.title}
          </Text>
          {lines.map((l) => (
            <Text key={l} style={[styles.line, { color: t.textSecondary }]}>
              {l}
            </Text>
          ))}
        </View>
        <Text
          accessibilityLabel={amountSpoken(p.amountCents)}
          style={[styles.amount, { color: t.text }]}
          maxFontSizeMultiplier={1.3}
        >
          {centsToEuro(p.amountCents)}
        </Text>
      </View>
      {canPay(p) ? (
        <PressableFeedback
          onPress={() => {
            h.tap();
            onPay();
          }}
          accessibilityRole="button"
          accessibilityLabel={`Pagar con tarjeta: ${p.title}`}
          style={[styles.pay, { borderColor: t.accentText }]}
        >
          <Text style={[styles.payLabel, { color: t.accentText }]}>
            Pagar con tarjeta
          </Text>
        </PressableFeedback>
      ) : null}
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.lg, padding: 16, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  main: { flex: 1, gap: 6 },
  title: { ...typography.title },
  line: { ...typography.subhead },
  amount: { ...typography.h3, fontVariant: ['tabular-nums'] },
  pay: {
    alignSelf: 'flex-start',
    minHeight: 44,
    borderWidth: 1.5,
    borderRadius: radii.pillFull,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payLabel: { ...typography.button },
});
