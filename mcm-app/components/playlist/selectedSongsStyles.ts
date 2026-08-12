/**
 * Estilos de `app/screens/SelectedSongsScreen.tsx`.
 *
 * Extraídos tal cual (sin tocar ni un valor): eran 250 líneas de las 2.039 de la
 * pantalla, que es la más tocada del repo. Mismo patrón que
 * `components/grupos/gruposStyles.ts` y `components/evaluation/wizardStyles.ts`.
 *
 * Depende del esquema de color y del layout responsive, así que sigue siendo una
 * factoría y la pantalla la memoiza.
 */
import { Platform, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import { radii } from '@/constants/uiStyles';

export const createStyles = (
  scheme: 'light' | 'dark' | null,
  isWide: boolean = false,
  maxWidth: number = 9999,
) => {
  const isDark = scheme === 'dark';
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      marginRight: 4,
    },
    headerIconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 8,
      gap: 8,
    },
    selectionCount: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? '#8E8E93' : '#6B6B70',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    subInfo: {
      fontSize: 12,
      color: isDark ? '#7AB3FF' : '#253883',
      marginTop: 3,
      fontWeight: '600',
    },
    /** Mismo sitio, color de aviso: hay cambios que no están subidos. */
    subInfoDirty: {
      color: isDark ? '#F0B429' : '#B26B00',
    },
    clearBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 5,
      paddingHorizontal: 8,
      borderRadius: 8,
      backgroundColor: isDark ? '#2C2C2E' : '#EFEFF4',
    },
    clearBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#8E8E93',
    },
    viewToggle: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
      borderRadius: 8,
      padding: 2,
    },
    viewToggleBtn: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 6,
    },
    viewToggleBtnActive: {
      backgroundColor: isDark ? '#1A2744' : '#FFFFFF',
      ...Platform.select({
        web: { boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
        default: {
          shadowColor: '#000',
          shadowOpacity: 0.1,
          shadowOffset: { width: 0, height: 1 },
          shadowRadius: 2,
          elevation: 1,
        },
      }),
    },
    viewToggleText: {
      fontSize: 12,
      fontWeight: '600',
      color: isDark ? '#AEAEB2' : '#636366',
    },
    viewToggleTextActive: {
      color: isDark ? '#7AB3FF' : '#253883',
      fontWeight: '700',
    },
    listContentContainer: {
      paddingBottom: Platform.OS === 'ios' ? 100 : 24,
      ...(isWide ? { maxWidth, width: '100%', alignSelf: 'center' } : null),
    },
    categoryContainer: {
      marginTop: 12,
      marginHorizontal: 16,
      backgroundColor: isDark ? '#2C2C2E' : '#fff',
      borderRadius: radii.lg,
      overflow: 'hidden',
      ...Platform.select({
        web: {
          boxShadow: isDark
            ? '0 1px 3px rgba(0,0,0,0.4)'
            : '0 1px 3px rgba(0,0,0,0.06)',
        },
        default: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: isDark ? 0.25 : 0.04,
          shadowRadius: 3,
          elevation: 1,
        },
      }),
    },
    categoryTitle: {
      fontSize: 14,
      fontWeight: '700',
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: isDark ? Colors.dark.card : '#F2F2F7',
      color: isDark ? '#AEAEB2' : '#636366',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    emptyContainer: {
      flex: 1,
      padding: 20,
      backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
      justifyContent: 'space-between',
      ...(isWide ? { maxWidth, width: '100%', alignSelf: 'center' } : null),
    },
    emptyContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    emptyIconContainer: {
      width: 100,
      height: 100,
      borderRadius: radii.full,
      backgroundColor: isDark ? '#2C2C2E' : '#fff',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
      ...Platform.select({
        web: {
          boxShadow: isDark
            ? '0 2px 8px rgba(0,0,0,0.3)'
            : '0 2px 8px rgba(0,0,0,0.06)',
        },
        default: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.25 : 0.06,
          shadowRadius: 8,
          elevation: 2,
        },
      }),
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: isDark ? '#EBEBF0' : '#1C1C1E',
      marginBottom: 8,
      textAlign: 'center',
      letterSpacing: -0.4,
    },
    emptyDescription: {
      fontSize: 15,
      color: isDark ? '#8E8E93' : '#636366',
      textAlign: 'center',
      lineHeight: 22,
    },
    importButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: radii.lg,
      backgroundColor: isDark ? '#1A2744' : '#E8F0FE',
      gap: 8,
    },
    importButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#7AB3FF' : '#253883',
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    modalCard: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF',
      borderRadius: 18,
      padding: 22,
      ...Platform.select({
        web: { boxShadow: '0 12px 40px rgba(0,0,0,0.25)' },
        default: {
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 8 },
          elevation: 12,
        },
      }),
    },
    modalTitle: {
      fontSize: 19,
      fontWeight: '700',
      color: isDark ? '#F5F5F7' : '#1C1C1E',
      letterSpacing: -0.3,
      marginBottom: 6,
    },
    modalDescription: {
      fontSize: 14,
      color: isDark ? '#A0A0A8' : '#6B6B70',
      marginBottom: 14,
    },
    modalInput: {
      marginBottom: 8,
    },
    modalNote: {
      fontSize: 12,
      color: isDark ? '#636366' : '#8E8E93',
      marginBottom: 18,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'flex-end',
    },
    modalBtn: {
      paddingVertical: 11,
      paddingHorizontal: 18,
      borderRadius: 10,
      minWidth: 100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalBtnSecondary: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F2F2F7',
    },
    modalBtnSecondaryText: {
      fontSize: 15,
      fontWeight: '600',
      color: isDark ? '#F5F5F7' : '#1C1C1E',
    },
    modalBtnPrimary: {
      backgroundColor: '#253883',
    },
    modalBtnPrimaryText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    modalBtnDisabled: {
      opacity: 0.45,
    },
  });
};

export type SelectedSongsStyles = ReturnType<typeof createStyles>;
