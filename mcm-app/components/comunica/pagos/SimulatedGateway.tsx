// La pasarela de MENTIRA (plan 15): solo con el servidor falso (`simulated: true`). Pinta los botones que haría el banco —«Pagar», «Rechazar»— y dice qué
// pasó; NO importa el falso ni sabe nada de él. «Cerrar» es el de la cabecera de la hoja.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { useComunicaTheme } from '../comun/useComunicaTheme';

export default function SimulatedGateway({
  amountLabel,
  onResult,
}: {
  amountLabel: string;
  onResult: (r: 'ok' | 'ko') => void;
}) {
  const t = useComunicaTheme();
  return (
    <View style={styles.wrap} accessibilityLabel="Pasarela del banco de prueba">
      <Text style={[styles.title, { color: t.text }]}>Banco de prueba</Text>
      <Text style={[styles.body, { color: t.textSecondary }]}>
        Esto no es un banco de verdad: no se cobra nada. Elige qué quieres que
        pase.
      </Text>
      <Text style={[styles.amount, { color: t.text }]}>{amountLabel}</Text>
      <PressableFeedback
        onPress={() => onResult('ok')}
        accessibilityRole="button"
        accessibilityLabel="Pagar"
        style={[styles.button, { backgroundColor: t.accentFill }]}
      >
        <Text style={[styles.label, { color: t.onAccent }]}>Pagar</Text>
      </PressableFeedback>
      <PressableFeedback
        onPress={() => onResult('ko')}
        accessibilityRole="button"
        accessibilityLabel="Rechazar"
        style={[styles.button, { borderColor: t.accentText, borderWidth: 1.5 }]}
      >
        <Text style={[styles.label, { color: t.accentText }]}>Rechazar</Text>
      </PressableFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
  title: { ...typography.h2 },
  body: { ...typography.body },
  amount: { ...typography.h1, fontVariant: ['tabular-nums'] },
  button: {
    minHeight: 52,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...typography.button },
});
