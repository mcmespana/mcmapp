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
//   perfiles → «¿A quién ves?» (familias, plan 11).
//   web      → el legado abierto a propósito (comparar, o lo que no es nativo).
//   muestra  → los componentes del área de un vistazo (solo desarrollo/preview).
//
// El motor del área (consultas, sesión, caché por persona y cola) vive aquí y
// no en la raíz: no toca al resto de la app y se va con el interruptor.

import React from 'react';
import { Stack } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import BrandHeaderBackground from '@/components/comunica/comun/BrandHeaderBackground';
import ComunicaAreaProvider, {
  useArea,
} from '@/components/comunica/comun/ComunicaAreaProvider';
import { comunicaTheme } from '@/components/comunica/comun/theme';
import { ActiveProfileProvider } from '@/hooks/comunica/useActiveProfile';
import { useTabReselectToRoot } from '@/components/tabs/tabBarController';

// expo-router 58: el arranque del stack se declara así, no con `initialRouteName`.
export const unstable_settings = { anchor: 'index' };

/**
 * `ActiveProfileProvider` con una clave por persona. Tras salir y volver a
 * entrar, el proveedor (que vive aquí, por encima de las pantallas) se quedaba
 * con `me` en «pending» y no volvía a pintarse, así que la portada de familia
 * esperaba para siempre un perfil que ya estaba cargado (hallazgo #7 de
 * `REVISION_ANDROID.md`, visto en Android). Una persona nueva, un proveedor nuevo.
 */
function ProfileScope({ children }: { children: React.ReactNode }) {
  const { session } = useArea();
  const who =
    session.status === 'signedIn' ? (session.me?.personId ?? 'in') : 'out';
  return <ActiveProfileProvider key={who}>{children}</ActiveProfileProvider>;
}

export default function ComunicaLayout() {
  // Re-tap del tab: vuelve a la portada del área (lo que no esté guardado
  // lo sigue preguntando `usePreventRemove` en cada pantalla).
  useTabReselectToRoot('comunica');
  // La cabecera lleva el degradado de marca en iOS, Android y web: tinta blanca
  // y barra de estado clara mientras la pestaña está a la vista.
  const tint = comunicaTheme(false).onGradient;
  const focused = useIsFocused();
  return (
    <ComunicaAreaProvider>
      {focused ? <StatusBar style="light" animated /> : null}
      <ProfileScope>
        <Stack
          screenOptions={{
            headerBackButtonDisplayMode: 'minimal',
            headerTintColor: tint,
            headerShadowVisible: false,
            // Barra opaca con el degradado de marca (la del plugin), igual en
            // las tres plataformas. Título grande no: no casa con el degradado.
            headerTransparent: false,
            headerBackground: () => <BrandHeaderBackground />,
            headerTitleStyle: { color: tint },
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
          <Stack.Screen name="perfiles" options={{ title: '¿A quién ves?' }} />
          <Stack.Screen name="datos/index" options={{ title: 'Mis datos' }} />
          <Stack.Screen
            name="actividades/index"
            options={{ title: 'Eventos' }}
          />
          <Stack.Screen
            name="actividades/[eventId]/index"
            options={{ title: 'Evento' }}
          />
          <Stack.Screen
            name="actividades/publica/[slug]"
            options={{ title: 'Evento' }}
          />
          <Stack.Screen
            name="actividades/[eventId]/inscribirme"
            options={{ title: 'Inscripción' }}
          />
          <Stack.Screen
            name="inscripciones/index"
            options={{ title: 'Inscripciones' }}
          />
          <Stack.Screen
            name="inscripciones/[registrationId]/index"
            options={{ title: 'Inscripción' }}
          />
          <Stack.Screen
            name="inscripciones/[registrationId]/modificar"
            options={{ title: 'Modificar inscripción' }}
          />
          <Stack.Screen name="pagos/index" options={{ title: 'Pagos' }} />
          <Stack.Screen name="pagos/[id]" options={{ title: 'Pago' }} />
          <Stack.Screen name="pagos/pagar" options={{ title: 'Pagar' }} />
          <Stack.Screen
            name="documentos/index"
            options={{ title: 'Documentos' }}
          />
          <Stack.Screen
            name="documentos/subir"
            options={{ title: 'Subir un documento', presentation: 'formSheet' }}
          />
          <Stack.Screen
            name="documentos/[id]"
            options={{ title: 'Documento' }}
          />
          <Stack.Screen name="archivo" options={{ title: 'Documento' }} />
          <Stack.Screen
            name="calendario/index"
            options={{ title: 'Calendario' }}
          />
          <Stack.Screen
            name="calendario/sesion/[id]"
            options={{ title: 'Sesión', presentation: 'formSheet' }}
          />
          <Stack.Screen name="datos/[pid]" options={{ title: 'Mis datos' }} />
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
        </Stack>
      </ProfileScope>
    </ComunicaAreaProvider>
  );
}
