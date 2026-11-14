// «Recibir código» por correo o por DNI (plan 02): la vía de quien no tiene
// cuenta de la app, o cuya cuenta no está en Comunica. Un correo que no existe
// SE DICE (como la web desde el 31/10/2026): aviso con el correo tecleado, el
// campo relleno y debajo la salida por el DNI. Por DNI, el código va al correo
// de la ficha y la pantalla siguiente lo enseña tapado.

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import AppTextField from '@/components/ui/AppTextField';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { getComunicaApi } from '@/services/comunica';
import { h } from '@/utils/haptics';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import { DniCard, MissNotice, OfficeLink } from './AccessNotices';
import {
  ACCESS_TEXT,
  codeRequestProblem,
  looksLikeDni,
  looksLikeEmail,
} from './copy';
import { putCodeHandoff } from './handoff';

/** Lo que trae el formulario de la cuenta de la app. */
export type FormNotice =
  /** La cuenta de la app no está en Comunica. */
  | { kind: 'account_miss'; email: string }
  /** La cuenta de la app no ha servido: queda el código. */
  | { kind: 'account_failed' }
  | { kind: 'revoked' };

interface Props {
  via: 'email' | 'dni';
  onViaChange: (via: 'email' | 'dni') => void;
  initialEmail: string;
  notice: FormNotice | null;
  /** Hay cuenta de la app: un enlace para volver a entrar con ella. */
  accountEmail: string | null;
  onBackToAccount: () => void;
}

export default function CodeRequestForm({
  via,
  onViaChange,
  initialEmail,
  notice,
  accountEmail,
  onBackToAccount,
}: Props) {
  const t = useComunicaTheme();
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [dni, setDni] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Con el aviso de «ese correo no está»: el correo tecleado (el campo se queda relleno para corregir la errata) y, debajo, la tarjeta del DNI.
  const [missEmail, setMissEmail] = useState<string | null>(null);
  const [office, setOffice] = useState(false);
  const [dniFocus, setDniFocus] = useState(false);
  // El aviso de la cuenta de la app se va en cuanto se hace algo.
  const [showNotice, setShowNotice] = useState(true);

  const value =
    via === 'email' ? email.trim().toLowerCase() : dni.trim().toUpperCase();
  const valid = via === 'email' ? looksLikeEmail(value) : looksLikeDni(value);

  const clear = () => {
    setError(null);
    setMissEmail(null);
    setOffice(false);
    setShowNotice(false);
  };

  const send = async () => {
    if (!valid || sending) return;
    setSending(true);
    clear();
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
        setOffice(problem.office);
      }
    } finally {
      setSending(false);
    }
  };

  const switchVia = (next: 'email' | 'dni', focus: boolean) => {
    clear();
    setDniFocus(focus);
    onViaChange(next);
  };

  const banner =
    showNotice && notice
      ? notice.kind === 'account_miss'
        ? {
            title: ACCESS_TEXT.account.notFound(notice.email),
            body: ACCESS_TEXT.account.notFoundHint,
          }
        : notice.kind === 'account_failed'
          ? { title: ACCESS_TEXT.account.failed, body: null }
          : { title: 'Tu sesión ha terminado. Vuelve a entrar.', body: null }
      : null;

  return (
    <View style={styles.root}>
      <Text
        style={[styles.title, { color: t.text }]}
        accessibilityRole="header"
      >
        {ACCESS_TEXT.title}
      </Text>
      <Text style={[styles.body, { color: t.textSecondary }]}>
        {via === 'email'
          ? ACCESS_TEXT.form.emailBody
          : ACCESS_TEXT.form.dniBody}
      </Text>

      {banner ? (
        <View
          style={[styles.banner, { backgroundColor: t.warningSoft }]}
          accessibilityRole="alert"
        >
          <IconSymbol
            name="exclamationmark.triangle.fill"
            size={18}
            color={t.warningIcon}
          />
          <View style={styles.bannerText}>
            <Text style={[styles.bannerTitle, { color: t.warningText }]}>
              {banner.title}
            </Text>
            {banner.body ? (
              <Text style={[styles.hint, { color: t.textSecondary }]}>
                {banner.body}
              </Text>
            ) : null}
          </View>
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
            autoFocus={notice?.kind === 'account_miss'}
          />
        </View>
      ) : (
        <View style={styles.field}>
          <Text style={[styles.label, { color: t.text }]}>Tu DNI o NIE</Text>
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
        </View>
      )}

      {via === 'email' && missEmail !== null ? (
        <>
          <MissNotice email={missEmail} />
          <DniCard onPress={() => switchVia('dni', true)} />
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

      <AreaPrimaryButton
        label={ACCESS_TEXT.form.send}
        onPress={send}
        disabled={!valid}
        loading={sending}
      />

      <View style={styles.links}>
        <Link
          label={
            via === 'email' ? ACCESS_TEXT.form.toDni : ACCESS_TEXT.form.toEmail
          }
          onPress={() => switchVia(via === 'email' ? 'dni' : 'email', false)}
        />
        {accountEmail && notice?.kind !== 'account_miss' ? (
          <Link
            label={ACCESS_TEXT.account.back(accountEmail)}
            onPress={onBackToAccount}
          />
        ) : null}
      </View>
    </View>
  );
}

function Link({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useComunicaTheme();
  return (
    <PressableFeedback
      onPress={() => {
        h.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={styles.link}
    >
      <Text
        style={[styles.linkText, { color: t.accentText }]}
        numberOfLines={1}
        ellipsizeMode="middle"
      >
        {label}
      </Text>
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  title: { ...typography.h1 },
  body: { ...typography.body },
  banner: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: radii.md,
    alignItems: 'flex-start',
  },
  bannerText: { flex: 1, gap: 4 },
  bannerTitle: { ...typography.subhead, fontWeight: '600' },
  field: { gap: 8 },
  label: { ...typography.subhead, fontWeight: '600' },
  hint: { ...typography.caption },
  error: { ...typography.subhead },
  links: { alignItems: 'center', gap: 4 },
  link: { minHeight: 44, justifyContent: 'center', maxWidth: '100%' },
  linkText: { ...typography.button },
});
