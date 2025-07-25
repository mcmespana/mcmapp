import React from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const scheme = useColorScheme();
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: Colors[scheme ?? 'light'].background },
      ]}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={Colors[scheme ?? 'light'].text}
          />
        </TouchableOpacity>
        <Text style={styles.title}>Notificaciones</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.emptyState}>
          <MaterialIcons
            name="notifications-none"
            size={64}
            color={Colors[scheme ?? 'light'].icon}
          />
          <Text style={styles.emptyTitle}>No hay notificaciones</Text>
          <Text style={styles.emptyText}>
            Aquí aparecerán tus notificaciones cuando las tengas. ¡Vuelve más
            tarde!
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (scheme: 'light' | 'dark') => {
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: theme.background,
    },
    backButton: {
      marginRight: spacing.md,
    },
    headerRight: {
      width: 32, // Mismo ancho que el botón de atrás para centrar el título
    },
    title: {
      ...(typography.h1 as any), // Usando h1 como alternativa a h5
      fontSize: 18, // Tamaño más pequeño que h1
      flex: 1,
      textAlign: 'center',
      color: theme.text,
    },
    content: {
      flexGrow: 1,
      padding: spacing.lg,
      justifyContent: 'center',
    },
    emptyState: {
      alignItems: 'center',
      padding: spacing.xl,
    },
    emptyTitle: {
      ...(typography.h2 as any), // Usando h2 como alternativa a h6
      fontSize: 16, // Tamaño más pequeño que h2
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
      textAlign: 'center',
      color: theme.text,
    },
    emptyText: {
      ...(typography.body as any),
      textAlign: 'center',
      color: theme.icon,
      lineHeight: 22,
    },
  });
};
