import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getDatabase, get, ref } from 'firebase/database';
import { MaterialIcons } from '@expo/vector-icons';

import EvaluationWizard, {
  EvaluationAnswers,
} from '@/components/EvaluationWizard';
import colors, { themeColors, Colors } from '@/constants/colors';
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
import { setWithRetry } from '@/services/firebaseWrites';
import { getDeviceId } from '@/services/pushNotificationService';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import {
  buildIdentityFields,
  hasUserAnswered,
  markUserAnswered,
} from '@/utils/surveyIdentity';

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
  const { user } = useAuth();
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];
  const scope = surveyDoneKey(surveyId);

  const { data: remoteConfig, loading } = useFirebaseData<
    Partial<SurveyConfig>
  >(surveyPath(surveyId), surveyCacheKey(surveyId));

  // Fallback mínimo: una encuesta genérica no tiene preguntas en código.
  const config = mergeEvaluationConfig(
    { questions: [] },
    remoteConfig,
  ) as SurveyConfig;

  // El uid se saca a una variable ANTES de los callbacks a propósito: si se
  // usa `user?.uid` dentro, el React Compiler infiere `user` entero como
  // dependencia, no coincide con la lista declarada y se salta el componente
  // entero (regla `preserve-manual-memoization`).
  const uid = user?.uid;

  const handleSubmit = useCallback(
    async (answers: EvaluationAnswers) => {
      const deviceId = await getDeviceId();
      // Anónima → sin datos de perfil ni userId. Si no, se ata el userId.
      await setWithRetry(surveyAnswerPath(surveyId, deviceId), {
        answers,
        deviceId,
        surveyId,
        timestamp: Date.now(),
        reportedAt: new Date().toISOString(),
        platform: Platform.OS,
        ...buildIdentityFields({
          anonymous: config.anonymous,
          authUid: uid,
          name: profile.name,
          profileType: profile.profileType,
          delegationLabel: resolved.delegationLabel,
        }),
      });
      await setWithRetry(`${surveyPath(surveyId)}/updatedAt`, Date.now());
      // Dedup entre dispositivos solo si hay sesión y no es anónima.
      if (uid && !config.anonymous)
        await markUserAnswered(uid, scope, surveyId);
    },
    [
      surveyId,
      scope,
      config.anonymous,
      uid,
      profile.name,
      profile.profileType,
      resolved.delegationLabel,
    ],
  );

  const checkSubmitted = useCallback(async () => {
    try {
      if (uid && !config.anonymous && (await hasUserAnswered(uid, scope)))
        return true;
      const deviceId = await getDeviceId();
      const db = getDatabase(getFirebaseApp());
      const snap = await get(ref(db, surveyAnswerPath(surveyId, deviceId)));
      return snap.exists();
    } catch {
      return false;
    }
  }, [surveyId, scope, config.anonymous, uid]);

  // ── Estados que no muestran el formulario ──
  if (loading && !remoteConfig) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator
          size="large"
          color={themeColors(scheme === 'dark').link}
        />
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
