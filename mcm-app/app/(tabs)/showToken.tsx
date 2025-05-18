// app/(tabs)/showToken.tsx
// Solo para desarrollo, te da el token para las notificaciones de EXPO pUSH
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import * as Notifications from 'expo-notifications';
import spacing from '@/constants/spacing';
import colors from '@/constants/colors';

export default function ShowToken() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await Notifications.getExpoPushTokenAsync();
      setToken(data);
      console.log('🎫 Expo Push Token:', data); // consola para copiar y pegar - ExponentPushToken[AAGJdBK_ok_QFvhlVGaIaY]
    })();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.ctn}>
      <Text style={styles.title}>Tu Expo Push Token:</Text>
      {token
        ? <Text selectable style={styles.token}>{token}</Text>
        : <Text>Cargando token…</Text>
      }
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  ctn: {
    flexGrow: 1,
    padding: spacing.md,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 18,
    marginBottom: spacing.sm,
    color: colors.text,
  },
  token: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: colors.primary,
  },
});
