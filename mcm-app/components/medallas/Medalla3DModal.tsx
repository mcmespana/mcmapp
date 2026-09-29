import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { PressableFeedback } from 'heroui-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Medalla3DViewer } from '@/components/medallas/Medalla3DViewer';
import type { LabMedal } from '@/components/medallas/labMedals';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';

type Props = {
  medal: LabMedal | null;
  onClose: () => void;
};

/**
 * El pop-up de una medalla: a pantalla completa, fondo negro y la medalla
 * entrando con dos vueltas que frenan, al estilo de los premios de la app
 * Fitness de Apple. Se gira con el dedo y, al soltarla, vuelve sola de frente.
 *
 * Es un `Modal` propio: se abre encima del Laboratorio, que también lo es.
 */
export function Medalla3DModal({ medal, onClose }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={medal !== null}
      animationType="fade"
      presentationStyle="overFullScreen"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.root,
          { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.lg },
        ]}
      >
        <View style={styles.topBar}>
          <PressableFeedback
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cerrar medalla"
            style={styles.close}
          >
            <PressableFeedback.Highlight />
            <MaterialIcons name="close" size={24} color="#fff" />
          </PressableFeedback>
        </View>

        {medal ? (
          <>
            <Medalla3DViewer
              key={medal.id}
              src={medal.glbUrl}
              style={styles.viewer}
            />
            <View style={styles.caption}>
              <Text style={styles.name} accessibilityRole="header">
                {medal.name}
              </Text>
              <Text style={styles.subtitle}>{medal.subtitle}</Text>
              <Text style={styles.hint}>Arrastra para girarla</Text>
            </View>
          </>
        ) : null}
      </View>
    </Modal>
  );
}

const CLOSE_SIZE = 44;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  close: {
    width: CLOSE_SIZE,
    height: CLOSE_SIZE,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  viewer: {
    flex: 1,
  },
  caption: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  name: {
    ...typography.h2,
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  hint: {
    ...typography.footnote,
    color: 'rgba(255,255,255,0.45)',
    marginTop: spacing.sm,
  },
});
