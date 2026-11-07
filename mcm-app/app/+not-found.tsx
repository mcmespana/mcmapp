import { Stack, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import EmptyState from '@/components/ui/EmptyState';
import { themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function NotFoundScreen() {
  const isDark = useColorScheme() === 'dark';
  return (
    <>
      <Stack.Screen options={{ title: 'Página no encontrada' }} />
      <View
        style={[
          styles.container,
          { backgroundColor: themeColors(isDark).background },
        ]}
      >
        <EmptyState
          icon="link-off"
          title="Esta página no existe"
          subtitle="Puede que el enlace sea antiguo."
          actionLabel="Ir al inicio"
          onAction={() => router.replace('/')}
          accentColor={themeColors(isDark).link}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
});
