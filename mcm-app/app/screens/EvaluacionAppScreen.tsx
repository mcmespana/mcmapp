import React, { useCallback } from 'react';
import { Platform } from 'react-native';
import { getDatabase, get, ref, set } from 'firebase/database';

import EvaluationWizard, {
  EvaluationAnswers,
} from '@/components/EvaluationWizard';
import colors from '@/constants/colors';
import {
  DEFAULT_APP_EVALUATION,
  evaluationDoneKey,
} from '@/constants/evaluation';
import { getFirebaseApp } from '@/utils/firebaseApp';
import { getDeviceId } from '@/services/pushNotificationService';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';

/**
 * Evaluación de la app (no ligada al evento), wizard tipo onboarding. Se abre
 * desde Ajustes como pantalla raíz. Las respuestas se guardan en
 * `app/evaluations/<deviceId>` — una por dispositivo (no se puede reenviar).
 */
export default function EvaluacionAppScreen() {
  const { profile } = useUserProfile();
  const resolved = useResolvedProfileConfig();

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
        userName: profile.name || 'Anónimo',
        userProfileType: profile.profileType ?? 'sin-perfil',
        userDelegation: resolved.delegationLabel || 'Sin delegación',
      });
    },
    [profile.name, profile.profileType, resolved.delegationLabel],
  );

  const checkSubmitted = useCallback(async () => {
    try {
      const deviceId = await getDeviceId();
      const db = getDatabase(getFirebaseApp());
      const snap = await get(ref(db, `app/evaluations/${deviceId}`));
      return snap.exists();
    } catch {
      return false;
    }
  }, []);

  return (
    <EvaluationWizard
      config={DEFAULT_APP_EVALUATION}
      accentColor={colors.info}
      doneKey={evaluationDoneKey('app')}
      onSubmit={handleSubmit}
      checkSubmitted={checkSubmitted}
    />
  );
}
