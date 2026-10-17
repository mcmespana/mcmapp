/**
 * Estilos de `app/notifications.tsx`.
 *
 * Extraídos tal cual, sin tocar ni un valor: eran 182 líneas de las
 * 1225 del fichero. Mismo patrón que `components/grupos/gruposStyles.ts`.
 */
import { StyleSheet } from 'react-native';
import colors, { Colors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';

export const createStyles = (scheme: 'light' | 'dark') => {
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: scheme === 'dark' ? '#3A3A3C' : colors.border,
      backgroundColor: theme.background,
    },
    backButton: { marginRight: spacing.md },
    // Lo mismo que ocupa «marcar todas» (icono 22 + 2×spacing.sm) para que el
    // título no se mueva al aparecer/desaparecer.
    headerRight: { width: 22 + 2 * spacing.sm },
    markAllButton: { padding: spacing.sm },
    title: {
      ...(typography.h1 as any),
      fontSize: 18,
      flex: 1,
      textAlign: 'center',
      color: theme.text,
    },
    content: { padding: spacing.md },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
    },
    emptyTitle: {
      ...(typography.h2 as any),
      ...typography.body,
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
