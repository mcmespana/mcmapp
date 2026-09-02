import { Platform, StyleSheet } from 'react-native';
import colors, { Colors, themeColors } from '@/constants/colors';
import { radii } from '@/constants/uiStyles';
import typography from '@/constants/typography';

/**
 * Estilos de la pantalla de Grupos y sus subcomponentes. Extraído de
 * app/screens/GruposScreen.tsx. `GruposStyles` es el tipo que reciben los
 * subcomponentes por prop.
 */
export const createStyles = (scheme: 'light' | 'dark' | null) => {
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    catScrollContent: {
      paddingBottom: Platform.OS === 'ios' ? 100 : 24,
    },
    listContent: {
      padding: 16,
      paddingBottom: Platform.OS === 'ios' ? 100 : 24,
      gap: 10,
    },
    catList: {
      padding: 16,
      gap: 14,
    },
    catCard: {
      height: 120,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    catIcon: { marginBottom: 4 },
    catLabel: { fontSize: 18, fontWeight: 'bold', color: colors.white },
    catCount: {
      marginTop: 2,
      ...typography.footnote,
      color: 'rgba(255,255,255,0.85)',
      fontWeight: '600',
    },
    sectionHeader: {
      ...typography.body,
      fontWeight: 'bold',
      color: theme.text,
      paddingHorizontal: 4,
      paddingTop: 16,
      paddingBottom: 8,
    },
    groupContainer: { paddingHorizontal: 16 },
    iconBtn: {
      padding: 8,
      borderRadius: 20,
    },
    searchContainer: {
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 12,
      gap: 10,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 52,
      paddingHorizontal: 16,
      borderRadius: radii.xl,
      backgroundColor: themeColors(isDark).backgroundSunken,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? '#48484A' : '#E0E0E5',
    },
    searchInput: {
      flex: 1,
      ...typography.body,
      color: theme.text,
      paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    },
    flexList: {
      flex: 1,
    },
    findMeBtn: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: radii.xl,
      ...Platform.select({
        web: { boxShadow: '0 2px 8px rgba(37,56,131,0.35)' },
        default: {
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 5,
          elevation: 3,
        },
      }),
    },
    findMeText: {
      color: colors.white,
      fontSize: 15,
      fontWeight: '700',
    },
    resultsMeta: {
      paddingHorizontal: 18,
      paddingBottom: 6,
      ...typography.footnote,
      color: themeColors(isDark).textSecondary,
      fontWeight: '500',
    },
    searchSectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 18,
      paddingVertical: 6,
      backgroundColor: themeColors(isDark).backgroundSunken,
    },
    searchSectionHeaderText: {
      ...typography.caption,
      fontWeight: '700',
      color: themeColors(isDark).textStrong,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
    },
    searchSectionCount: {
      ...typography.footnote,
      color: themeColors(isDark).textSecondary,
      fontWeight: '600',
    },
    hitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: themeColors(isDark).background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: themeColors(isDark).separator,
      gap: 12,
    },
    hitRowMe: {
      backgroundColor: isDark ? 'rgba(225,92,98,0.12)' : 'rgba(225,92,98,0.07)',
    },
    hitLeft: {
      width: 28,
      alignItems: 'center',
    },
    hitBody: { flex: 1, minWidth: 0 },
    hitText: {
      fontSize: 15,
      color: theme.text,
      fontWeight: '500',
    },
    hitTextMatch: {
      backgroundColor: isDark
        ? 'rgba(244,193,30,0.30)'
        : 'rgba(244,193,30,0.45)',
      fontWeight: '700',
    },
    hitMeta: {
      ...typography.footnote,
      color: themeColors(isDark).textSecondary,
      marginTop: 2,
    },
    grupoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: radii.lg,
      backgroundColor: themeColors(isDark).background,
      gap: 10,
      ...Platform.select({
        web: {
          boxShadow: isDark
            ? '0 2px 6px rgba(0,0,0,0.3)'
            : '0 2px 6px rgba(0,0,0,0.05)',
        },
        default: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: isDark ? 0.25 : 0.05,
          shadowRadius: 4,
          elevation: 1,
        },
      }),
    },
    grupoCardMe: {
      borderWidth: 1.5,
      borderColor: colors.accent,
    },
    grupoCardMain: { flex: 1, minWidth: 0 },
    grupoCardTitle: {
      ...typography.body,
      fontWeight: '700',
      color: theme.text,
    },
    grupoCardSubtitle: {
      ...typography.caption,
      color: themeColors(isDark).textSecondary,
      marginTop: 2,
    },
    grupoCardMetaRow: {
      flexDirection: 'row',
      gap: 14,
      marginTop: 6,
      flexWrap: 'wrap',
    },
    grupoCardMeta: {
      ...typography.footnote,
      color: themeColors(isDark).textSecondary,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 11,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: themeColors(isDark).separator,
      gap: 12,
    },
    memberRowMe: {
      backgroundColor: isDark ? 'rgba(225,92,98,0.12)' : 'rgba(225,92,98,0.07)',
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    memberText: {
      flex: 1,
      fontSize: 15,
      color: theme.text,
    },
    memberTextMe: {
      fontWeight: '700',
    },
    youBadge: {
      backgroundColor: colors.accent,
      color: colors.white,
      ...typography.micro,
      fontWeight: '700',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radii.xl,
      overflow: 'hidden',
      textTransform: 'lowercase',
    },
    quoteContainer: {
      flexDirection: 'row',
      marginVertical: 12,
      marginHorizontal: 4,
    },
    quoteBorder: {
      width: 4,
      backgroundColor: colors.info,
      borderRadius: 2,
      marginRight: 12,
    },
    quoteText: {
      flex: 1,
      ...typography.body,
      fontStyle: 'italic',
      color: isDark ? '#CCCCCC' : '#666',
      lineHeight: 22,
      paddingVertical: 8,
    },
    inlineSearch: {
      marginTop: 4,
      marginBottom: 4,
      gap: 4,
    },
    filterCount: {
      ...typography.footnote,
      color: themeColors(isDark).textSecondary,
      paddingHorizontal: 4,
    },
    emptyInline: {
      paddingHorizontal: 16,
      paddingVertical: 24,
      textAlign: 'center',
      color: themeColors(isDark).textSecondary,
      fontStyle: 'italic',
    },
  });
};

export type GruposStyles = ReturnType<typeof createStyles>;
