import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getDatabase, get, ref, set } from 'firebase/database';
import { MaterialIcons } from '@expo/vector-icons';

import EvaluationWizard, {
  EvaluationAnswers,
} from '@/components/EvaluationWizard';
import colors, { Colors } from '@/constants/colors';
import {
  isEvaluationOpen,
  mergeEvaluationConfig,
} from '@/constants/evaluation';
import {
  SurveyConfig,
  matchesAudience,
  surveyAnswerPath,
  surveyCacheKey,
  surveyDoneKey,
  surveyPath,
} from '@/constants/surveys';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { getFirebaseApp } from '@/utils/firebaseApp';
import { getDeviceId } from '@/services/pushNotificationService';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';
import { useColorScheme } from '@/hooks/useColorScheme';

/**
 * Pantalla genérica de encuesta (`/surveys/<id>`). La config (preguntas,
 * estado, audiencia) la edita el panel en `surveys/<id>/data`. Reutiliza el
 * mismo wizard que las evaluaciones. Las respuestas van a
 * `surveys/<id>/respuestas/<deviceId>` — una por dispositivo.
 *
 * Se llega aquí por deep link / notificación push (`/encuesta/<id>`) o desde
 * un banner. Si la encuesta está cerrada, fuera de ventana, no existe o el
 * usuario no entra en la audiencia, se muestra un mensaje en vez del wizard.
 */
export default function SurveyScreen({ surveyId }: { surveyId: string }) {
  const { profile } = useUserProfile();
  const resolved = useResolvedProfileConfig();
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];

  const { data: remoteConfig, loading } = useFirebaseData<
    Partial<SurveyConfig>
  >(surveyPath(surveyId), surveyCacheKey(surveyId));

  // Fallback mínimo: una encuesta genérica no tiene preguntas en código.
  const config = mergeEvaluationConfig(
    { questions: [] },
    remoteConfig,
  ) as SurveyConfig;

  const handleSubmit = useCallback(
    async (answers: EvaluationAnswers) => {
      const deviceId = await getDeviceId();
      const db = getDatabase(getFirebaseApp());
      const base = {
        answers,
        deviceId,
        surveyId,
        timestamp: Date.now(),
        reportedAt: new Date().toISOString(),
        platform: Platform.OS,
      };
      // Si la encuesta es anónima no adjuntamos datos de perfil.
      const payload = config.anonymous
        ? base
        : {
            ...base,
            userName: profile.name || 'Anónimo',
            userProfileType: profile.profileType ?? 'sin-perfil',
            userDelegation: resolved.delegationLabel || 'Sin delegación',
          };
      await set(ref(db, surveyAnswerPath(surveyId, deviceId)), payload);
      await set(ref(db, `${surveyPath(surveyId)}/updatedAt`), Date.now());
    },
    [
      surveyId,
      config.anonymous,
      profile.name,
      profile.profileType,
      resolved.delegationLabel,
    ],
  );

  const checkSubmitted = useCallback(async () => {
    try {
      const deviceId = await getDeviceId();
      const db = getDatabase(getFirebaseApp());
      const snap = await get(ref(db, surveyAnswerPath(surveyId, deviceId)));
      return snap.exists();
    } catch {
      return false;
    }
  }, [surveyId]);

  // ── Estados que no muestran el formulario ──
  if (loading && !remoteConfig) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const notFound = !remoteConfig || (config.questions ?? []).length === 0;
  const closed = !notFound && !isEvaluationOpen(config);
  const outOfAudience =
    !notFound &&
    !matchesAudience(config.audience, {
      topics: resolved.notificationTopics,
      profileType: profile.profileType,
      delegationId: profile.delegationId,
    });

  if (notFound || closed || outOfAudience) {
    const title = notFound
      ? 'Encuesta no disponible'
      : closed
        ? config.closedTitle || 'Encuesta cerrada'
        : 'No disponible para tu perfil';
    const body = notFound
      ? 'Esta encuesta no existe o ya no está activa.'
      : closed
        ? config.closedBody ||
          'Gracias por tu interés. Esta encuesta ya no admite respuestas.'
        : 'Esta encuesta está dirigida a otro grupo de personas.';
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <MaterialIcons
          name={closed ? 'lock-clock' : 'inbox'}
          size={48}
          color={theme.icon}
        />
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.body, { color: theme.icon }]}>{body}</Text>
      </View>
    );
  }

  return (
    <EvaluationWizard
      config={config}
      accentColor={config.accentColor || colors.primary}
      doneKey={surveyDoneKey(surveyId)}
      onSubmit={handleSubmit}
      checkSubmitted={checkSubmitted}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 8,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
  },
});
