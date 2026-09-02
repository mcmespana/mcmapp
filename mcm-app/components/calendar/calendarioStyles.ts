/**
 * Estilos de `app/(tabs)/calendario.tsx`.
 *
 * Extraídos tal cual, sin tocar ni un valor: eran 360 líneas de las
 * 1175 del fichero. Mismo patrón que `components/grupos/gruposStyles.ts`.
 */
import { Platform, StyleSheet } from 'react-native';
import colors, { Colors, themeColors } from '@/constants/colors';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { hexAlpha } from '@/utils/colorUtils';

export const createStyles = (scheme: 'light' | 'dark') => {
  const isDark = scheme === 'dark';
  const theme = Colors[scheme];

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors(isDark).backgroundSunken,
    },
    // Cuerpo centrado en pantallas anchas (iPad). En móvil ocupa todo el ancho.
    bodyWrap: {
      flex: 1,
      width: '100%',
    },

    // View mode switcher
    switcherWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 8,
    },
    // El mismo conmutador, pero metido en el título del header nativo. El hueco
    // del título va centrado, así que el ancho útil es el que dejan los bar
    // items a los dos lados (aunque a la izquierda no haya ninguno): de ahí los
    // 290, que es casi todo el ancho sin llegar a pisar el botón de la derecha.
    // El alto lo marca el header, por eso el conmutador va en versión `compact`.
    headerSwitcher: {
      flexDirection: 'row',
      width: 290,
      height: 34,
    },
    // En ancho, el switcher Mes/Agenda no debe estirarse a todo lo ancho.
    switcherWrapperWide: {
      alignSelf: 'center',
      maxWidth: 360,
      width: '100%',
    },
    // Dos paneles del mes en iPad landscape.
    monthRowTwoPane: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 16,
    },
    monthLeftPane: {
      width: 380,
    },
    monthRightPane: {
      flex: 1,
    },
    subscribeIconBtn: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
      justifyContent: 'center',
      alignItems: 'center',
    },

    // Calendar
    calendar: {
      marginBottom: 4,
    },
    calendarCardContainer: {
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 12,
      borderRadius: 20,
      backgroundColor: themeColors(isDark).background,
      overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.4 : 0.08,
          shadowRadius: 8,
        },
        android: {
          elevation: 4,
        },
        web: {
          boxShadow: isDark
            ? '0 4px 12px rgba(0,0,0,0.3)'
            : '0 4px 12px rgba(0,0,0,0.06)',
        },
      }),
    },

    // Filter chips
    chipsScrollView: {
      flexShrink: 0,
      flexGrow: 0,
    },
    chipsScroll: {
      flexDirection: 'row', // Necesario en web — RN Web no lo aplica auto con horizontal={true}
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8,
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors(isDark).background,
      borderRadius: 100,
      paddingHorizontal: 12,
      paddingVertical: 7,
      gap: 6,
      borderWidth: 1,
      borderColor: isDark ? Colors.dark.card : '#E5E5EA',
      // No elevation/shadow — the border is enough. Elevation on Android
      // adds a Material Design drop-shadow that makes chips look dark & raised.
      elevation: 0,
    },
    chipDot: {
      width: 8,
      height: 8,
      borderRadius: radii.xs,
    },
    chipLabel: {
      ...typography.caption,
      fontWeight: '500',
      color: themeColors(isDark).textSecondary,
    },

    // Event section (calendar view)
    eventSection: {
      paddingHorizontal: 16,
    },
    eventSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
      marginTop: 4,
      gap: 8,
    },
    backToTodayPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radii.xl,
      backgroundColor: hexAlpha(colors.info, '12'),
      borderWidth: 1,
      borderColor: hexAlpha(colors.info, '30'),
      alignSelf: 'flex-start',
    },
    backToTodayLabel: {
      ...typography.footnote,
      fontWeight: '600',
      color: colors.info,
      letterSpacing: -0.1,
    },
    agendaBackToTodayRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 6,
    },
    eventSectionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    eventSectionDay: {
      fontSize: 34,
      fontWeight: '700',
      color: colors.info,
      lineHeight: 40,
      fontVariant: ['tabular-nums'],
    },
    eventSectionWeekday: {
      ...typography.subhead,
      fontWeight: '500',
      color: themeColors(isDark).textSecondary,
      textTransform: 'capitalize',
    },
    eventSectionCount: {
      ...typography.footnote,
      fontWeight: '500',
      color: isDark ? '#636366' : '#AEAEB2',
      marginTop: 1,
    },

    // Event card
    eventCard: {
      flexDirection: 'row',
      backgroundColor: themeColors(isDark).background,
      borderRadius: radii.lg,
      marginBottom: 8,
      overflow: 'hidden',
      ...(Platform.OS === 'web'
        ? {
            boxShadow: isDark
              ? '0 1px 3px rgba(0,0,0,0.4)'
              : '0 1px 3px rgba(0,0,0,0.06)',
          }
        : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: isDark ? 0.25 : 0.04,
            shadowRadius: 3,
            elevation: 1,
          }),
    },
    pastEventCard: {
      opacity: 0.55,
    },
    eventColorBar: {
      width: 4,
      borderTopLeftRadius: radii.lg,
      borderBottomLeftRadius: radii.lg,
    },
    eventCardBody: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 14,
      gap: 6,
    },
    eventCardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 8,
    },
    eventTitle: {
      ...typography.body,
      fontWeight: '600',
      color: themeColors(isDark).textStrong,
      flex: 1,
      letterSpacing: -0.2,
    },
    calendarBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: radii.sm,
      paddingHorizontal: 8,
      paddingVertical: 3,
      gap: 4,
      maxWidth: 120,
    },
    calendarDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    calendarBadgeText: {
      ...typography.micro,
      fontWeight: '600',
    },
    eventMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    eventLocation: {
      ...typography.caption,
      color: '#8E8E93',
      flex: 1,
    },
    eventDuration: {
      ...typography.caption,
      color: '#8E8E93',
    },

    // Agenda container — flex: 1 para que el SectionList crezca y los chips no
    agendaContainer: {
      flex: 1,
    },
    agendaList: {
      flex: 1,
    },

    // Agenda view
    agendaHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      gap: 4,
    },
    agendaNavBtn: {
      width: 40,
      height: 40,
      borderRadius: radii.xl,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monthLabel: {
      fontSize: 20,
      fontWeight: '700',
      color: themeColors(isDark).textStrong,
      minWidth: 180,
      textAlign: 'center',
      letterSpacing: -0.3,
    },
    agendaContent: {
      paddingHorizontal: 16,
    },

    // Section header (agenda)
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 4,
      marginTop: 8,
      gap: 12,
    },
    todaySectionHeader: {},
    pastSectionHeader: {
      opacity: 0.6,
    },
    sectionDateColumn: {
      alignItems: 'center',
      minWidth: 44,
    },
    sectionDay: {
      fontSize: 26,
      fontWeight: '700',
      color: themeColors(isDark).textStrong,
      lineHeight: 30,
      fontVariant: ['tabular-nums'],
    },
    sectionWeekday: {
      ...typography.micro,
      fontWeight: '700',
      color: '#8E8E93',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    todayAccent: {
      color: colors.info,
    },
    sectionDivider: {
      flex: 1,
      height: 1,
      backgroundColor: isDark ? Colors.dark.card : '#E5E5EA',
    },
    sectionBadge: {
      backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 2,
      minWidth: 24,
      alignItems: 'center',
    },
    sectionBadgeText: {
      ...typography.footnote,
      fontWeight: '600',
      color: isDark ? '#8E8E93' : '#636366',
      fontVariant: ['tabular-nums'],
    },

    // Misc
    pastText: {
      color: isDark ? '#636366' : '#AEAEB2',
    },
    noEvents: {
      ...typography.body,
      color: theme.text,
      fontStyle: 'italic',
    },
  });
};
