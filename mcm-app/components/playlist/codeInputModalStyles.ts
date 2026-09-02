/**
 * Estilos de `CodeInputModal`. Extraídos a su propio módulo al añadir el botón
 * de escanear QR: con ellos dentro, el componente pasaba de las 400 líneas que
 * marca la convención del proyecto.
 */
import { Platform, StyleSheet } from 'react-native';
import { radii } from '@/constants/uiStyles';
import colors, {
  KeyPillColors,
  SwipeColors,
  themeColors,
} from '@/constants/colors';
import typography from '@/constants/typography';

export const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: {
      paddingBottom: 24,
    },
    description: {
      ...typography.subhead,
      color: themeColors(isDark).textSecondary,
      marginBottom: 18,
      lineHeight: 20,
    },
    codeRow: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
      marginTop: 6,
    },
    nameRow: {
      marginBottom: 8,
    },
    inputLabel: {
      ...typography.caption,
      fontWeight: '600',
      color: themeColors(isDark).textSecondary,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    hiddenInput: {
      position: 'absolute',
      width: '100%',
      height: 56,
      opacity: 0.01,
      color: 'transparent',
      // En web, dejamos un caret invisible para no ver doble cursor.
      ...(Platform.OS === 'web' ? ({ caretColor: 'transparent' } as any) : {}),
      fontSize: 1,
    },
    cells: {
      flexDirection: 'row',
      gap: 10,
    },
    cell: {
      width: 52,
      height: 60,
      borderRadius: radii.md,
      borderWidth: 1.5,
      borderColor: isDark ? '#48484A' : '#D1D1D6',
      backgroundColor: isDark ? '#1C1C1E' : '#F8F8FA',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cellFilled: {
      borderColor: themeColors(isDark).link,
    },
    cellActive: {
      borderColor: themeColors(isDark).link,
      backgroundColor: isDark ? KeyPillColors.bgDark : KeyPillColors.bgLight,
    },
    cellText: {
      fontSize: 26,
      fontWeight: '700',
      color: themeColors(isDark).textStrong,
      fontVariant: ['tabular-nums'],
    },
    scanBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: radii.md,
      backgroundColor: isDark ? colors.info : colors.primary,
      marginBottom: 14,
    },
    scanBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    suggestRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 14,
      justifyContent: 'center',
    },
    suggestBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: radii.sm,
      backgroundColor: isDark ? KeyPillColors.bgDark : KeyPillColors.bgLight,
    },
    suggestText: {
      ...typography.caption,
      fontWeight: '600',
      color: themeColors(isDark).link,
    },
    error: {
      color: SwipeColors.remove,
      ...typography.caption,
      marginBottom: 8,
      textAlign: 'center',
    },
    buttons: {
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'flex-end',
      marginTop: 4,
    },
    btn: {
      paddingVertical: 11,
      paddingHorizontal: 18,
      borderRadius: 10,
      minWidth: 110,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnSecondary: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F2F2F7',
    },
    btnSecondaryText: {
      fontSize: 15,
      fontWeight: '600',
      color: themeColors(isDark).textStrong,
    },
    btnPrimary: {
      backgroundColor: colors.primary,
    },
    btnPrimaryText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    btnDisabled: {
      opacity: 0.45,
    },
  });
