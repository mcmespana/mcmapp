import React, { useCallback } from 'react';
import { Platform } from 'react-native';
import { getDatabase, get, ref, set } from 'firebase/database';

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
import { getDeviceId } from '@/services/pushNotificationService';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';

/**
 * Evaluación del evento activo, tipo onboarding (una fase por pregunta).
 * Preguntas en código. Las respuestas se guardan en
 * `<evento>/evaluacion/respuestas/<deviceId>` — una por dispositivo, de modo
 * que una persona no puede enviarla dos veces (se detecta en Firebase aunque
 * no haya iniciado sesión).
 */
export default function EvaluacionScreen() {
  const event = useCurrentEvent();
  const { profile } = useUserProfile();
  const resolved = useResolvedProfileConfig();

  const path = getEventFirebasePath(event, 'evaluacion');

  const handleSubmit = useCallback(
    async (answers: EvaluationAnswers) => {
      const deviceId = await getDeviceId();
      const db = getDatabase(getFirebaseApp());
      await set(ref(db, `${path}/respuestas/${deviceId}`), {
        answers,
        deviceId,
        timestamp: Date.now(),
        reportedAt: new Date().toISOString(),
        platform: Platform.OS,
        eventId: event.id,
        userName: profile.name || 'Anónimo',
        userProfileType: profile.profileType ?? 'sin-perfil',
        userDelegation: resolved.delegationLabel || 'Sin delegación',
      });
      await set(ref(db, `${path}/updatedAt`), Date.now().toString());
    },
    [
      path,
      event.id,
      profile.name,
      profile.profileType,
      resolved.delegationLabel,
    ],
  );

  const checkSubmitted = useCallback(async () => {
    try {
      const deviceId = await getDeviceId();
      const db = getDatabase(getFirebaseApp());
      const snap = await get(ref(db, `${path}/respuestas/${deviceId}`));
      return snap.exists();
    } catch {
      return false;
    }
  }, [path]);

  return (
    <EvaluationWizard
      config={DEFAULT_EVENT_EVALUATION}
      accentColor={event.tintColor}
      doneKey={evaluationDoneKey(event.id)}
      onSubmit={handleSubmit}
      checkSubmitted={checkSubmitted}
    />
  );
}
