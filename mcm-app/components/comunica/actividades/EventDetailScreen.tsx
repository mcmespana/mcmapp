// La ficha de un evento para familias (plan 13; `single_stic_events` con
// `action=detail`). Es COMPARTIDA: cambiar de hijo deja aquí, con el otro
// perfil (un evento no es de nadie, FAM-a8). Se sirve aunque no sea para el
// perfil, con el motivo; lo inexistente, «Esta actividad ya no está
// disponible».
//
// La acción, por este orden (`eventSignup.ts`): pasado → con plaza → no es
// para ti → fuera de plazo → «Inscribirme en esta actividad», la ÚNICA
// principal, pegada abajo (FAM-a2).

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import EmptyState from '@/components/ui/EmptyState';
import typography from '@/constants/typography';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useActivity } from '@/hooks/comunica/useActivities';
import {
  useActiveProfile,
  useProfileScope,
} from '@/hooks/comunica/useActiveProfile';
import { useOpenDestination } from '@/hooks/comunica/useOpenDestination';
import { useIsOnline } from '@/hooks/comunica/useOpenFile';
import { comunicaNow } from '@/services/comunica';
import { isComunicaApiError } from '@/services/comunica/client';
import type { EventDetail } from '@/services/comunica/contract';
import { signupAction } from '@/utils/comunica/eventSignup';
import { madridDay } from '@/utils/comunica/madrid';
import ActiveProfileBar from '../perfiles/ActiveProfileBar';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';
import AreaScreen from '../comun/AreaScreen';
import AreaState from '../comun/AreaState';
import BottomActionBar from '../comun/BottomActionBar';
import RecordNote from '../comun/record/RecordNote';
import SyncBadge from '../comun/SyncBadge';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import ShareEventButton from '../eventos/ShareEventButton';
import EventDetailView from './EventDetailView';
import ImageViewer from './ImageViewer';
import { registrationDestination, signUpDestination } from './signupLinks';
import { useEventHandlers } from './useEventHandlers';

export const NOT_FOUND = {
  title: 'Esta actividad ya no está disponible',
  subtitle:
    'Es posible que se haya retirado. Consulta el resto de actividades abiertas.',
  action: 'Ver eventos',
};

/** Lo que el botón de compartir necesita (plan 08). */
export const shareableOf = (e: EventDetail) =>
  e.startDate
    ? {
        id: e.id,
        name: e.name,
        startDate: e.startDate,
        endDate: e.endDate,
        place: e.place,
        registrationOpensOn: e.window.opensOn,
        registrationClosesOn: e.window.closesOn,
        share: e.share,
      }
    : null;

export default function EventDetailScreen() {
  const t = useComunicaTheme();
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  useProfileScope('shared', 'events');
  const active = useActiveProfile();
  const q = useActivity(eventId);
  const today = madridDay(comunicaNow());
  const { isWide } = useResponsiveLayout();
  const online = useIsOnline();
  const openDestination = useOpenDestination();
  const { handlers, viewer, closeViewer } = useEventHandlers(q.data);
  const childName = active.viewingSelf ? '' : active.childFirstName;
  const action = q.data ? signupAction(q.data, today, childName) : null;
  const goList = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/comunica/actividades');
  };

  const notFound =
    !q.data && isComunicaApiError(q.error) && q.error.code === 'not_found';

  const footer =
    action?.kind === 'open' && q.data ? (
      <BottomActionBar>
        {!online ? (
          <Text style={[styles.barNote, { color: t.textSecondary }]}>
            Necesitas conexión para apuntarte
          </Text>
        ) : null}
        <AreaPrimaryButton
          label={action.label}
          icon="chevron.right"
          disabled={!online}
          onPress={() =>
            openDestination(signUpDestination(q.data!.id), 'Inscribirme')
          }
        />
      </BottomActionBar>
    ) : undefined;

  return (
    <AreaScreen onRefresh={() => q.refetch()} sunken={false} footer={footer}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () =>
            q.data ? <ShareEventButton event={shareableOf(q.data)} /> : null,
        }}
      />
      {/* Fuera de los estados de carga (regla 22): cambiar de hijo se queda aquí. */}
      <ActiveProfileBar />
      {notFound ? (
        <EmptyState
          icon="event-busy"
          title={NOT_FOUND.title}
          subtitle={NOT_FOUND.subtitle}
          actionLabel={NOT_FOUND.action}
          onAction={goList}
          accentColor={t.accentText}
          titleColor={t.text}
          subtitleColor={t.textSecondary}
        />
      ) : (
        <AreaState query={q} skeleton="cards">
          {(e) => (
            <View style={styles.wrap}>
              <EventDetailView
                event={e}
                today={today}
                wide={isWide}
                {...handlers}
                action={
                  action && action.kind !== 'open' ? (
                    <RecordNote
                      title={action.kind === 'blocked' ? action.title : null}
                      text={action.note}
                      tone={
                        action.kind === 'blocked'
                          ? 'info'
                          : action.kind === 'registered' &&
                              e.myRegistrationStatus?.tone !== 'danger'
                            ? 'positive'
                            : 'neutral'
                      }
                      action={
                        action.kind === 'registered'
                          ? {
                              label: action.label,
                              onPress: () =>
                                openDestination(
                                  registrationDestination(
                                    action.registrationId,
                                  ),
                                  'Inscripción',
                                ),
                            }
                          : action.kind === 'blocked'
                            ? {
                                label: 'Ver otras actividades',
                                onPress: goList,
                              }
                            : null
                      }
                    />
                  ) : action?.kind === 'open' && action.note ? (
                    <RecordNote text={action.note} tone="info" />
                  ) : null
                }
              />
              <SyncBadge generatedAt={q.generatedAt} />
            </View>
          )}
        </AreaState>
      )}
      <ImageViewer
        image={viewer?.image ?? null}
        alt={viewer?.alt ?? ''}
        resolve={handlers.resolve}
        onClose={closeViewer}
      />
    </AreaScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 20 },
  barNote: { ...typography.caption, textAlign: 'center', marginBottom: 8 },
});
