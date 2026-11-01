// Llega de la página pública de una actividad (`/actividades/?e=<slug o id>`,
// plan 10 §3.3), casi siempre por WhatsApp.
//
//   · Con sesión: busca el evento por el slug y hace `replace` a su ficha. Si
//     quien entra es solo familiar con varios hijos (o viéndose a sí mismo),
//     antes «¿A quién quieres apuntar?» (FAM-a1), que luego abre la ficha.
//   · Sin sesión: el servidor aún no tiene la ficha pública sin sesión
//     (`/v1/public/events/:slug`, duda 18 del middleware), así que se ofrece
//     la página pública en el navegador y «Entra para apuntarte».

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import EmptyState from '@/components/ui/EmptyState';
import { useActivityBySlug } from '@/hooks/comunica/useActivities';
import { useActiveProfile } from '@/hooks/comunica/useActiveProfile';
import { isComunicaApiError } from '@/services/comunica/client';
import { COMUNICA_ORIGIN, destinationQuery } from '@/services/comunica/links';
import { mustChooseFirst } from '@/utils/comunica/profiles';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';
import AreaScreen from '../comun/AreaScreen';
import { AreaSkeleton, isNetwork } from '../comun/AreaState';
import { useArea } from '../comun/ComunicaAreaProvider';
import RecordNote from '../comun/record/RecordNote';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import { NOT_FOUND } from './EventDetailScreen';
import { openInBrowser } from './useEventHandlers';

export const SIGN_IN_TO_JOIN = 'Entra para apuntarte';

export const publicEventUrl = (slug: string) =>
  `${COMUNICA_ORIGIN}/actividades/?e=${encodeURIComponent(slug)}`;

export default function PublicEventScreen() {
  const t = useComunicaTheme();
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { session } = useArea();
  const signedIn = session.status === 'signedIn';
  const active = useActiveProfile();
  const q = useActivityBySlug(slug, signedIn);
  const eventId = q.data?.id;

  useEffect(() => {
    if (!eventId || !active.ready) return;
    const destination = {
      internalpage: 'single_stic_events',
      action: 'detail' as const,
      id: eventId,
    };
    const choose = mustChooseFirst({
      page: destination.internalpage,
      member: active.member,
      childrenCount: active.children.length,
      chosen: active.chosen,
      audience: active.audience,
    });
    if (choose) {
      router.replace({
        pathname: '/comunica/perfiles',
        params: { destino: destinationQuery(destination) },
      });
    } else {
      router.replace({
        pathname: '/comunica/actividades/[eventId]',
        params: { eventId },
      });
    }
  }, [eventId, active, router]);

  const body = () => {
    if (!signedIn) {
      return (
        <View style={styles.wrap}>
          <RecordNote
            title="Esta actividad está en Comunica"
            text="Puedes ver su página pública. Para apuntarte, entra en tu área."
            action={{
              label: 'Ver la página pública de la actividad',
              onPress: () => void openInBrowser(publicEventUrl(slug ?? '')),
            }}
          />
          <AreaPrimaryButton
            label={SIGN_IN_TO_JOIN}
            onPress={() => router.replace('/comunica')}
          />
        </View>
      );
    }
    if (isComunicaApiError(q.error) && q.error.code === 'not_found') {
      return (
        <EmptyState
          icon="event-busy"
          title={NOT_FOUND.title}
          subtitle={NOT_FOUND.subtitle}
          actionLabel={NOT_FOUND.action}
          onAction={() => router.replace('/comunica/actividades')}
          accentColor={t.accentText}
          titleColor={t.text}
          subtitleColor={t.textSecondary}
        />
      );
    }
    if (q.error && isNetwork(q.error)) {
      return (
        <EmptyState
          icon="wifi-off"
          title="Necesitas conexión para abrir esta actividad"
          actionLabel="Reintentar"
          onAction={() => void q.refetch()}
          accentColor={t.accentText}
          titleColor={t.text}
          subtitleColor={t.textSecondary}
        />
      );
    }
    return <AreaSkeleton kind="cards" />;
  };

  return (
    <AreaScreen>
      <Stack.Screen options={{ title: 'Actividad' }} />
      {body()}
    </AreaScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
});
