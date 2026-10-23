// El `QueryClient` propio del área (plan 01 §2). Vive en el `_layout` de la
// pestaña, no en la raíz de la app: así no toca al resto y desaparece con el
// interruptor. Refresca lo que está en pantalla al volver la app a primer
// plano y al recuperar la conexión.

import React, { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Network from 'expo-network';
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { getFakeServer } from '@/services/comunica';

export function createAreaQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Lo guardado se queda: sin cobertura, se sigue viendo.
        gcTime: 24 * 60 * 60_000,
        refetchOnReconnect: true,
        refetchOnWindowFocus: true,
        networkMode: 'offlineFirst',
      },
      mutations: { networkMode: 'offlineFirst' },
    },
  });
}

let wired = false;
function wireManagers() {
  if (wired || Platform.OS === 'web') return;
  wired = true;
  focusManager.setEventListener((setFocused) => {
    const sub = AppState.addEventListener('change', (s) =>
      setFocused(s === 'active'),
    );
    return () => sub.remove();
  });
  onlineManager.setEventListener((setOnline) => {
    const sub = Network.addNetworkStateListener((s) =>
      setOnline(!!s.isConnected),
    );
    return () => sub.remove();
  });
}

export default function ComunicaQueryProvider({
  children,
  client,
}: {
  children: React.ReactNode;
  client?: QueryClient;
}) {
  const [qc] = useState(() => client ?? createAreaQueryClient());
  useEffect(() => wireManagers(), []);
  // Con el servidor falso, tocar un mando (otra persona, el reloj, sin
  // conexión…) vuelve a pedir lo que hay en pantalla.
  useEffect(() => {
    const fake = getFakeServer();
    if (!fake) return;
    return fake.subscribe(() => {
      qc.invalidateQueries({ queryKey: ['comunica'] });
    });
  }, [qc]);
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
