// El puente de un enlace público de actividad (plan 13): con sesión, de `slug` a la ficha del perfil que se ve; sin ella, «Entra para apuntarte».
// Un enlace que no encuentra el evento dice lo mismo que la ficha: «Esta actividad ya no está disponible».

import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import EmptyState from '@/components/ui/EmptyState';
import { isComunicaApiError } from '@/services/comunica/client';
import { useEventBySlug } from '@/hooks/comunica/useActivities';
import { useActiveProfile } from '@/hooks/comunica/useActiveProfile';
import { useMe } from '@/hooks/comunica/useMe';
import AreaScreen from '../comun/AreaScreen';
import { AreaSkeleton, isNetwork } from '../comun/AreaState';
import { useComunicaTheme } from '../comun/useComunicaTheme';

export default function ActivityBridgeScreen({ slug }: { slug: string }) {
  const t = useComunicaTheme();
  const router = useRouter();
  const me = useMe();
  const { active } = useActiveProfile();
  const q = useEventBySlug(active?.id, slug);
  const id = q.data?.id;
  useEffect(() => {
    if (id)
      router.replace({
        pathname: '/comunica/actividades/[eventId]',
        params: { eventId: id },
      } as never);
  }, [id, router]);

  const colors = {
    accentColor: t.accentText,
    titleColor: t.text,
    subtitleColor: t.textSecondary,
  };
  const signedOut = !me.isPending && !me.me;
  if (signedOut) {
    return (
      <AreaScreen>
        <EmptyState
          icon="lock"
          title="Entra para apuntarte"
          subtitle="Entra en tu área para ver esta actividad y apuntarte."
          actionLabel="Entrar"
          onAction={() => router.replace('/comunica' as never)}
          {...colors}
        />
      </AreaScreen>
    );
  }
  if (isComunicaApiError(q.error) && q.error.code === 'not_found') {
    return (
      <AreaScreen>
        <EmptyState
          icon="inbox"
          title="Esta actividad ya no está disponible"
          subtitle="Es posible que se haya retirado. Consulta el resto de actividades abiertas."
          actionLabel="Ver eventos"
          onAction={() => router.replace('/comunica/actividades' as never)}
          {...colors}
        />
      </AreaScreen>
    );
  }
  if (q.error && !isNetwork(q.error)) {
    return (
      <AreaScreen>
        <EmptyState
          icon="error-outline"
          title="No se ha podido cargar"
          actionLabel="Reintentar"
          onAction={() => void q.refetch()}
          {...colors}
        />
      </AreaScreen>
    );
  }
  return (
    <AreaScreen>
      <AreaSkeleton kind="cards" />
    </AreaScreen>
  );
}
