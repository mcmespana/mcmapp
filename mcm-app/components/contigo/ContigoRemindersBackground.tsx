// components/contigo/ContigoRemindersBackground.tsx
//
// Lo que los recordatorios de Contigo hacen en segundo plano. No pinta nada.
// Se monta una vez en la raíz (`app/_layout.tsx`): reprograma los avisos al
// abrir la app y cada vez que vuelve a primer plano, que es cuando se rellena
// la ventana de los próximos días y cuando se recoge un permiso concedido
// desde los ajustes del sistema.

import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { syncContigoReminders } from '@/services/contigoReminders';

export default function ContigoRemindersBackground() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    syncContigoReminders();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncContigoReminders();
    });
    return () => sub.remove();
  }, []);
  return null;
}
