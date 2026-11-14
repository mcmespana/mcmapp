// app/(tabs)/comunica/index.tsx
//
// La puerta de la pestaña Comunica (planes 01 §1, 02 y 10 §1):
//   1. Nativa (la de todos desde el 14/11/2026) sin sesión → «Entra en Comunica».
//   2. Nativa con sesión → la portada.
//   3. Interruptor en `off` (o `solo-alpha` sin el Laboratorio, o sin
//      servidor) → la WebView de siempre: el legado, DEPRECADO, solo de
//      vuelta atrás (`utils/comunica/router.ts`).

import React from 'react';
import { StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import ComunicaScreen from '@/app/screens/ComunicaScreen';
import AccessScreen from '@/components/comunica/acceso/AccessScreen';
import AreaScreen from '@/components/comunica/comun/AreaScreen';
import { AreaSkeleton } from '@/components/comunica/comun/AreaState';
import { useArea } from '@/components/comunica/comun/ComunicaAreaProvider';
import { useHeaderGlyph } from '@/components/comunica/comun/useHeaderGlyph';
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
        <Stack.Screen
          options={{ headerShown: true, headerLargeTitle: false }}
        />
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
        <AccessScreen revoked={session.reason === 'revoked'} />
      </>
    );
  }
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerLargeTitle: false,
          headerRight: () => <AccountButton />,
        }}
      />
      <ComunicaHome />
    </>
  );
}

function AccountButton() {
  const router = useRouter();
  const glyph = useHeaderGlyph();
  return (
    <PressableFeedback
      onPress={() => router.push('/comunica/yo')}
      accessibilityRole="button"
      accessibilityLabel="Tu cuenta"
      hitSlop={12}
      style={styles.account}
    >
      <IconSymbol name="person.crop.circle" size={26} color={glyph} />
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  account: { padding: 4 },
});
