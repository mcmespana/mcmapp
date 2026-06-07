import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { getDatabase, push, ref, set } from 'firebase/database';

import ScreenHero from '@/components/ui/ScreenHero';
import PageContainer from '@/components/ui/PageContainer';
import EvaluationForm, { EvaluationAnswers } from '@/components/EvaluationForm';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useCurrentEvent } from '@/hooks/useCurrentEvent';
import { getEventCacheKey, getEventFirebasePath } from '@/constants/events';
import {
  DEFAULT_EVENT_EVALUATION,
  EvaluationConfig,
  evaluationDoneKey,
} from '@/constants/evaluation';
import { getFirebaseApp } from '@/utils/firebaseApp';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';

/**
 * Evaluación del evento activo. Lee las preguntas de Firebase
 * (`<evento>/evaluacion/data`) con fallback al set por defecto en código, y
 * escribe las respuestas en `<evento>/evaluacion/respuestas`.
 */
export default function EvaluacionScreen() {
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];
  const event = useCurrentEvent();

  const path = getEventFirebasePath(event, 'evaluacion');
  const { data: remoteConfig } = useFirebaseData<EvaluationConfig>(
    path,
    getEventCacheKey(event, 'evaluacion'),
  );

  // Si Firebase trae preguntas, mandan ellas; si no, el fallback de código.
  const config: EvaluationConfig = remoteConfig?.questions?.length
    ? remoteConfig
    : {
        ...DEFAULT_EVENT_EVALUATION,
        ...(remoteConfig ?? {}),
        questions: DEFAULT_EVENT_EVALUATION.questions,
      };

  const { profile } = useUserProfile();
  const resolved = useResolvedProfileConfig();

  const handleSubmit = async (answers: EvaluationAnswers) => {
    const db = getDatabase(getFirebaseApp());
    const respRef = push(ref(db, `${path}/respuestas`));
    await set(respRef, {
      answers,
      timestamp: Date.now(),
      reportedAt: new Date().toISOString(),
      platform: Platform.OS,
      eventId: event.id,
      userName: profile.name || 'Anónimo',
      userProfileType: profile.profileType ?? 'sin-perfil',
      userDelegation: resolved.delegationLabel || 'Sin delegación',
    });
    // Refresca el `updatedAt` del nodo para invalidar cachés.
    await set(ref(db, `${path}/updatedAt`), Date.now().toString());
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHero
        title={config.title || 'Evalúa la actividad'}
        subtitle="Cuéntanos qué tal ha ido"
        accentColor={event.tintColor}
        hideOnWeb
      />
      <PageContainer>
        <EvaluationForm
          config={config}
          accentColor={event.tintColor}
          doneKey={evaluationDoneKey(event.id)}
          onSubmit={handleSubmit}
          submitLabel="Enviar evaluación"
        />
      </PageContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
