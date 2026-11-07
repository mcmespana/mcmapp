// app/(tabs)/comunica/actividades/publica/[slug].tsx — llega de `/actividades/?e=<slug o id>` (plan 10 §3.3; enlaces de WhatsApp).
//
//   · Con sesión: busca el evento con el perfil que se ve y va a su ficha (`replace`: atrás no vuelve a este puente).
//   · Sin sesión: «Entra para apuntarte», que lleva al acceso y vuelve a esta ficha.
//   · La ficha pública SIN sesión (`GET /v1/public/events/:slug`) la sirve el servidor más adelante: hasta entonces, el aviso de entrar.

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import ActivityBridgeScreen from '@/components/comunica/actividades/ActivityBridgeScreen';

export default function ComunicaPublicActivity() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <ActivityBridgeScreen slug={slug} />;
}
