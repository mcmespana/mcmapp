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
import { radii, shadows } from '@/constants/uiStyles';
import { hexAlpha } from '@/utils/colorUtils';

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
    headerRight: { width: 32 },
    markAllButton: { padding: 4 },
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
    notificationCard: {
      flexDirection: 'row',
      backgroundColor: theme.background,
      borderRadius: radii.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.card,
    },
    unreadCard: {
      backgroundColor: scheme === 'dark' ? '#1a1a2e' : '#f0f4ff',
      borderColor: colors.primary,
    },
    notificationIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      marginRight: spacing.md,
      backgroundColor: colors.border,
      alignSelf: 'flex-start',
      marginTop: 2,
    },
    notificationContent: { flex: 1 },
    notificationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    notificationHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
    },
    notificationTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.text,
      flex: 1,
      marginRight: spacing.xs,
    },
    notificationTitleRead: {
      fontWeight: '500',
    },
    unreadBadge: {
      width: 8,
      height: 8,
      borderRadius: radii.xs,
      backgroundColor: colors.primary,
    },
    markAsReadButton: { padding: 2 },
    rightAction: {
      backgroundColor: colors.green,
      justifyContent: 'center',
      alignItems: 'flex-end',
      borderRadius: radii.md,
      height: '100%',
      paddingRight: spacing.md,
      minWidth: 90,
    },
    actionContent: { alignItems: 'center', justifyContent: 'center' },
    actionText: {
      color: '#fff',
      fontWeight: '600',
      marginTop: 4,
      ...typography.footnote,
    },
    notificationBody: {
      ...typography.caption,
      color: theme.icon,
      lineHeight: 19,
      marginBottom: 8,
    },
    notificationFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 6,
    },
    notificationDate: {
      ...typography.micro,
      color: theme.icon,
    },
    chipsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 1,
      flexWrap: 'wrap',
    },
    destinationChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingVertical: 3,
      paddingHorizontal: 7,
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: hexAlpha(colors.primary, '60'),
      backgroundColor: hexAlpha(colors.primary, '12'),
    },
    destinationChipText: {
      fontSize: 10,
      color: colors.primary,
      fontWeight: '600',
    },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingVertical: 3,
      paddingHorizontal: 7,
      borderRadius: radii.xl,
      borderWidth: 1,
    },
    categoryChipText: {
      fontSize: 10,
      fontWeight: '600',
    },
    actionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: radii.xl,
      backgroundColor: colors.primary,
      maxWidth: 140,
    },
    actionChipText: {
      fontSize: 10,
      color: '#fff',
      fontWeight: '600',
      flexShrink: 1,
    },
  });
};
