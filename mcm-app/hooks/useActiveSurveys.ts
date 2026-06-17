import { useCallback, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';
import {
  SURVEYS_INDEX_PATH,
  SurveyIndexEntry,
  SurveyPlacementType,
  filterActiveSurveys,
  normalizeSurveyIndex,
  surveyDoneKey,
} from '@/constants/surveys';

/**
 * Devuelve las encuestas genéricas que deben mostrarse AHORA en un sitio
 * concreto (Home, hub de evento, Ajustes), leyendo el índice ligero
 * `surveys/_index` y filtrando por placement, audiencia del perfil, estado
 * abierto/cerrado y "ya respondidas" (flag local por dispositivo).
 *
 * No lee la colección entera de encuestas (eso arrastraría todas las
 * respuestas): solo el nodo índice, pequeño, que mantiene el panel.
 */
export function useActiveSurveys(
  placementType: SurveyPlacementType,
  eventId?: string,
): SurveyIndexEntry[] {
  const { data } = useFirebaseData<
    SurveyIndexEntry[] | Record<string, SurveyIndexEntry>
  >(SURVEYS_INDEX_PATH, 'surveys_index');
  const { profile } = useUserProfile();
  const resolved = useResolvedProfileConfig();

  const entries = useMemo(() => normalizeSurveyIndex(data), [data]);

  // Flags locales "ya respondida" (AsyncStorage) — se refrescan al enfocar la
  // pantalla, para que el banner desaparezca al volver de responder.
  const [doneIds, setDoneIds] = useState<string[]>([]);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const ids = entries.map((e) => e?.id).filter(Boolean) as string[];
        if (ids.length === 0) {
          if (active) setDoneIds([]);
          return;
        }
        try {
          const pairs = await AsyncStorage.multiGet(ids.map(surveyDoneKey));
          const doneKeys = new Set(
            pairs.filter(([, v]) => v === '1').map(([k]) => k),
          );
          const done = ids.filter((id) => doneKeys.has(surveyDoneKey(id)));
          if (active) setDoneIds(done);
        } catch {
          if (active) setDoneIds([]);
        }
      })();
      return () => {
        active = false;
      };
    }, [entries]),
  );

  return useMemo(
    () =>
      filterActiveSurveys(entries, {
        placementType,
        eventId,
        user: {
          topics: resolved.notificationTopics,
          profileType: profile.profileType,
          delegationId: profile.delegationId,
        },
        doneIds,
      }),
    [
      entries,
      placementType,
      eventId,
      resolved.notificationTopics,
      profile.profileType,
      profile.delegationId,
      doneIds,
    ],
  );
}
