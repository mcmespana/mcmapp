/**
 * Estilos de `ChoirSheet`. En módulo aparte para que el componente se quede en
 * lógica de flujos (la convención del proyecto: nada de componentes de 400+
 * líneas con la hoja de estilos dentro).
 */
import { StyleSheet } from 'react-native';
import { radii } from '@/constants/uiStyles';
import { KeyPillColors, SwipeColors, themeColors } from '@/constants/colors';
import typography from '@/constants/typography';

export const accent = (isDark: boolean) => themeColors(isDark).link;

export const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: {
      paddingBottom: 24,
      gap: 12,
    },
    /* --- Cabecera con el coro elegido --- */
    choirRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: radii.md,
      backgroundColor: isDark ? KeyPillColors.bgDark : KeyPillColors.bgLight,
    },
    choirIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#2B3E68' : '#DCE7FF',
    },
    choirTextBlock: { flex: 1 },
    choirLabel: {
      ...typography.micro,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: themeColors(isDark).textSecondary,
    },
    choirName: {
      ...typography.body,
      fontWeight: '700',
      color: themeColors(isDark).textStrong,
    },
    linkBtn: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: radii.sm,
    },
    linkBtnText: {
      ...typography.caption,
      fontWeight: '700',
      color: accent(isDark),
    },

    /* --- Acción destacada («Importar la última») --- */
    hero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: radii.lg,
      backgroundColor: accent(isDark),
    },
    heroIcon: {
      width: 40,
      height: 40,
      borderRadius: radii.xl,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.2)',
    },
    heroTextBlock: { flex: 1 },
    heroTitle: {
      ...typography.body,
      fontWeight: '800',
      color: '#fff',
    },
    heroSubtitle: {
      ...typography.caption,
      color: 'rgba(255,255,255,0.85)',
      marginTop: 2,
    },
    heroDisabled: { opacity: 0.5 },

    /* --- Filas de acción normales --- */
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: radii.md,
    },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: radii.xl,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? KeyPillColors.bgDark : KeyPillColors.bgLight,
    },
    rowIconLive: {
      backgroundColor: isDark ? '#123A2A' : '#DFF5E9',
    },
    rowTextBlock: { flex: 1 },
    rowLabel: {
      ...typography.button,
      fontWeight: '600',
      color: themeColors(isDark).textStrong,
    },
    rowDescription: {
      ...typography.caption,
      color: '#8E8E93',
      marginTop: 2,
    },
    rowDisabled: { opacity: 0.4 },

    /* --- Listas --- */
    list: { maxHeight: 340 },
    listItem: {
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: radii.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    listItemActive: {
      backgroundColor: isDark ? KeyPillColors.bgDark : KeyPillColors.bgLight,
    },
    listTitle: {
      ...typography.button,
      fontWeight: '600',
      color: themeColors(isDark).textStrong,
    },
    listMeta: {
      ...typography.footnote,
      color: '#8E8E93',
      marginTop: 2,
    },
    /* El código pasa a ser un detalle pequeñito, no el protagonista. */
    codeChip: {
      ...typography.micro,
      fontWeight: '700',
      color: isDark ? '#8E8E93' : '#8A8A8E',
      fontVariant: ['tabular-nums'],
    },

    /* --- Varios --- */
    sectionTitle: {
      ...typography.micro,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: themeColors(isDark).textSecondary,
      paddingHorizontal: 12,
      paddingTop: 6,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
      marginVertical: 2,
      marginHorizontal: 12,
    },
    description: {
      ...typography.subhead,
      lineHeight: 20,
      color: themeColors(isDark).textSecondary,
      paddingHorizontal: 12,
    },
    error: {
      ...typography.caption,
      color: SwipeColors.remove,
      paddingHorizontal: 12,
      fontWeight: '600',
    },
    empty: {
      ...typography.subhead,
      color: '#8E8E93',
      textAlign: 'center',
      paddingVertical: 22,
      paddingHorizontal: 12,
    },
    loading: {
      paddingVertical: 26,
    },
    field: {
      paddingHorizontal: 12,
      gap: 6,
    },
    fieldLabel: {
      ...typography.caption,
      fontWeight: '600',
      color: themeColors(isDark).textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    buttons: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 12,
      paddingTop: 4,
    },
    btn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnPrimary: { backgroundColor: accent(isDark) },
    btnSecondary: { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' },
    btnDisabled: { opacity: 0.45 },
    btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    btnSecondaryText: {
      color: themeColors(isDark).textStrong,
      ...typography.button,
      fontWeight: '600',
    },
    backRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingBottom: 2,
    },
    backText: {
      ...typography.subhead,
      fontWeight: '600',
      color: accent(isDark),
    },
  });

export type ChoirSheetStyles = ReturnType<typeof createStyles>;
