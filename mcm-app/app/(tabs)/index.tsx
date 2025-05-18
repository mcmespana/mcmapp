// app/(tabs)/index.tsx
import React from 'react';
import { View, StyleSheet, ViewStyle, TextStyle} from 'react-native';
import { Text, Button } from 'react-native-paper';
import * as Notifications from 'expo-notifications';
import colors from '@/constants/colors';
import typography from '@/constants/typography';
import spacing from '@/constants/spacing';

export default function Home() {
  // 1️⃣ Notif inmediata
  const sendImmediateNotification = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚀 ¡Notif Inmediata!',
        body: 'Esta notificación llegó al vuelo',
        data: { tipo: 'inmediata' },
      },
      trigger: null,  // null = entrega inmediata
    });
  };

  // 2️⃣ Notif a los 5 segundos
  const sendDelayedNotification = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⏱️ Notif 5 s',
        body: 'Esta notificación se programó a 5 s',
        data: { tipo: 'retrasada' },
      },
      trigger: null,
    /* trigger:  {
        seconds: 5,  // Retraso de 5 segundos
        repeats: false,  // No repetir
     }*/
     });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>¡Bienvenido a “Quiénes somos”!</Text>

      <Button
        mode="contained"
        onPress={sendImmediateNotification}
        style={[styles.button, { marginBottom: spacing.sm }]}
        labelStyle={styles.buttonLabel}
      >
        Enviar notif ¡ya!
      </Button>

      <Button
        mode="outlined"
        onPress={sendDelayedNotification}
        style={styles.button}
        labelStyle={styles.buttonLabel}
      >
        Enviar notif en 5 s
      </Button>
    </View>
  );
}

interface Styles {
  container: ViewStyle;
  title: TextStyle;
  button: ViewStyle;
  buttonLabel: TextStyle;
}

const styles = StyleSheet.create<Styles>({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  title: {
    // CAST AQUÍ para que TS se lo crea como TextStyle
    ...(typography.h1 as TextStyle),
    color: colors.text,
    marginBottom: spacing.lg,
  },
  button: {
    width: '80%',
    paddingVertical: spacing.sm,
  },
  buttonLabel: {
    // Y también aquí
    ...(typography.button as TextStyle),
    color: '#fff',
  },
});
