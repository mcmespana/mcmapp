import React, { useCallback } from 'react';
import { Platform } from 'react-native';
import { getDatabase, get, ref, set } from 'firebase/database';

import EvaluationWizard, {
  EvaluationAnswers,
} from '@/components/EvaluationWizard';
import { useCurrentEvent } from '@/hooks/useCurrentEvent';
import { getEventCacheKey, getEventFirebasePath } from '@/constants/events';
import {
  DEFAULT_EVENT_EVALUATION,
  EvaluationConfig,
  evaluationDoneKey,
  mergeEvaluationConfig,
} from '@/constants/evaluation';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { getFirebaseApp } from '@/utils/firebaseApp';
import { getDeviceId } from '@/services/pushNotificationService';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';
import { useAuth } from '@/contexts/AuthContext';
import {
  buildIdentityFields,
  hasUserAnswered,
  markUserAnswered,
} from '@/utils/surveyIdentity';

/**
 * Evaluación del evento activo, tipo onboarding (una fase por pregunta).
 * Config desde Firebase (fallback a código). Las respuestas se guardan en
 * `<evento>/evaluacion/respuestas/<deviceId>` — una por dispositivo. Si el
 * usuario ha iniciado sesión, además se ata su `userId` y se deduplica entre
 * dispositivos (marcador en `users/<uid>`).
 */
export default function EvaluacionScreen() {
  const event = useCurrentEvent();
  const { profile } = useUserProfile();
  const resolved = useResolvedProfileConfig();
  const { user } = useAuth();

  const path = getEventFirebasePath(event, 'evaluacion');
  const cacheKey = getEventCacheKey(event, 'evaluacion');
  const scope = evaluationDoneKey(event.id);

  // Config (preguntas, título, estado abierto/cerrado) desde Firebase con
  // fallback al set en código. Así el panel edita la encuesta sin OTA.
  const { data: remoteConfig } = useFirebaseData<Partial<EvaluationConfig>>(
    path,
    cacheKey,
  );
  const config = mergeEvaluationConfig(DEFAULT_EVENT_EVALUATION, remoteConfig);

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
        ...buildIdentityFields({
          authUid: user?.uid,
          name: profile.name,
          profileType: profile.profileType,
          delegationLabel: resolved.delegationLabel,
        }),
      });
      await set(ref(db, `${path}/updatedAt`), Date.now().toString());
      if (user?.uid) await markUserAnswered(user.uid, scope);
    },
    [
      path,
      event.id,
      scope,
      user?.uid,
      profile.name,
      profile.profileType,
      resolved.delegationLabel,
    ],
  );

  const checkSubmitted = useCallback(async () => {
    try {
      if (user?.uid && (await hasUserAnswered(user.uid, scope))) return true;
      const deviceId = await getDeviceId();
      const db = getDatabase(getFirebaseApp());
      const snap = await get(ref(db, `${path}/respuestas/${deviceId}`));
      return snap.exists();
    } catch {
      return false;
    }
  }, [path, scope, user?.uid]);

  return (
    <EvaluationWizard
      config={config}
      accentColor={config.accentColor || event.tintColor}
      doneKey={evaluationDoneKey(event.id)}
      onSubmit={handleSubmit}
      checkSubmitted={checkSubmitted}
    />
  );
}
