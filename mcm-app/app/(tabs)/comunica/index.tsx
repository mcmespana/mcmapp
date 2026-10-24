// app/(tabs)/comunica/index.tsx
//
// La puerta de la pestaña Comunica (planes 01 §1, 02 y 10 §1):
//   1. Modo normal (o interruptor en `off`, o sin servidor) → la WebView de
//      siempre, que pasa a ser el legado y no cambia en nada.
//   2. Nativa sin sesión → «Entra en tu área».
//   3. Nativa con sesión → la portada.

import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import ComunicaScreen from '@/app/screens/ComunicaScreen';
import AccessScreen from '@/components/comunica/acceso/AccessScreen';
import AreaScreen from '@/components/comunica/comun/AreaScreen';
import { AreaSkeleton } from '@/components/comunica/comun/AreaState';
import { useArea } from '@/components/comunica/comun/ComunicaAreaProvider';
import { useComunicaTheme } from '@/components/comunica/comun/useComunicaTheme';
import ComunicaHome from '@/components/comunica/pasar-lista/ComunicaHome';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useComunicaLinks } from '@/hooks/comunica/useComunicaLinks';
import { useComunicaMode } from '@/hooks/comunica/useComunicaMode';

export default function ComunicaGate() {
  const mode = useComunicaMode();
  if (mode === 'legacy') {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <ComunicaScreen />
      </>
    );
  }
  return <NativeGate />;
}

function NativeGate() {
  const { session } = useArea();
  useComunicaLinks();
  if (session.status === 'loading') {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, headerLargeTitle: true }} />
        {/* Dentro de `AreaScreen`: si no, el esqueleto queda bajo la
            cabecera grande y transparente de iOS. */}
        <AreaScreen>
          <AreaSkeleton />
        </AreaScreen>
      </>
    );
  }
  if (session.status === 'signedOut') {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            headerLargeTitle: false,
            headerRight: undefined,
          }}
        />
        <AccessScreen
          notice={
            session.reason === 'revoked'
              ? 'Tu sesión ha terminado. Vuelve a entrar.'
              : undefined
          }
        />
      </>
    );
  }
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerLargeTitle: true,
          headerRight: () => <AccountButton />,
        }}
      />
      <ComunicaHome />
    </>
  );
}

function AccountButton() {
  const router = useRouter();
  const t = useComunicaTheme();
  return (
    <PressableFeedback
      onPress={() => router.push('/comunica/yo')}
      accessibilityRole="button"
      accessibilityLabel="Tu cuenta"
      hitSlop={12}
      style={styles.account}
    >
      <IconSymbol
        name="person.crop.circle"
        size={26}
        color={Platform.OS === 'ios' ? t.headerTint : '#fff'}
      />
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  account: { padding: 4 },
});
