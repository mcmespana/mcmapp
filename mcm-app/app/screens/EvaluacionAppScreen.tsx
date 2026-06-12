import React, { useCallback } from 'react';
import { Platform } from 'react-native';
import { getDatabase, get, ref, set } from 'firebase/database';

import EvaluationWizard, {
  EvaluationAnswers,
} from '@/components/EvaluationWizard';
import colors from '@/constants/colors';
import {
  DEFAULT_APP_EVALUATION,
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
 * Evaluación de la app (no ligada al evento), wizard tipo onboarding. Se abre
 * desde Ajustes como pantalla raíz. Las respuestas se guardan en
 * `app/evaluations/<deviceId>` — una por dispositivo. Si hay sesión, se ata el
 * `userId` y se deduplica entre dispositivos (marcador en `users/<uid>`).
 */
export default function EvaluacionAppScreen() {
  const { profile } = useUserProfile();
  const resolved = useResolvedProfileConfig();
  const { user } = useAuth();
  const scope = evaluationDoneKey('app');

  // Config desde Firebase (`app/evaluationConfig/data`) con fallback al código.
  const { data: remoteConfig } = useFirebaseData<Partial<EvaluationConfig>>(
    'app/evaluationConfig',
    'app_evaluation_config',
  );
  const config = mergeEvaluationConfig(DEFAULT_APP_EVALUATION, remoteConfig);

  const handleSubmit = useCallback(
    async (answers: EvaluationAnswers) => {
      const deviceId = await getDeviceId();
      const db = getDatabase(getFirebaseApp());
      await set(ref(db, `app/evaluations/${deviceId}`), {
        answers,
        deviceId,
        timestamp: Date.now(),
        reportedAt: new Date().toISOString(),
        platform: Platform.OS,
        status: 'pending',
        ...buildIdentityFields({
          authUid: user?.uid,
          name: profile.name,
          profileType: profile.profileType,
          delegationLabel: resolved.delegationLabel,
        }),
      });
      if (user?.uid) await markUserAnswered(user.uid, scope);
    },
    [
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
      const snap = await get(ref(db, `app/evaluations/${deviceId}`));
      return snap.exists();
    } catch {
      return false;
    }
  }, [scope, user?.uid]);

  return (
    <EvaluationWizard
      config={config}
      accentColor={config.accentColor || colors.info}
      doneKey={evaluationDoneKey('app')}
      onSubmit={handleSubmit}
      checkSubmitted={checkSubmitted}
    />
  );
}
