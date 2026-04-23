import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Linking,
  Platform,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Button } from 'heroui-native';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import spacing from '@/constants/spacing';

interface Props {
  mode: 'maintenance' | 'update';
  message?: string;
  minVersion?: string;
  currentVersion?: string;
}

const STORE_URLS = {
  ios: 'https://apps.apple.com/app/id6745557177',
  android: 'https://play.google.com/store/apps/details?id=com.mcmespana.mcmapp',
};

export default function MaintenanceScreen({
  mode,
  message,
  minVersion,
  currentVersion,
}: Props) {
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];

  const isUpdate = mode === 'update';
  const title = isUpdate ? 'Actualiza la app' : 'Volvemos enseguida';
  const body =
    message ||
    (isUpdate
      ? `Tu versión (${currentVersion ?? '?'}) ya no está soportada. Actualiza a la ${minVersion ?? 'última'} para continuar.`
      : 'Estamos haciendo mantenimiento. Inténtalo en unos minutos.');
  const iconName = isUpdate ? 'system-update' : 'build';

  const openStore = () => {
    const url = Platform.OS === 'ios' ? STORE_URLS.ios : STORE_URLS.android;
    Linking.openURL(url).catch((e) => console.error(e));
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top', 'bottom']}
    >
      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: colors.primary }]}>
          <MaterialIcons name={iconName} size={36} color="#fff" />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.body, { color: theme.icon }]}>{body}</Text>
        {isUpdate && (
          <Button variant="primary" onPress={openStore} style={styles.button}>
            <Button.Label>Ir a la tienda</Button.Label>
          </Button>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 } as ViewStyle,
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  } as ViewStyle,
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  } as ViewStyle,
  title: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.4,
  } as TextStyle,
  body: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.85,
    maxWidth: 340,
  } as TextStyle,
  button: {
    marginTop: spacing.lg,
    minWidth: 220,
  } as ViewStyle,
});
