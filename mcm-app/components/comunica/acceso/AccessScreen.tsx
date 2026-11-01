// «Entra en tu área» (plan 02): correo (ya puesto si hay cuenta de la app) o,
// con un enlace discreto, DNI/NIE. Un solo botón: «Recibir código».
// Con cuenta de la app (Google o Apple), antes que nada «Entrar como …»
// (`identidad-app`): la primera vez entra solo; tras «Salir», espera al botón.

import React, { useEffect, useRef, useState } from 'react';
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
import {
  appAccountOptedOut,
  currentAppIdToken,
} from '@/services/comunica/appAccount';
import { signIn } from '@/services/comunica/session';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { h } from '@/utils/haptics';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import { DniCard, MissNotice, OfficeLink } from './AccessNotices';
import {
  accessErrorDetail,
  accessErrorText,
  codeRequestProblem,
  looksLikeDni,
  looksLikeEmail,
} from './copy';
import {
  clearAccessHandoffs,
  putChooseHandoff,
  putCodeHandoff,
} from './handoff';

export default function AccessScreen({ notice }: { notice?: string }) {
  const t = useComunicaTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [via, setVia] = useState<'email' | 'dni'>('email');
  const [email, setEmail] = useState(user?.email ?? '');
  const [dni, setDni] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  // Con el aviso de «ese correo no está»: el correo tecleado (el campo se queda relleno para corregir la errata) y, debajo, la tarjeta del DNI.
  const [missEmail, setMissEmail] = useState<string | null>(null);
  const [office, setOffice] = useState(false);
  const [dniFocus, setDniFocus] = useState(false);
  const [linking, setLinking] = useState(false);
  const [appAccountFailed, setAppAccountFailed] = useState(false);
  const autoTried = useRef(false);
  const bottom = useTabBarClearance();

  const showError = (e: unknown) => {
    setError(accessErrorText(e));
    setDetail(accessErrorDetail(e));
  };

  const enterWithAppAccount = async (auto: boolean) => {
    if (linking) return;
    setLinking(true);
    setError(null);
    setDetail(null);
    try {
      const idToken = await currentAppIdToken();
      if (!idToken) {
        if (!auto) {
          setError('No hay cuenta de la app abierta. Entra con un código.');
        }
        setAppAccountFailed(true);
        return;
      }
      const res = await getComunicaApi().appAccount({ idToken });
      if ('choose' in res) {
        router.push({
          pathname: '/comunica/acceso-elegir',
          params: {
            k: putChooseHandoff({ body: { idToken }, choices: res.choose }),
          },
        });
        return;
      }
      await signIn(res, res.me);
      clearAccessHandoffs();
      h.formSuccess();
    } catch (e) {
      setAppAccountFailed(true);
      if (!auto) h.error();
      showError(e);
    } finally {
      setLinking(false);
    }
  };

  // La primera vez, con cuenta de la app, se entra solo (sin «Salir» antes).
  useEffect(() => {
    if (!user?.email || autoTried.current) return;
    autoTried.current = true;
    let cancelled = false;
    void appAccountOptedOut().then((out) => {
      if (!cancelled && !out) void enterWithAppAccount(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al llegar la cuenta
  }, [user?.email]);

  const value =
    via === 'email' ? email.trim().toLowerCase() : dni.trim().toUpperCase();
  const valid = via === 'email' ? looksLikeEmail(value) : looksLikeDni(value);

  const send = async () => {
    if (!valid || sending) return;
    setSending(true);
    setError(null);
    setDetail(null);
    setMissEmail(null);
    setOffice(false);
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
      const problem = codeRequestProblem(e, via);
      if (problem.kind === 'email_miss') {
        setMissEmail(value);
      } else {
        setError(problem.text);
        setDetail(accessErrorDetail(e));
        setOffice(problem.office);
      }
    } finally {
      setSending(false);
    }
  };

  // Del aviso del correo a buscarse por el DNI: el correo se queda donde está por si se vuelve.
  const goToDni = () => {
    setError(null);
    setDetail(null);
    setMissEmail(null);
    setOffice(false);
    setDniFocus(true);
    setVia('dni');
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

            {user?.email ? (
              <View style={styles.field}>
                {/* Secundario a propósito: la acción principal de la pantalla
                    sigue siendo «Recibir código» (una por pantalla). */}
                <PressableFeedback
                  onPress={() => void enterWithAppAccount(false)}
                  isDisabled={linking}
                  accessibilityRole="button"
                  accessibilityLabel={`Entrar como ${user.email}`}
                  style={[styles.accountButton, { borderColor: t.accentText }]}
                >
                  <IconSymbol
                    name="person.crop.circle"
                    size={20}
                    color={t.accentText}
                  />
                  <Text
                    style={[
                      styles.link,
                      styles.accountLabel,
                      { color: t.accentText },
                    ]}
                    numberOfLines={1}
                  >
                    {linking
                      ? 'Entrando…'
                      : `Entrar como ${user.email.toLowerCase()}`}
                  </Text>
                </PressableFeedback>
                <Text style={[styles.hint, { color: t.textMuted }]}>
                  {appAccountFailed
                    ? 'O entra con un código, abajo.'
                    : `Con tu cuenta de ${user.provider === 'apple' ? 'Apple' : 'Google'} de la app, sin código. O, si prefieres, con un código abajo.`}
                </Text>
              </View>
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
                  error={missEmail !== null}
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
                  autoFocus={dniFocus}
                />
                <Text style={[styles.hint, { color: t.textMuted }]}>
                  Te lo mandamos al correo de tu ficha.
                </Text>
              </View>
            )}

            {via === 'email' && missEmail !== null ? (
              <>
                <MissNotice email={missEmail} />
                <DniCard onPress={goToDni} />
              </>
            ) : null}
            {error ? (
              <Text
                style={[styles.error, { color: t.warningText }]}
                accessibilityRole="alert"
              >
                {error}
              </Text>
            ) : null}
            {office ? <OfficeLink /> : null}
            {detail ? (
              <Text style={[styles.hint, { color: t.textMuted }]} selectable>
                {detail}
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
                setDetail(null);
                setMissEmail(null);
                setOffice(false);
                setDniFocus(false);
                setVia(via === 'email' ? 'dni' : 'email');
              }}
              accessibilityRole="button"
              accessibilityLabel={
                via === 'email' ? 'Entrar con el DNI' : 'Entrar con el correo'
              }
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
  switch: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  accountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderRadius: radii.full,
  },
  accountLabel: { flexShrink: 1 },
  link: { ...typography.button },
});
