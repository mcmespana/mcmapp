// Cuando una pantalla de entrar se abre sin lo que le tocaba recibir (la
// pestaña del navegador se ha recargado, o alguien ha copiado el enlace): lo
// dice y manda a empezar otra vez, en vez de una pantalla en blanco.

import React from 'react';
import { useRouter } from 'expo-router';
import EmptyState from '@/components/ui/EmptyState';
import AreaScreen from '../comun/AreaScreen';
import { useComunicaTheme } from '../comun/useComunicaTheme';

export default function AccessExpired() {
  const t = useComunicaTheme();
  const router = useRouter();
  return (
    <AreaScreen sunken={false}>
      <EmptyState
        icon="lock"
        title="Vuelve a pedir el código"
        subtitle="Por seguridad, esta pantalla no se guarda. Empieza otra vez desde «Entra en tu área»."
        actionLabel="Volver a empezar"
        onAction={() => router.dismissAll()}
        accentColor={t.accentText}
        titleColor={t.text}
        subtitleColor={t.textSecondary}
      />
    </AreaScreen>
  );
}
