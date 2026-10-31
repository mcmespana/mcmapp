// «¿A quién quieres ver?» / «¿A quién quieres apuntar?» (plan 11, `single_stic_profile_selection.php`): una tarjeta por hijo y la propia al final.
// Al abrirla se vuelve a mirar quiénes son los míos (`fresh=1`): aparece el hijo recién vinculado. Con un destino (`internalpage`… que llega de un
// enlace, plan 10) se va ahí al elegir, no a la portada; sin él, a la portada. Sin hijos: el texto de siempre y la tarjeta propia.

import React, { useCallback, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import typography from '@/constants/typography';
import {
  nativeHrefFor,
  parseDestination,
  type Destination,
} from '@/services/comunica/links';
import {
  useActiveProfile,
  useMyProfiles,
  useRefreshProfiles,
} from '@/hooks/comunica/useActiveProfile';
import { useOpenLegacy } from '@/hooks/comunica/useOpenLegacy';
import { pickerPurpose, pickerTexts } from '@/utils/comunica/profiles';
import AreaScreen from '../comun/AreaScreen';
import AreaState from '../comun/AreaState';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import ProfileCard from './ProfileCard';

export default function ProfilesScreen() {
  const t = useComunicaTheme();
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string | undefined>>();
  const destination: Destination | null = parseDestination(params);
  const query = useMyProfiles();
  const refresh = useRefreshProfiles();
  const { active, setActive } = useActiveProfile();
  const openLegacy = useOpenLegacy();
  const texts = pickerTexts(pickerPurpose(destination?.internalpage));

  // Al abrirla se vuelve a preguntar «quiénes son los míos» (`fresh=1`).
  useEffect(() => {
    void refresh().catch(() => {});
  }, [refresh]);

  const choose = useCallback(
    async (id: string, selfId: string) => {
      setActive(id);
      if (!destination) {
        router.replace('/comunica');
        return;
      }
      const native = nativeHrefFor(destination);
      if (native) router.replace(native as never);
      else
        await openLegacy(
          destination,
          'Comunica',
          id === selfId ? undefined : id,
        );
    },
    [destination, openLegacy, router, setActive],
  );

  return (
    <AreaScreen onRefresh={() => refresh()}>
      <AreaState query={query}>
        {(data) => (
          <View style={styles.wrap}>
            <View style={styles.head}>
              <Text
                accessibilityRole="header"
                style={[styles.title, { color: t.text }]}
              >
                {data.children.length === 0 ? '¿A quién ves?' : texts.title}
              </Text>
              <Text style={[styles.body, { color: t.textSecondary }]}>
                {data.children.length === 0
                  ? 'Todavía no tienes participantes vinculados. Cuando la organización vincule a tus participantes, aparecerán aquí automáticamente. Si crees que falta alguien, contacta con tu referente.'
                  : texts.body}
              </Text>
            </View>
            {data.children.map((c) => (
              <ProfileCard
                key={c.id}
                profile={c}
                isSelf={false}
                isActive={active?.id === c.id}
                onPress={() => void choose(c.id, data.self.id)}
              />
            ))}
            <ProfileCard
              profile={data.self}
              isSelf
              isActive={active?.id === data.self.id}
              onPress={() => void choose(data.self.id, data.self.id)}
            />
          </View>
        )}
      </AreaState>
    </AreaScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  head: { gap: 6, paddingBottom: 4 },
  title: { ...typography.h2 },
  body: { ...typography.body },
});
