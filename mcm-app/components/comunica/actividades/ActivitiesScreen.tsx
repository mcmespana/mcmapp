// «Eventos» de familias (plan 13; `list_stic_events`): «Para apuntarte»
// primero, «Te has apuntado» después; los títulos solo si hay los dos. Lo
// pasado lo quita la app con la fecha de hoy (lo guardado sigue bien sin
// cobertura). Es la pantalla por defecto del plugin.
//
// Quien solo es familiar, viéndose a sí mismo, no tiene Eventos
// (`inc/stic-family.php` 468-504): se le pide a quién apuntar (plan 11).

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import EmptyState from '@/components/ui/EmptyState';
import { useActivities } from '@/hooks/comunica/useActivities';
import {
  useActiveProfile,
  useProfileScope,
} from '@/hooks/comunica/useActiveProfile';
import { useOpenDestination } from '@/hooks/comunica/useOpenDestination';
import { useIsOnline } from '@/hooks/comunica/useOpenFile';
import { comunicaNow } from '@/services/comunica';
import { activityBlocks } from '@/utils/comunica/activityList';
import { madridDay } from '@/utils/comunica/madrid';
import ActiveProfileBar from '../perfiles/ActiveProfileBar';
import AreaScreen from '../comun/AreaScreen';
import AreaState from '../comun/AreaState';
import Section from '../comun/Section';
import SyncBadge from '../comun/SyncBadge';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import EventCard from './EventCard';
import {
  registrationDestination,
  REGISTRATIONS_DESTINATION,
  signUpDestination,
} from './signupLinks';

export const EMPTY = {
  title: 'No hay actividades próximas ahora mismo',
  subtitle:
    'Cuando se abra la inscripción de una actividad, aparecerá aquí. Las que ya pasaron están en “Inscripciones”.',
  action: 'Ver mis inscripciones',
};

export default function ActivitiesScreen() {
  const t = useComunicaTheme();
  const router = useRouter();
  useProfileScope('shared', 'events');
  const active = useActiveProfile();
  const q = useActivities();
  const open = useOpenDestination();
  const online = useIsOnline();
  const today = madridDay(comunicaNow());
  const guardianSelf = active.ready && active.audience === 'guardian';

  const cards = (list: ReturnType<typeof activityBlocks>['toSignUp']) =>
    list.map((e) => (
      <EventCard
        key={e.id}
        event={e}
        today={today}
        offline={!online}
        onOpen={() =>
          router.push({
            pathname: '/comunica/actividades/[eventId]',
            params: { eventId: e.id },
          })
        }
        onMyRegistration={() =>
          open(registrationDestination(e.myRegistrationId!), 'Inscripción')
        }
        onSignUp={() => open(signUpDestination(e.id), 'Inscribirme')}
      />
    ));

  return (
    <AreaScreen onRefresh={() => q.refetch()}>
      <Stack.Screen options={{ title: 'Eventos', headerLargeTitle: true }} />
      <ActiveProfileBar />
      {guardianSelf ? (
        <EmptyState
          icon="family-restroom"
          title="¿A quién quieres apuntar?"
          subtitle="Elige a tu hijo o hija para ver las actividades a las que se puede apuntar."
          actionLabel="Elegir"
          onAction={() =>
            router.push({
              pathname: '/comunica/perfiles',
              params: { destino: 'internalpage=list_stic_events' },
            })
          }
          accentColor={t.accentText}
          titleColor={t.text}
          subtitleColor={t.textSecondary}
        />
      ) : (
        <AreaState query={q} skeleton="cards">
          {(data) => {
            const b = activityBlocks(data, today);
            if (b.empty) {
              return (
                <EmptyState
                  icon="event"
                  title={EMPTY.title}
                  subtitle={EMPTY.subtitle}
                  actionLabel={EMPTY.action}
                  onAction={() =>
                    open(REGISTRATIONS_DESTINATION, 'Inscripciones')
                  }
                  accentColor={t.accentText}
                  titleColor={t.text}
                  subtitleColor={t.textSecondary}
                />
              );
            }
            return (
              <View style={styles.wrap}>
                {b.toSignUp.length > 0 ? (
                  <Section title={b.titled ? 'Para apuntarte' : undefined} bare>
                    {cards(b.toSignUp)}
                  </Section>
                ) : null}
                {b.signedUp.length > 0 ? (
                  <Section
                    title={b.titled ? 'Te has apuntado' : undefined}
                    bare
                  >
                    {cards(b.signedUp)}
                  </Section>
                ) : null}
                <SyncBadge generatedAt={q.generatedAt} />
              </View>
            );
          }}
        </AreaState>
      )}
    </AreaScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 24 },
});
