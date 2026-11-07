import React, { useCallback } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { router } from 'expo-router';

import CarismochitoMascot from '@/components/CarismochitoMascot';
import { useCarismochito } from '@/contexts/CarismochitoContext';
import { useCarismochitoHunt } from '@/contexts/CarismochitoHuntContext';
import { usePreviewChannel } from '@/contexts/PreviewChannelContext';
import { durations } from '@/constants/animations';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { summarizeCollection } from '@/utils/carismochitoCollection';
import { h } from '@/utils/haptics';

/**
 * Panel de la caza de Carismochitos en el Laboratorio Alpha: ver la colección,
 * hacerlo aparecer ya y empezar de cero. Solo se pinta cuando Carismochito está
 * disponible (`global.carismochito`, ver `utils/carismochitoGate.ts`); ya no
 * tiene interruptor propio ni se destapa con toques escondidos.
 */
export function CarismochitoLabPanel() {
  const { isActive } = useCarismochito();
  const { collection, resetCollection, summon } = useCarismochitoHunt();
  const { closeSecretMenu } = usePreviewChannel();
  const summary = summarizeCollection(collection);

  // Salir del laboratorio primero: el Modal tapa la navegación que hay debajo.
  const leaveAnd = useCallback(
    (action: () => void) => {
      closeSecretMenu();
      setTimeout(action, durations.slow);
    },
    [closeSecretMenu],
  );

  const openCollection = useCallback(() => {
    h.navigate();
    leaveAnd(() => router.push('/carismochito'));
  }, [leaveAnd]);

  const summonNow = useCallback(() => {
    h.tap();
    leaveAnd(summon);
  }, [leaveAnd, summon]);

  const confirmReset = useCallback(() => {
    const run = () => {
      h.remove();
      resetCollection();
    };
    if (Platform.OS === 'web') {
      run();
      return;
    }
    Alert.alert(
      '¿Empezar la colección de cero?',
      'Se borran todos los Carismochitos atrapados, en este móvil y en tu cuenta.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar', style: 'destructive', onPress: run },
      ],
    );
  }, [resetCollection]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <CarismochitoMascot size={56} dance={1} />
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>experimento</Text>
          <Text style={styles.title}>Caza de Carismochitos</Text>
        </View>
      </View>

      <Text style={styles.body}>
        Con el modo Carismochito activo (agita el móvil 5 veces), se asoma más a
        menudo, en colores distintos, y se puede atrapar tocándolo. Cada uno
        cuenta para tu colección.
      </Text>

      <Text style={styles.stat}>
        {summary.found} de {summary.of} encontrados · {summary.total}{' '}
        {summary.total === 1 ? 'captura' : 'capturas'}
      </Text>

      <LabButton label="Ver mi colección" onPress={openCollection} />
      <LabButton
        label={
          isActive
            ? 'Que aparezca ya'
            : 'Que aparezca ya (activa antes el modo)'
        }
        onPress={summonNow}
        disabled={!isActive}
      />
      <LabButton
        label="Empezar de cero"
        onPress={confirmReset}
        subtle
        disabled={summary.total === 0}
      />
    </View>
  );
}

function LabButton({
  label,
  onPress,
  disabled,
  subtle,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  subtle?: boolean;
}) {
  return (
    <PressableFeedback
      onPress={onPress}
      isDisabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={[
        styles.button,
        subtle && styles.buttonSubtle,
        disabled && styles.buttonDisabled,
      ]}
    >
      <PressableFeedback.Highlight />
      <Text style={styles.buttonText}>{label}</Text>
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 460,
    padding: spacing.lg,
    borderRadius: radii.xl,
    backgroundColor: 'rgba(6, 33, 15, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(157, 232, 107, 0.55)',
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerText: { flex: 1 },
  eyebrow: {
    ...typography.overline,
    color: 'rgba(157, 232, 107, 0.95)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.h3,
    color: '#fff',
  },
  body: {
    ...typography.subhead,
    color: 'rgba(255,255,255,0.9)',
  },
  stat: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: 'rgba(90, 224, 138, 0.9)',
    overflow: 'hidden',
  },
  buttonSubtle: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    ...typography.button,
    color: '#000',
    textAlign: 'center',
  },
});
