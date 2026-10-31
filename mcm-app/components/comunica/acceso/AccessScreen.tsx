// «Entra en tu área» (plan 02): correo (ya puesto si hay cuenta de la app) o,
// con un enlace discreto, DNI/NIE. Un solo botón: «Recibir código».

import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import AppTextField from '@/components/ui/AppTextField';
import PageContainer from '@/components/ui/PageContainer';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { getComunicaApi } from '@/services/comunica';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { h } from '@/utils/haptics';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import { accessErrorText, looksLikeDni, looksLikeEmail } from './copy';
import { putCodeHandoff } from './handoff';

export default function AccessScreen({ notice }: { notice?: string }) {
  const t = useComunicaTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [via, setVia] = useState<'email' | 'dni'>('email');
  const [email, setEmail] = useState(user?.email ?? '');
  const [dni, setDni] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useTabBarClearance();

  const value =
    via === 'email' ? email.trim().toLowerCase() : dni.trim().toUpperCase();
  const valid = via === 'email' ? looksLikeEmail(value) : looksLikeDni(value);

  const send = async () => {
    if (!valid || sending) return;
    setSending(true);
    setError(null);
    try {
      const body = via === 'email' ? { email: value } : { dni: value };
      const { sentTo } = await getComunicaApi().requestCode(body);
      // El correo o el DNI van en memoria, no en la URL (`handoff.ts`).
      router.push({
        pathname: '/comunica/acceso-codigo',
        params: { k: putCodeHandoff({ via, value, sentTo }) },
      });
    } catch (e) {
      h.error();
      setError(accessErrorText(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: t.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: bottom + 24 }}
      >
        <PageContainer maxWidth={480}>
          <View style={styles.content}>
            <View style={[styles.badge, { backgroundColor: t.accentFill }]}>
              <IconSymbol name="lock" size={28} color={t.onAccent} />
            </View>
            <Text
              style={[styles.title, { color: t.text }]}
              accessibilityRole="header"
            >
              Entra en tu área
            </Text>
            <Text style={[styles.body, { color: t.textSecondary }]}>
              Te mandamos un código de 6 cifras. Sin contraseñas: entras una vez
              y no tienes que volver a hacerlo.
            </Text>
            {notice ? (
              <Text
                style={[
                  styles.notice,
                  { color: t.warningText, backgroundColor: t.warningSoft },
                ]}
              >
                {notice}
              </Text>
            ) : null}

            {via === 'email' ? (
              <View style={styles.field}>
                <Text style={[styles.label, { color: t.text }]}>Tu correo</Text>
                <AppTextField
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="nombre@correo.com"
                  accessibilityLabel="Tu correo"
                  returnKeyType="send"
                  onSubmitEditing={send}
                  accentColor={t.accentText}
                />
                {user?.email &&
                email.trim().toLowerCase() === user.email.toLowerCase() ? (
                  <Text style={[styles.hint, { color: t.textMuted }]}>
                    El de tu cuenta de la app. Si en tu delegación tienen otro,
                    cámbialo.
                  </Text>
                ) : null}
              </View>
            ) : (
              <View style={styles.field}>
                <Text style={[styles.label, { color: t.text }]}>
                  Tu DNI o NIE
                </Text>
                <AppTextField
                  value={dni}
                  onChangeText={setDni}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder="12345678Z"
                  accessibilityLabel="Tu DNI o NIE"
                  returnKeyType="send"
                  onSubmitEditing={send}
                  accentColor={t.accentText}
                />
                <Text style={[styles.hint, { color: t.textMuted }]}>
                  Te lo mandamos al correo de tu ficha.
                </Text>
              </View>
            )}

            {error ? (
              <Text
                style={[styles.error, { color: t.warningText }]}
                accessibilityRole="alert"
              >
                {error}
              </Text>
            ) : null}

            <AreaPrimaryButton
              label="Recibir código"
              onPress={send}
              disabled={!valid}
              loading={sending}
            />

            <PressableFeedback
              onPress={() => {
                h.select();
                setError(null);
                setVia(via === 'email' ? 'dni' : 'email');
              }}
              accessibilityRole="button"
              hitSlop={12}
              style={styles.switch}
            >
              <Text style={[styles.link, { color: t.accentText }]}>
                {via === 'email' ? 'Entrar con el DNI' : 'Entrar con el correo'}
              </Text>
            </PressableFeedback>
          </View>
        </PageContainer>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 24, gap: 16 },
  badge: {
    width: 56,
    height: 56,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.h1 },
  body: { ...typography.body },
  notice: { ...typography.subhead, padding: 12, borderRadius: radii.md },
  field: { gap: 8 },
  label: { ...typography.subhead, fontWeight: '600' },
  hint: { ...typography.caption },
  error: { ...typography.subhead },
  switch: { alignSelf: 'center', paddingVertical: 8 },
  link: { ...typography.button },
});
