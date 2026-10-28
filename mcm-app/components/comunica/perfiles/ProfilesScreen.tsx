// «¿A quién quieres ver?» (plan 11; `sticpa_profile_selector_html`): los
// hijos con relación vigente y, al final, uno mismo. Se llega desde la barra
// «Viendo a» («Ver todos los perfiles…») o porque un enlace pide elegir antes
// (`destino`, la query del destino: al elegir se abre ahí; sin `destino`,
// se vuelve).
//
// Al abrirse pregunta sin caché (`fresh=1`): es donde se mira «quiénes son
// los míos», y así sale el hijo recién vinculado.

import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import typography from '@/constants/typography';
import { useActiveProfile } from '@/hooks/comunica/useActiveProfile';
import { useMyProfiles } from '@/hooks/comunica/useMyProfiles';
import { useOpenDestination } from '@/hooks/comunica/useOpenDestination';
import {
  parseDestination,
  parseQuery,
  type Destination,
} from '@/services/comunica/links';
import { shortName } from '@/utils/comunica/profiles';
import AreaScreen from '../comun/AreaScreen';
import AreaState from '../comun/AreaState';
import Section from '../comun/Section';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import ProfileCard from './ProfileCard';

/** Las páginas en las que se apunta a alguien, no se le «ve». */
const SIGNUP_PAGES = new Set([
  'list_stic_events',
  'single_stic_events',
  'list_stic_registrations',
  'single_stic_registrations',
]);

export const profilesTitle = (d: Destination | null) =>
  d && SIGNUP_PAGES.has(d.internalpage)
    ? '¿A quién quieres apuntar?'
    : '¿A quién quieres ver?';

export default function ProfilesScreen() {
  const t = useComunicaTheme();
  const router = useRouter();
  const { destino } = useLocalSearchParams<{ destino?: string }>();
  const destination = destino
    ? parseDestination(parseQuery(`?${destino}`))
    : null;
  const active = useActiveProfile();
  const query = useMyProfiles();
  const open = useOpenDestination();
  const { refreshFresh } = query;

  useEffect(() => {
    void refreshFresh();
  }, [refreshFresh]);

  const pick = (pid: string, name: string) => {
    active.choose(pid);
    if (destination) {
      router.back();
      open(destination, name, pid);
    } else if (router.canGoBack()) {
      router.back();
    }
  };

  const actionFor = (pid: string) =>
    pid === active.pid && active.chosen
      ? 'Seguir aquí'
      : destination
        ? 'Entrar'
        : 'Elegir';

  return (
    <AreaScreen onRefresh={refreshFresh}>
      <Stack.Screen options={{ title: profilesTitle(destination) }} />
      <AreaState query={query} skeleton="list">
        {(data) => (
          <>
            <Section title="A tu cargo">
              {data.children.length > 0 ? (
                data.children.map((c) => (
                  <ProfileCard
                    key={c.id}
                    profile={c}
                    isSelf={false}
                    active={c.id === active.pid && active.chosen}
                    action={actionFor(c.id)}
                    onPress={() => pick(c.id, shortName(c))}
                  />
                ))
              ) : (
                <Text
                  key="empty"
                  style={[styles.empty, { color: t.textSecondary }]}
                >
                  <Text style={{ color: t.text }}>
                    Todavía no tienes participantes vinculados.
                  </Text>{' '}
                  Cuando la organización vincule a tus participantes, aparecerán
                  aquí automáticamente. Si crees que falta alguien, contacta con
                  tu referente.
                </Text>
              )}
            </Section>
            <Section title="Tú">
              <ProfileCard
                profile={data.self}
                isSelf
                active={data.self.id === active.pid && active.chosen}
                action={actionFor(data.self.id)}
                onPress={() => pick(data.self.id, shortName(data.self))}
              />
            </Section>
          </>
        )}
      </AreaState>
    </AreaScreen>
  );
}

const styles = StyleSheet.create({
  empty: { ...typography.body, padding: 16 },
});
