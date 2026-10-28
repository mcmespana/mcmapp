// app/(tabs)/comunica/web.tsx
//
// El legado (plan 10 §2):
//   · Con un pase preparado (`openLegacy`): esa página del plugin, con
//     cabecera nativa y la sesión puesta.
//   · Con `?url=` (página pública del dominio o la ficha pública de una
//     actividad, ya validadas por `links.ts`): esa página, sin sesión.
//   · Sin nada: la WebView de siempre, entera (para comparar).

import React, { useState } from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import ComunicaScreen from '@/app/screens/ComunicaScreen';
import LegacyWebScreen from '@/components/comunica/comun/LegacyWebScreen';
import { consumeLegacyOpen } from '@/services/comunica/legacy';
import { classifyComunicaLink, publicPageUrl } from '@/services/comunica/links';

export default function ComunicaLegacy() {
  const params = useLocalSearchParams<{ url?: string; title?: string }>();
  const [open] = useState(consumeLegacyOpen);
  if (open) return <LegacyWebScreen url={open.url} title={open.title} />;
  const url = publicPageUrl(
    params.url ? classifyComunicaLink(params.url) : null,
  );
  if (url) {
    return <LegacyWebScreen url={url} title={params.title ?? 'Comunica'} />;
  }
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ComunicaScreen />
    </>
  );
}
