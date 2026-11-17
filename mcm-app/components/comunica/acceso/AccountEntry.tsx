// «Entra en Comunica» con la cuenta de la app (rehecho el 14/11/2026). La
// comprobación sale sola al abrir (`AccessScreen`) y, en cuanto vuelve, la
// pantalla ya sabe quién eres en Comunica: te saluda por tu nombre, con tu
// delegación, y el botón solo entra. Mientras, el correo de la cuenta y un
// esqueleto donde irá el nombre. Abajo, siempre, «¿No eres tú?» con las otras
// dos vías (otro correo, el DNI).

import React, { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { durations } from '@/constants/animations';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { h } from '@/utils/haptics';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';
import CardSurface from '../comun/CardSurface';
import PersonAvatar from '../comun/PersonAvatar';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import { ACCESS_TEXT } from './copy';

export interface AccountPerson {
  name: string;
  delegation: string;
}

interface Props {
  email: string;
  provider: 'google' | 'apple';
  /** Quién es en Comunica, si la comprobación ya ha vuelto. */
  person: AccountPerson | null;
  /** El correo es de varias fichas: cuántas. */
  choices: number;
  /** La comprobación aún no ha vuelto. */
  checking: boolean;
  /** Pulsado y esperando (o entrando). */
  busy: boolean;
  error: string | null;
  /** Con el centro del botón en la ventana: de ahí sale la entrada. */
  onEnter: (origin: { x: number; y: number } | null) => void;
  onOtherEmail: () => void;
  onDni: () => void;
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);

export default function AccountEntry({
  email,
  provider,
  person,
  choices,
  checking,
  busy,
  error,
  onEnter,
  onOtherEmail,
  onDni,
}: Props) {
  const t = useComunicaTheme();
  const button = useRef<React.ComponentRef<typeof View>>(null);
  const parts = person ? words(person.name) : [];
  const avatar = {
    id: email,
    firstName: parts[0] ?? email,
    lastName: parts.length > 1 ? (parts[1] ?? '') : '',
  };
  const title = person
    ? ACCESS_TEXT.account.hello(parts[0] ?? '')
    : ACCESS_TEXT.title;
  const subtitle = person
    ? person.delegation
    : choices > 1
      ? ACCESS_TEXT.account.several(choices)
      : null;

  const press = () => {
    // Si medir no contesta (o tarda), se entra igual: el círculo sale del centro.
    let done = false;
    const go = (o: { x: number; y: number } | null) => {
      if (done) return;
      done = true;
      onEnter(o);
    };
    setTimeout(() => go(null), 80);
    button.current?.measureInWindow?.((x, y, width, height) =>
      go(width > 0 ? { x: x + width / 2, y: y + height / 2 } : null),
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <View style={styles.hero}>
          <PersonAvatar person={avatar} size={72} tone="brand" />
          <View style={styles.heading}>
            <Text
              style={[styles.title, { color: t.text }]}
              accessibilityRole="header"
              numberOfLines={2}
            >
              {title}
            </Text>
            {subtitle ? (
              <Animated.Text
                entering={FadeIn.duration(durations.base)}
                style={[styles.subtitle, { color: t.textSecondary }]}
                numberOfLines={2}
              >
                {subtitle}
              </Animated.Text>
            ) : checking ? (
              <View
                style={[styles.skeleton, { backgroundColor: t.disabledFill }]}
                accessibilityLabel="Comprobando tu cuenta"
              />
            ) : null}
          </View>
        </View>

        <CardSurface style={styles.card}>
          <View style={[styles.cardIcon, { backgroundColor: t.iconTile.fill }]}>
            <IconSymbol name="envelope" size={18} color={t.iconTile.glyph} />
          </View>
          <View style={styles.who}>
            <Text style={[styles.caption, { color: t.textSecondary }]}>
              {ACCESS_TEXT.account.signedInAs}
            </Text>
            <Text
              style={[styles.email, { color: t.text }]}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {email}
            </Text>
            <Text style={[styles.caption, { color: t.textMuted }]}>
              {provider === 'apple'
                ? ACCESS_TEXT.account.apple
                : ACCESS_TEXT.account.google}
            </Text>
          </View>
          {person ? (
            <Animated.View entering={FadeIn.duration(durations.base)}>
              <IconSymbol
                name="checkmark.seal.fill"
                size={22}
                color={t.accentText}
              />
            </Animated.View>
          ) : null}
        </CardSurface>

        <View style={styles.actions}>
          <View ref={button} collapsable={false}>
            <AreaPrimaryButton
              label={
                choices > 1
                  ? ACCESS_TEXT.account.choose
                  : ACCESS_TEXT.account.enter
              }
              icon="arrow.right"
              onPress={press}
              loading={busy}
            />
          </View>
          {error ? (
            <Text
              style={[styles.error, { color: t.warningText }]}
              accessibilityRole="alert"
            >
              {error}
            </Text>
          ) : null}
          <View style={styles.keep}>
            <IconSymbol name="lock" size={13} color={t.textMuted} />
            <Text style={[styles.caption, { color: t.textMuted }]}>
              {ACCESS_TEXT.account.keepOpen}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.bottom}>
        <Text style={[styles.caption, { color: t.textMuted }]}>
          {ACCESS_TEXT.account.notYou}
        </Text>
        <View style={styles.links}>
          <Link label={ACCESS_TEXT.account.otherEmail} onPress={onOtherEmail} />
          <Text style={[styles.dot, { color: t.textMuted }]}>·</Text>
          <Link label={ACCESS_TEXT.form.toDni} onPress={onDni} />
        </View>
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
  root: { flex: 1, justifyContent: 'space-between', gap: 32 },
  top: { gap: 28 },
  hero: { alignItems: 'center', gap: 16, paddingTop: 8 },
  heading: { alignItems: 'center', gap: 6, alignSelf: 'stretch' },
  title: { ...typography.h1, textAlign: 'center' },
  subtitle: { ...typography.body, textAlign: 'center' },
  skeleton: { width: 140, height: 14, borderRadius: radii.full, marginTop: 6 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  who: { flex: 1, gap: 1 },
  email: { ...typography.body, fontWeight: '600' },
  caption: { ...typography.caption },
  actions: { gap: 12 },
  error: { ...typography.subhead, textAlign: 'center' },
  keep: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  bottom: { alignItems: 'center', gap: 2 },
  links: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  dot: { ...typography.body },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { ...typography.button },
});
