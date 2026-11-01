// Los avisos de «Entra en tu área» cuando el código no se puede mandar (plan 02; igual que la web desde el 31/10/2026, `ACCESO.md` §2):
//
//   · `MissNotice`: «Ese correo no está en Comunica», con el correo tecleado (para ver la errata).
//   · `DniCard`: debajo, abierta, «¿Te diste de alta con otro correo?» y el botón en contorno «Buscarme por mi DNI».
//   · `OfficeLink`: «Escribir a la oficina técnica», para lo que la app no resuelve sola (ficha sin correo, demasiados intentos).

import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { h } from '@/utils/haptics';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import { ACCESS_TEXT, OFFICE_EMAIL } from './copy';

export function MissNotice({ email }: { email: string }) {
  const t = useComunicaTheme();
  return (
    <View
      style={[styles.miss, { backgroundColor: t.chip('negative').background }]}
      accessibilityRole="alert"
    >
      <View style={styles.missHead}>
        <IconSymbol
          name="exclamationmark.triangle.fill"
          size={20}
          color={t.dangerText}
        />
        <Text style={[styles.missTitle, { color: t.text }]}>
          {ACCESS_TEXT.noEmailMatch}
        </Text>
      </View>
      <Text style={[styles.missEmail, { color: t.text }]} selectable>
        {email}
      </Text>
      <Text style={[styles.hint, { color: t.textSecondary }]}>
        {ACCESS_TEXT.noEmailMatchHint}
      </Text>
    </View>
  );
}

export function DniCard({ onPress }: { onPress: () => void }) {
  const t = useComunicaTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: t.card, borderColor: t.separator },
      ]}
    >
      <Text style={[styles.cardTitle, { color: t.text }]}>
        {ACCESS_TEXT.dniCard.title}
      </Text>
      <Text style={[styles.hint, { color: t.textSecondary }]}>
        {ACCESS_TEXT.dniCard.body}
      </Text>
      {/* Secundario a propósito: la acción principal sigue siendo «Recibir código» (una por pantalla). */}
      <PressableFeedback
        onPress={() => {
          h.select();
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={ACCESS_TEXT.dniCard.button}
        style={[styles.outline, { borderColor: t.accentText }]}
      >
        <IconSymbol name="person.crop.circle" size={20} color={t.accentText} />
        <Text style={[styles.link, { color: t.accentText }]}>
          {ACCESS_TEXT.dniCard.button}
        </Text>
      </PressableFeedback>
    </View>
  );
}

export function OfficeLink() {
  const t = useComunicaTheme();
  return (
    <PressableFeedback
      onPress={() => {
        h.tap();
        Linking.openURL(`mailto:${OFFICE_EMAIL}`).catch(() => {
          /* sin aplicación de correo: el texto ya trae la dirección */
        });
      }}
      accessibilityRole="link"
      accessibilityLabel={`${ACCESS_TEXT.writeUs}: ${OFFICE_EMAIL}`}
      style={styles.office}
    >
      <IconSymbol name="envelope" size={18} color={t.accentText} />
      <Text style={[styles.link, { color: t.accentText }]}>{OFFICE_EMAIL}</Text>
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  miss: { borderRadius: radii.lg, padding: 16, gap: 8 },
  missHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  missTitle: { ...typography.title, flex: 1 },
  missEmail: { ...typography.body, fontWeight: '600' },
  hint: { ...typography.caption },
  card: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
  },
  cardTitle: { ...typography.title },
  outline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderRadius: radii.full,
  },
  office: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
  },
  link: { ...typography.button },
});
