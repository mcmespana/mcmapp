// «¿Quién eres?»: el correo es de varias fichas del CRM. Arregla lo de hoy
// (en el plugin entra la primera).

import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import PageContainer from '@/components/ui/PageContainer';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { getComunicaApi } from '@/services/comunica';
import type { PersonChoice, VerifyRequest } from '@/services/comunica/contract';
import { signIn } from '@/services/comunica/session';
import { h } from '@/utils/haptics';
import Section from '../comun/Section';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import { accessErrorText } from './copy';
import { clearAccessHandoffs } from './handoff';

export default function ChooseScreen({
  body,
  choices,
}: {
  body: VerifyRequest;
  choices: PersonChoice[];
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = async (personId: string) => {
    setBusy(personId);
    setError(null);
    try {
      const res = await getComunicaApi().verify({ ...body, personId });
      if ('choose' in res) throw new Error('otra vez a elegir');
      await signIn(res, res.me);
      clearAccessHandoffs();
      h.formSuccess();
      router.dismissAll();
    } catch (e) {
      h.error();
      setError(accessErrorText(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: t.backgroundSunken }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <PageContainer maxWidth={480}>
        <View style={styles.content}>
          <Text
            style={[styles.title, { color: t.text }]}
            accessibilityRole="header"
          >
            ¿Quién eres?
          </Text>
          <Text style={[styles.body, { color: t.textSecondary }]}>
            Este correo es de varias personas. Elige con quién entras; luego
            puedes salir y entrar con otra.
          </Text>
          <Section>
            {choices.map((c) => (
              <PressableFeedback
                key={c.personId}
                onPress={() => choose(c.personId)}
                isDisabled={!!busy}
                accessibilityRole="button"
                accessibilityLabel={`${c.name}, ${c.delegation}`}
                style={styles.row}
              >
                <PressableFeedback.Highlight />
                <View style={styles.rowBody}>
                  <Text style={[styles.name, { color: t.text }]}>{c.name}</Text>
                  <Text style={[styles.sub, { color: t.textSecondary }]}>
                    {c.delegation}
                  </Text>
                </View>
                <Text style={[styles.sub, { color: t.textSecondary }]}>
                  {busy === c.personId ? 'Entrando…' : ''}
                </Text>
                <IconSymbol
                  name="chevron.right"
                  size={16}
                  color={t.textMuted}
                />
              </PressableFeedback>
            ))}
          </Section>
          {error ? (
            <Text
              style={[styles.sub, { color: t.warningText }]}
              accessibilityRole="alert"
            >
              {error}
            </Text>
          ) : null}
        </View>
      </PageContainer>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 16 },
  title: { ...typography.h1 },
  body: { ...typography.body },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rowBody: { flex: 1, gap: 2 },
  name: { ...typography.body, fontWeight: '600' },
  sub: { ...typography.caption },
});
