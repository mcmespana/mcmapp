// Ruta raíz de la "Evaluación de la app". Se abre desde el panel de Ajustes
// (`SettingsBottomSheet`) con `router.push('/evaluacion-app')`. El header (con
// botón Atrás y título) lo aporta el Stack raíz en `app/_layout.tsx`.
import React from 'react';
import EvaluacionAppScreen from './screens/EvaluacionAppScreen';

export default function EvaluacionAppRoute() {
  return <EvaluacionAppScreen />;
}
