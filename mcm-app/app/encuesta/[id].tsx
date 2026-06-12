// Ruta raíz genérica de encuestas: `/encuesta/<id>`. Se llega por deep link o
// por notificación push (`data.internalRoute = "/encuesta/<id>"`). El header lo
// aporta el Stack raíz en `app/_layout.tsx`.
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import SurveyScreen from '../screens/SurveyScreen';

export default function SurveyRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SurveyScreen surveyId={String(id)} />;
}
