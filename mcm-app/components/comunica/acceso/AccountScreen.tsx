// «Tu cuenta» (plan 02): quién ha entrado, su delegación y papeles, la versión
// web y «Salir». Salir borra todo lo del área en el móvil; si hay escrituras
// sin subir, avisa antes.

import React, { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { signOut } from '@/services/comunica/session';
import { useMe } from '@/hooks/comunica/useMe';
import { useOutbox } from '@/hooks/comunica/useOutbox';
import { h } from '@/utils/haptics';
import AreaScreen from '../comun/AreaScreen';
import RoleChip from '../comun/RoleChip';
import Section from '../comun/Section';
import { useArea } from '../comun/ComunicaAreaProvider';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import { initials } from '../comun/PersonRow';

const ROLE_LABEL = {
  monitor: 'Monitor/a',
  coordination: 'Coordinación',
  accompaniment: 'Acompañamiento',
  member: 'Miembro',
  guardian: 'Familia',
} as const;

export default function AccountScreen() {
  const t = useComunicaTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useArea();
  const me = useMe().me ?? session.me;
  const { pending } = useOutbox();
  const [leaving, setLeaving] = useState(false);

  const leave = async () => {
    setLeaving(true);
    h.remove();
    await signOut();
    qc.clear();
    router.dismissAll();
  };

  const confirmLeave = () => {
    const warn =
      pending.length > 0
        ? `Tienes ${pending.length === 1 ? 'una lista' : `${pending.length} listas`} sin subir. Si sales, se pierde${pending.length === 1 ? '' : 'n'}.`
        : 'Se borra del móvil todo lo del área. Para volver, te mandamos otro código.';
    if (Platform.OS === 'web') {
      void leave();
      return;
    }
    Alert.alert('¿Salir del área?', warn, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => void leave() },
    ]);
  };

  if (!me) return null;
  const [first, ...rest] = me.name.split(' ');

  return (
    <AreaScreen>
      <View style={styles.head}>
        <View style={[styles.avatar, { backgroundColor: t.accentFill }]}>
          <Text style={[styles.initials, { color: t.onAccent }]}>
            {initials({ firstName: first, lastName: rest.join(' ') || first })}
          </Text>
        </View>
        <Text style={[styles.name, { color: t.text }]}>{me.name}</Text>
        <Text style={[styles.sub, { color: t.textSecondary }]}>
          Delegación de {me.delegation.name}
        </Text>
        <View style={styles.roles}>
          {me.roles.includes('coordination') ? (
            <RoleChip role="coordination" />
          ) : me.roles.includes('accompaniment') ? (
            <RoleChip role="accompaniment" />
          ) : null}
        </View>
      </View>

      <Section title="Lo que eres en Comunica">
        {me.roles.map((r) => (
          <Text key={r} style={[styles.row, { color: t.text }]}>
            {ROLE_LABEL[r]}
          </Text>
        ))}
      </Section>

      <Section>
        <Row
          icon="list.bullet.clipboard"
          label="Abrir la versión web"
          onPress={() => router.push('/comunica/web')}
        />
        <Row
          icon="lock"
          label={leaving ? 'Saliendo…' : 'Salir'}
          destructive
          onPress={confirmLeave}
        />
      </Section>
      <Text style={[styles.foot, { color: t.textMuted }]}>
        Salir no cierra tu cuenta de la app: solo el área de Comunica.
      </Text>
    </AreaScreen>
  );
}

function Row({
  icon,
  label,
  onPress,
  destructive,
}: {
  icon: 'lock' | 'list.bullet.clipboard';
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const t = useComunicaTheme();
  const color = destructive ? t.warningText : t.text;
  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.action}
    >
      <PressableFeedback.Highlight />
      <IconSymbol
        name={icon}
        size={20}
        color={destructive ? t.warningIcon : t.accentText}
      />
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 6, paddingTop: 8 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  initials: { ...typography.h2 },
  name: { ...typography.h2, textAlign: 'center' },
  sub: { ...typography.subhead },
  roles: { flexDirection: 'row', gap: 8, marginTop: 4 },
  row: { ...typography.body, paddingHorizontal: 16, paddingVertical: 14 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
  },
  actionLabel: { ...typography.body, fontWeight: '600' },
  foot: { ...typography.caption, textAlign: 'center' },
});
