// «Eventos» (plan 13): a qué se puede apuntar el perfil que se ve y a qué ya se ha apuntado. (El nombre de la carpeta es interno: en pantalla dice
// «Eventos»; renombrarlo a «Apuntarse» se decidió que no.)
//
//   · «Para apuntarte» primero y «Te has apuntado» después; los títulos solo si hay los dos bloques.
//   · Lo pasado lo quita la app con la fecha de hoy (lo guardado sigue bien al día siguiente sin red).
//   · Con conexión: familias funcionan con conexión, la caché solo abre rápido. Sin conexión, «Inscribirme» no hace nada y lo dice.
//   · Cambiar de hijo aquí se queda en la misma pantalla con el otro perfil: un evento no es de nadie (FAM-a8).

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import EmptyState from '@/components/ui/EmptyState';
import typography from '@/constants/typography';
import { useToast } from '@/contexts/AppToastContext';
import { comunicaNow } from '@/services/comunica';
import { useActivities } from '@/hooks/comunica/useActivities';
import { useActiveProfile } from '@/hooks/comunica/useActiveProfile';
import { useOpenAdvancedForm } from '@/hooks/comunica/useRegistrations';
import {
  showSectionTitles,
  visibleActivities,
  type CardAction,
} from '@/utils/comunica/activityList';
import { madridDay } from '@/utils/comunica/madrid';
import type { EventCard as EventCardData } from '@/services/comunica/contract';
import ActiveProfileBar from '../perfiles/ActiveProfileBar';
import AreaScreen from '../comun/AreaScreen';
import AreaState, { isNetwork } from '../comun/AreaState';
import SyncBadge from '../comun/SyncBadge';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import EventCard from './EventCard';

/** El texto que dice por qué «Inscribirme» no hace nada sin conexión. */
export const NEEDS_CONNECTION = 'Necesitas conexión para apuntarte';

/**
 * A dónde van «Inscribirme» y «Mi inscripción» (plan 14): el alta corta nativa; con formulario avanzado, ese formulario del CRM ya relleno (si no se puede
 * abrir, el alta muestra por qué); y «Mi inscripción» directo a su ficha.
 */
export function useRegistrationLinks() {
  const router = useRouter();
  const { active } = useActiveProfile();
  const openAdvanced = useOpenAdvancedForm(active?.id);
  return {
    signup: async (eventId: string, advanced = false) => {
      if (advanced && (await openAdvanced(eventId)) === 'opened') return;
      router.push({
        pathname: '/comunica/actividades/[eventId]/inscribirme',
        params: { eventId },
      } as never);
    },
    registration: (registrationId: string) =>
      router.push({
        pathname: '/comunica/inscripciones/[registrationId]',
        params: { registrationId },
      } as never),
    list: () => router.push('/comunica/inscripciones' as never),
  };
}

export default function ActivitiesScreen() {
  const t = useComunicaTheme();
  const router = useRouter();
  const { toast } = useToast();
  const { active } = useActiveProfile();
  const q = useActivities(active?.id);
  const links = useRegistrationLinks();
  const today = madridDay(comunicaNow());

  const open = (e: EventCardData) =>
    router.push({
      pathname: '/comunica/actividades/[eventId]',
      params: { eventId: e.id },
    } as never);
  const act = (e: EventCardData, a: CardAction) => {
    if (isNetwork(q.error)) {
      toast.show({ variant: 'warning', label: NEEDS_CONNECTION });
      return;
    }
    if (a.kind === 'registration') links.registration(e.myRegistrationId!);
    else void links.signup(e.id, e.hasAdvancedForm);
  };

  return (
    <AreaScreen onRefresh={() => q.refetch()}>
      <ActiveProfileBar scope="shared" section="events" />
      <AreaState query={q} skeleton="cards">
        {(data) => {
          const v = visibleActivities(data, today);
          if (v.toSignUp.length + v.signedUp.length === 0)
            return (
              <EmptyState
                icon="inbox"
                title="No hay actividades próximas ahora mismo"
                subtitle="Cuando se abra la inscripción de una actividad, aparecerá aquí. Las que ya pasaron están en “Inscripciones”."
                actionLabel="Ver mis inscripciones"
                onAction={() => links.list()}
                accentColor={t.accentText}
                titleColor={t.text}
                subtitleColor={t.textSecondary}
              />
            );
          const titles = showSectionTitles(v);
          return (
            <View style={styles.list}>
              {v.toSignUp.length > 0 ? (
                <Block title={titles ? 'Para apuntarte' : null}>
                  {v.toSignUp.map((e) => (
                    <EventCard
                      key={e.id}
                      event={e}
                      today={today}
                      onOpen={() => open(e)}
                      onAction={(a) => act(e, a)}
                    />
                  ))}
                </Block>
              ) : null}
              {v.signedUp.length > 0 ? (
                <Block title={titles ? 'Te has apuntado' : null}>
                  {v.signedUp.map((e) => (
                    <EventCard
                      key={e.id}
                      event={e}
                      today={today}
                      onOpen={() => open(e)}
                      onAction={(a) => act(e, a)}
                    />
                  ))}
                </Block>
              ) : null}
              <View style={styles.sync}>
                <SyncBadge generatedAt={q.generatedAt} />
              </View>
            </View>
          );
        }}
      </AreaState>
    </AreaScreen>
  );
}

function Block({
  title,
  children,
}: {
  title: string | null;
  children: React.ReactNode;
}) {
  const t = useComunicaTheme();
  return (
    <View style={styles.block}>
      {title ? (
        <Text
          accessibilityRole="header"
          style={[styles.blockTitle, { color: t.textSecondary }]}
        >
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 20 },
  block: { gap: 12 },
  blockTitle: { ...typography.caption, textTransform: 'uppercase' },
  sync: { alignItems: 'center' },
});
