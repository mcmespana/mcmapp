import React from 'react';
import { Platform } from 'react-native';
import { getDatabase, push, ref, set } from 'firebase/database';

import EvaluationWizard, {
  EvaluationAnswers,
} from '@/components/EvaluationWizard';
import colors from '@/constants/colors';
import {
  DEFAULT_APP_EVALUATION,
  evaluationDoneKey,
} from '@/constants/evaluation';
import { getFirebaseApp } from '@/utils/firebaseApp';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';

/**
 * Evaluación de la app (no ligada al evento), wizard tipo onboarding. Se abre
 * desde Ajustes como pantalla raíz (`app/evaluacion-app.tsx`). Preguntas en
 * código; respuestas en `app/evaluations`.
 */
export default function EvaluacionAppScreen() {
  const { profile } = useUserProfile();
  const resolved = useResolvedProfileConfig();

  const handleSubmit = async (answers: EvaluationAnswers) => {
    const db = getDatabase(getFirebaseApp());
    const respRef = push(ref(db, 'app/evaluations'));
    await set(respRef, {
      answers,
      timestamp: Date.now(),
      reportedAt: new Date().toISOString(),
      platform: Platform.OS,
      status: 'pending',
      userName: profile.name || 'Anónimo',
      userProfileType: profile.profileType ?? 'sin-perfil',
      userDelegation: resolved.delegationLabel || 'Sin delegación',
    });
  };

  return (
    <EvaluationWizard
      config={DEFAULT_APP_EVALUATION}
      accentColor={colors.info}
      doneKey={evaluationDoneKey('app')}
      onSubmit={handleSubmit}
    />
  );
}
