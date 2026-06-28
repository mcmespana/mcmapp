import { StyleSheet, ViewStyle } from 'react-native';

/**
 * Estilos del armazón del wizard de evaluación (topBar, barra de progreso,
 * cabecera de pregunta y footer). Dependen de `isDark` para el track de
 * progreso. Extraído de EvaluationWizard. Los estilos de cada fase/control
 * viven en su propio componente de `components/evaluation/`.
 */
export const createWizardStyles = (isDark: boolean) =>
  StyleSheet.create({
    root: { flex: 1 } as ViewStyle,
    loadingWrap: {
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingBottom: 6,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      width: 60,
    },
    backLabel: { fontSize: 14, fontWeight: '600' },
    closeBtn: { width: 32, alignItems: 'flex-end' },
    progressArea: { flex: 1, justifyContent: 'center' },
    progressTrack: {
      height: 6,
      borderRadius: 3,
      overflow: 'hidden',
      backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
    },
    progressFill: { height: '100%', borderRadius: 3 },
    // Pregunta
    phaseScroll: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 28,
      paddingVertical: 24,
    },
    stepCount: {
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 1,
      marginBottom: 10,
    },
    question: {
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: -0.4,
      lineHeight: 30,
      marginBottom: 24,
    },
    // Footer
    footer: {
      paddingHorizontal: 24,
      paddingTop: 10,
    },
  });
