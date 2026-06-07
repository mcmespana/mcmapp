import React from 'react';
import { Platform } from 'react-native';
import { getDatabase, push, ref, set } from 'firebase/database';

import EvaluationWizard, {
  EvaluationAnswers,
} from '@/components/EvaluationWizard';
import { useCurrentEvent } from '@/hooks/useCurrentEvent';
import { getEventFirebasePath } from '@/constants/events';
import {
  DEFAULT_EVENT_EVALUATION,
  evaluationDoneKey,
} from '@/constants/evaluation';
import { getFirebaseApp } from '@/utils/firebaseApp';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';

/**
 * Evaluación del evento activo, tipo onboarding (una fase por pregunta).
 * Las preguntas viven en código (`DEFAULT_EVENT_EVALUATION`); las respuestas se
 * escriben en `<evento>/evaluacion/respuestas`.
 */
export default function EvaluacionScreen() {
  const event = useCurrentEvent();
  const { profile } = useUserProfile();
  const resolved = useResolvedProfileConfig();

  const path = getEventFirebasePath(event, 'evaluacion');

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
    <EvaluationWizard
      config={DEFAULT_EVENT_EVALUATION}
      accentColor={event.tintColor}
      doneKey={evaluationDoneKey(event.id)}
      onSubmit={handleSubmit}
    />
  );
}
