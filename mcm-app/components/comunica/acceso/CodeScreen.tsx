// Las seis casillas del código (plan 02). El código se autocompleta del correo
// en iOS (`oneTimeCode`) y en Android (`one-time-code`). «Volver a mandar» con
// su cuenta atrás. Si el correo es de varias fichas, a elegir.

import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import PageContainer from '@/components/ui/PageContainer';
import typography from '@/constants/typography';
import { getComunicaApi } from '@/services/comunica';
import type { VerifyRequest } from '@/services/comunica/contract';
import { signIn } from '@/services/comunica/session';
import { h } from '@/utils/haptics';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import CodeInput from './CodeInput';
import { accessErrorText, codeRequestProblem, RESEND_AFTER_S } from './copy';
import { clearAccessHandoffs, putChooseHandoff } from './handoff';

const LENGTH = 6;

export default function CodeScreen({
  via,
  value,
  sentTo,
  linkToken,
}: {
  via?: 'email' | 'dni';
  value?: string;
  sentTo?: string;
  /** El enlace del correo (`acceso_app`): se canjea sin teclear. */
  linkToken?: string;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(RESEND_AFTER_S);
  const tried = useRef(false);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const done = () => {
    clearAccessHandoffs();
    h.formSuccess();
    router.dismissAll();
  };

  const verify = async (body: VerifyRequest) => {
    setChecking(true);
    setError(null);
    try {
      const res = await getComunicaApi().verify(body);
      if ('choose' in res) {
        // El código y los nombres, en memoria: nunca en la URL.
        router.push({
          pathname: '/comunica/acceso-elegir',
          params: { k: putChooseHandoff({ body, choices: res.choose }) },
        });
        return;
      }
      await signIn(res, res.me);
      done();
    } catch (e) {
      h.error();
      setCode('');
      setError(accessErrorText(e));
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (linkToken && !tried.current) {
      tried.current = true;
      void verify({ linkToken });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkToken]);

  const submit = (c: string) => {
    if (!via || !value || c.length !== LENGTH) return;
    void verify(
      via === 'email' ? { email: value, code: c } : { dni: value, code: c },
    );
  };

  const resend = async () => {
    if (!via || !value || wait > 0) return;
    setError(null);
    try {
      await getComunicaApi().requestCode(
        via === 'email' ? { email: value } : { dni: value },
      );
      h.success();
      setWait(RESEND_AFTER_S);
    } catch (e) {
      setError(codeRequestProblem(e, via).text);
    }
  };

  if (linkToken) {
    return (
      <View
        style={[styles.root, styles.center, { backgroundColor: t.background }]}
      >
        <Text
          style={[
            styles.body,
            { color: error ? t.warningText : t.textSecondary },
          ]}
        >
          {error ?? 'Entrando…'}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: t.background }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <PageContainer maxWidth={480}>
        <View style={styles.content}>
          <Text
            style={[styles.title, { color: t.text }]}
            accessibilityRole="header"
          >
            Escribe el código
          </Text>
          <Text style={[styles.body, { color: t.textSecondary }]}>
            Te lo hemos mandado a{' '}
            <Text style={{ color: t.text, fontWeight: '600' }}>{sentTo}</Text>.
          </Text>
          <CodeInput
            value={code}
            onChange={setCode}
            onComplete={submit}
            disabled={checking}
            invalid={!!error}
          />
          {checking ? (
            <Text style={[styles.hint, { color: t.textSecondary }]}>
              Comprobando…
            </Text>
          ) : null}
          {error ? (
            <Text
              style={[styles.error, { color: t.warningText }]}
              accessibilityRole="alert"
            >
              {error}
            </Text>
          ) : null}
          <Text style={[styles.hint, { color: t.textMuted }]}>
            Si no te llega, mira en el correo no deseado o pide otro código.
          </Text>
          <View style={styles.actions}>
            <PressableFeedback
              onPress={resend}
              isDisabled={wait > 0}
              accessibilityRole="button"
              hitSlop={12}
            >
              <Text
                style={[
                  styles.link,
                  { color: wait > 0 ? t.textMuted : t.accentText },
                ]}
              >
                {wait > 0 ? `Volver a mandar (${wait} s)` : 'Volver a mandar'}
              </Text>
            </PressableFeedback>
            <PressableFeedback
              onPress={() => router.back()}
              accessibilityRole="button"
              hitSlop={12}
            >
              <Text style={[styles.link, { color: t.accentText }]}>
                {via === 'dni' ? 'Cambiar el DNI' : 'Cambiar el correo'}
              </Text>
            </PressableFeedback>
          </View>
        </View>
      </PageContainer>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 24, gap: 16 },
  title: { ...typography.h1 },
  body: { ...typography.body },
  hint: { ...typography.caption },
  error: { ...typography.subhead },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  link: { ...typography.button },
});
