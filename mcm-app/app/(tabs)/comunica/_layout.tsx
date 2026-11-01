// app/(tabs)/comunica/_layout.tsx
//
// Pestaña Comunica. Era un fichero suelto con la WebView; desde el plan 01 del
// área nativa (`docs/planes/area-nativa/01-cimientos.md`) es una carpeta con
// su `Stack`, como `contigo/`:
//
//   index    → la puerta: área nativa o la WebView de siempre (el legado).
//   pasar-lista/grupos, pasar-lista/[groupId], …/historial → Pasar Lista.
//   grupos, grupos/[groupId], grupos/sin-grupo, grupos/persona/[personId]
//            → Grupos y fichas y la ficha del participante (plan 05).
//   coordinacion, …/resumen, …/monitores, …/reuniones, …/monitor/[id]
//            → Coordinación, el resumen, la lista de monitores, las reuniones
//              y la ficha del monitor (plan 06).
//   eventos, eventos/[eventId] → pasar lista en un evento y sus grupos de
//            actividad (plan 07).
//   acceso-codigo, acceso-elegir → entrar (plan 02; «Entra en tu área» es la
//              propia puerta cuando no hay sesión).
//   yo       → tu cuenta y salir (carpeta: avisos y mis datos de monitor,
//              planes 08 y 09).
//   web      → el legado abierto a propósito (comparar, o lo que no es nativo).
//   muestra  → los componentes del área de un vistazo (solo desarrollo/preview).
//
// El motor del área (consultas, sesión, caché por persona y cola) vive aquí y
// no en la raíz: no toca al resto de la app y se va con el interruptor. Dentro,
// `ActiveProfileProvider` (plan 11): a quién se ve, uno mismo o un hijo, para
// todas las pantallas de familias.

import React from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import ComunicaAreaProvider from '@/components/comunica/comun/ComunicaAreaProvider';
import ActiveProfileProvider from '@/components/comunica/perfiles/ActiveProfileProvider';
import { TabHeaderColors, themeColors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTabReselectToRoot } from '@/components/tabs/tabBarController';

// expo-router 58: el arranque del stack se declara así, no con `initialRouteName`.
export const unstable_settings = { anchor: 'index' };

export default function ComunicaLayout() {
  // Re-tap del tab: vuelve a la portada del área (lo que no esté guardado
  // lo sigue preguntando `usePreventRemove` en cada pantalla).
  useTabReselectToRoot('comunica');
  const isDark = useColorScheme() === 'dark';
  const ios = Platform.OS === 'ios';
  const tint = ios ? themeColors(isDark).headerTint : '#fff';
  return (
    <ComunicaAreaProvider>
      {/* A quién se ve: uno mismo o un hijo (plan 11). */}
      <ActiveProfileProvider>
        <Stack
          screenOptions={{
            headerBackButtonDisplayMode: 'minimal',
            headerTintColor: tint,
            headerShadowVisible: false,
            // iOS: cabecera del sistema, transparente arriba y cristal al hacer
            // scroll (como el cantoral). Android y web: la barra del color de la
            // pestaña con el texto en blanco, como el resto de pestañas.
            headerTransparent: ios,
            headerStyle: ios
              ? { backgroundColor: 'transparent' }
              : { backgroundColor: TabHeaderColors.comunica },
            headerTitleStyle: { color: tint },
            ...(ios && parseInt(String(Platform.Version), 10) < 26
              ? { headerBlurEffect: 'systemChromeMaterial' as const }
              : {}),
          }}
        >
          <Stack.Screen name="index" options={{ title: 'Comunica' }} />
          <Stack.Screen
            name="pasar-lista/grupos"
            options={{ title: 'Pasar lista' }}
          />
          <Stack.Screen
            name="pasar-lista/[groupId]/index"
            options={{ title: 'Lista' }}
          />
          <Stack.Screen
            name="pasar-lista/[groupId]/historial"
            options={{ title: 'Historial de listas' }}
          />
          <Stack.Screen
            name="grupos/index"
            options={{ title: 'Grupos y fichas' }}
          />
          <Stack.Screen name="grupos/[groupId]" options={{ title: 'Grupo' }} />
          <Stack.Screen
            name="grupos/sin-grupo"
            options={{ title: 'Sin grupo' }}
          />
          <Stack.Screen
            name="grupos/persona/[personId]"
            options={{ title: 'Ficha' }}
          />
          <Stack.Screen
            name="coordinacion/index"
            options={{ title: 'Coordinación' }}
          />
          <Stack.Screen
            name="coordinacion/resumen"
            options={{ title: 'Resumen de grupos' }}
          />
          <Stack.Screen
            name="coordinacion/monitores"
            options={{ title: 'Lista de monitores' }}
          />
          <Stack.Screen
            name="coordinacion/reuniones"
            options={{ title: 'Reuniones de programación' }}
          />
          <Stack.Screen
            name="coordinacion/monitor/[id]"
            options={{ title: 'Ficha' }}
          />
          <Stack.Screen name="acceso-codigo" options={{ title: 'Código' }} />
          <Stack.Screen name="acceso-elegir" options={{ title: 'Elegir' }} />
          <Stack.Screen name="eventos/index" options={{ title: 'Eventos' }} />
          <Stack.Screen
            name="eventos/[eventId]"
            options={{ title: 'Evento' }}
          />
          <Stack.Screen name="yo/index" options={{ title: 'Tu cuenta' }} />
          <Stack.Screen name="yo/avisos" options={{ title: 'Avisos' }} />
          <Stack.Screen
            name="yo/monitor"
            options={{ title: 'Mis datos de monitor' }}
          />
          <Stack.Screen name="web" options={{ headerShown: false }} />
          <Stack.Screen name="muestra" options={{ title: 'Muestra' }} />
          <Stack.Screen name="perfiles" options={{ title: 'Perfiles' }} />
          {/* Plan 13: eventos de familias y su ficha (`eventos/` es el 07). */}
          <Stack.Screen
            name="actividades/index"
            options={{ title: 'Eventos' }}
          />
          <Stack.Screen
            name="actividades/[eventId]/index"
            options={{ title: '' }}
          />
          <Stack.Screen
            name="actividades/publica/[slug]"
            options={{ title: 'Actividad' }}
          />
          {/* Fin del plan 13. */}
        </Stack>
      </ActiveProfileProvider>
    </ComunicaAreaProvider>
  );
}
