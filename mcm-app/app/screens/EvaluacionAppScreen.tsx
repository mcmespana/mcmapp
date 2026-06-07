import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { getDatabase, push, ref, set } from 'firebase/database';

import PageContainer from '@/components/ui/PageContainer';
import EvaluationForm, { EvaluationAnswers } from '@/components/EvaluationForm';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  DEFAULT_APP_EVALUATION,
  evaluationDoneKey,
} from '@/constants/evaluation';
import { getFirebaseApp } from '@/utils/firebaseApp';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';

/**
 * Evaluación de la app (no ligada al evento). Se abre desde Ajustes como
 * pantalla raíz (`app/evaluacion-app.tsx`). Preguntas fijas en código; escribe
 * las respuestas en `app/evaluations` (junto al feedback existente).
 */
export default function EvaluacionAppScreen() {
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];
  const { profile } = useUserProfile();
  const resolved = useResolvedProfileConfig();

  const accent = colors.info;

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
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <PageContainer>
        <EvaluationForm
          config={DEFAULT_APP_EVALUATION}
          accentColor={accent}
          doneKey={evaluationDoneKey('app')}
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
