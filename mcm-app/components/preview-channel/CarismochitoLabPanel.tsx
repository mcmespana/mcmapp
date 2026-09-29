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
 * La única puerta a la caza de Carismochitos y a su colección.
 *
 * Decisión del usuario (2026-09-26): mientras sea de pruebas, no se enlaza
 * desde ningún otro sitio de la app. Vive aquí, dentro del Laboratorio Alpha,
 * con el mismo tono exagerado que el resto del laboratorio.
 */
export function CarismochitoLabPanel() {
  const { isActive } = useCarismochito();
  const { huntEnabled, setHuntEnabled, collection, resetCollection, summon } =
    useCarismochitoHunt();
  const { closeSecretMenu } = usePreviewChannel();
  const summary = summarizeCollection(collection);

  const toggleHunt = useCallback(() => {
    h.toggle();
    setHuntEnabled(!huntEnabled);
  }, [huntEnabled, setHuntEnabled]);

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

      <PressableFeedback
        onPress={toggleHunt}
        accessibilityRole="switch"
        accessibilityState={{ checked: huntEnabled }}
        accessibilityLabel="Caza de Carismochitos"
        style={[styles.toggleRow, huntEnabled && styles.toggleRowOn]}
      >
        <PressableFeedback.Highlight />
        <Text style={styles.toggleLabel}>
          {huntEnabled ? 'Caza encendida' : 'Caza apagada'}
        </Text>
        <View style={[styles.track, huntEnabled && styles.trackOn]}>
          <View style={[styles.thumb, huntEnabled && styles.thumbOn]} />
        </View>
      </PressableFeedback>

      {huntEnabled ? (
        <>
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
        </>
      ) : null}
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

const THUMB = 22;

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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  toggleRowOn: {
    backgroundColor: 'rgba(90, 224, 138, 0.22)',
  },
  toggleLabel: {
    flex: 1,
    ...typography.button,
    color: '#fff',
  },
  track: {
    width: THUMB * 2 + 4,
    height: THUMB + 4,
    borderRadius: radii.pillFull,
    padding: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  trackOn: {
    backgroundColor: 'rgba(90, 224, 138, 0.95)',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radii.pillFull,
    backgroundColor: '#fff',
  },
  thumbOn: {
    transform: [{ translateX: THUMB }],
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
