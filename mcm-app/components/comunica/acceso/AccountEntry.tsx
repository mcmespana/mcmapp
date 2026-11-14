// «Entra en Comunica» con la cuenta de la app (14/11/2026): quien ya ha entrado
// en la MCM App con Google o Apple ve su correo y UN botón. La comprobación con
// el servidor se hace sola al abrir (`AccessScreen`); el botón solo espera si
// aún no ha vuelto. Debajo, en pequeño, que la sesión se queda abierta, y las
// otras dos vías (otro correo, el DNI), siempre a mano.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { h } from '@/utils/haptics';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';
import CardSurface from '../comun/CardSurface';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import { ACCESS_TEXT } from './copy';

interface Props {
  email: string;
  provider: 'google' | 'apple';
  /** Pulsado y esperando al servidor (o a la animación). */
  busy: boolean;
  error: string | null;
  onEnter: () => void;
  onOtherEmail: () => void;
  onDni: () => void;
}

export default function AccountEntry({
  email,
  provider,
  busy,
  error,
  onEnter,
  onOtherEmail,
  onDni,
}: Props) {
  const t = useComunicaTheme();
  return (
    <View style={styles.root}>
      <Text
        style={[styles.title, { color: t.text }]}
        accessibilityRole="header"
      >
        {ACCESS_TEXT.title}
      </Text>

      <CardSurface style={styles.card}>
        <View style={[styles.avatar, { backgroundColor: t.iconTile.fill }]}>
          <Text style={[styles.initial, { color: t.iconTile.glyph }]}>
            {email.slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View style={styles.who}>
          <Text style={[styles.caption, { color: t.textSecondary }]}>
            {ACCESS_TEXT.account.signedInAs}
          </Text>
          <Text
            style={[styles.email, { color: t.text }]}
            numberOfLines={1}
            ellipsizeMode="middle"
            selectable
          >
            {email}
          </Text>
          <Text style={[styles.caption, { color: t.textMuted }]}>
            {provider === 'apple' ? 'Apple' : 'Google'}
          </Text>
        </View>
      </CardSurface>

      <View style={styles.actions}>
        <AreaPrimaryButton
          label={ACCESS_TEXT.account.enter}
          icon="checkmark.seal.fill"
          onPress={onEnter}
          loading={busy}
        />
        {error ? (
          <Text
            style={[styles.error, { color: t.warningText }]}
            accessibilityRole="alert"
          >
            {error}
          </Text>
        ) : null}
        <View style={styles.keep}>
          <IconSymbol name="lock" size={14} color={t.textMuted} />
          <Text style={[styles.caption, { color: t.textMuted }]}>
            {ACCESS_TEXT.account.keepOpen}
          </Text>
        </View>
      </View>

      <View style={styles.links}>
        <Link label={ACCESS_TEXT.account.otherEmail} onPress={onOtherEmail} />
        <Text style={{ color: t.textMuted }}>·</Text>
        <Link label={ACCESS_TEXT.form.toDni} onPress={onDni} />
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
      <Text style={[styles.linkText, { color: t.accentText }]}>{label}</Text>
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  root: { gap: 24 },
  title: { ...typography.h1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { ...typography.h2 },
  who: { flex: 1, gap: 2 },
  email: { ...typography.title },
  caption: { ...typography.caption },
  actions: { gap: 12 },
  error: { ...typography.subhead, textAlign: 'center' },
  keep: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  links: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { ...typography.button },
});
