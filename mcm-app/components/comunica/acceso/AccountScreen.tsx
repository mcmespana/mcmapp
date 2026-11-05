// «Tu cuenta» (plan 02): quién ha entrado, su delegación y papeles, la versión
// web y «Salir». Salir borra todo lo del área en el móvil; si hay escrituras
// sin subir, avisa antes.

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { signOut } from '@/services/comunica/session';
import { useMe } from '@/hooks/comunica/useMe';
import { useOpenLegacy } from '@/hooks/comunica/useOpenLegacy';
import { useOutbox } from '@/hooks/comunica/useOutbox';
import { h } from '@/utils/haptics';
import AreaScreen from '../comun/AreaScreen';
import NavRow from '../comun/NavRow';
import RoleChip from '../comun/RoleChip';
import Section from '../comun/Section';
import { useArea } from '../comun/ComunicaAreaProvider';
import { confirmAction } from '../comun/confirm';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import PersonAvatar from '../comun/PersonAvatar';

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
  // El alta del móvil para los avisos (plan 08) no es nada que se pierda.
  const pending = useOutbox().pending.filter((e) => e.kind !== 'device');
  const openLegacy = useOpenLegacy();
  const [leaving, setLeaving] = useState(false);

  const leave = async () => {
    setLeaving(true);
    h.remove();
    await signOut();
    qc.clear();
    router.dismissAll();
  };

  // Se pregunta SIEMPRE, también en web (`confirmAction`): antes allí salía
  // sin preguntar y se llevaba por delante lo que estuviera sin subir.
  const confirmLeave = async () => {
    const warn =
      pending.length > 0
        ? `Tienes ${pending.length === 1 ? 'una lista' : `${pending.length} listas`} sin subir. Si sales, se pierde${pending.length === 1 ? '' : 'n'}.`
        : 'Se borra del móvil todo lo del área. Para volver, te mandamos otro código.';
    if (await confirmAction('¿Salir del área?', warn, 'Salir', true)) {
      await leave();
    }
  };

  if (!me) return null;
  const [first, ...rest] = me.name.split(' ');

  return (
    <AreaScreen>
      <View style={styles.head}>
        <PersonAvatar
          person={{
            id: 'me',
            firstName: first,
            lastName: rest.join(' ') || first,
          }}
          size={72}
          tone="brand"
        />
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

      {/* Plan 08: los avisos de este móvil. */}
      <Section>
        <NavRow
          icon="bell.fill"
          title="Avisos en este móvil"
          subtitle="Pasar lista, listas sin subir y novedades"
          onPress={() => router.push('/comunica/yo/avisos')}
        />
      </Section>

      <Section>
        {me.roles.includes('monitor') ? (
          <NavRow
            icon="graduationcap"
            title="Mis datos de monitor"
            // Plan 09: trayectoria, formación, certificado y títulos.
            onPress={() => router.push('/comunica/yo/monitor')}
          />
        ) : null}
        <NavRow
          icon="list.bullet.clipboard"
          title="Abrir la versión web"
          // La portada del legado con la sesión puesta (plan 10 §2): un pase
          // de 2 minutos, no la web pidiendo entrar otra vez.
          onPress={() =>
            void openLegacy({ internalpage: 'single_stic_home' }, 'Comunica')
          }
        />
        <LeaveRow
          label={leaving ? 'Saliendo…' : 'Salir'}
          onPress={() => void confirmLeave()}
        />
      </Section>
      <Text style={[styles.foot, { color: t.textMuted }]}>
        Salir no cierra tu cuenta de la app: solo el área de Comunica.
      </Text>
    </AreaScreen>
  );
}

/** «Salir»: acción destructiva, sin chevron, alineada con las `NavRow` de al lado. */
function LeaveRow({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useComunicaTheme();
  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.action}
    >
      <View style={styles.glyphBox}>
        <IconSymbol
          name="rectangle.portrait.and.arrow.right"
          size={20}
          color={t.dangerText}
        />
      </View>
      <Text style={[styles.actionLabel, { color: t.dangerText }]}>{label}</Text>
      <PressableFeedback.Highlight />
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 6, paddingTop: 8 },
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
  // Mismo ancho que la baldosa de `NavRow`, para que los títulos alineen.
  glyphBox: { width: 36, alignItems: 'center' },
  actionLabel: { ...typography.body, fontWeight: '600' },
  foot: { ...typography.caption, textAlign: 'center' },
});
