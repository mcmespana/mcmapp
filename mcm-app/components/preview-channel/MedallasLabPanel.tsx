import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { PressableFeedback } from 'heroui-native';

import { Medalla3DModal } from '@/components/medallas/Medalla3DModal';
import { LAB_MEDALS, type LabMedal } from '@/components/medallas/labMedals';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { h } from '@/utils/haptics';

/**
 * Prueba de medallas en 3D, dentro del Laboratorio Alpha.
 *
 * Es el primer paso del sistema de recompensas por ir a eventos (medallas
 * por usuario, colocadas en el pañuelo): antes de montar nada, ver en móviles
 * reales cómo se ven, cuánto pesan y cuánto tardan. Por eso la rejilla usa
 * miniaturas planas y el 3D solo se abre al tocar una.
 */
export function MedallasLabPanel() {
  const [open, setOpen] = useState<LabMedal | null>(null);

  const show = useCallback((medal: LabMedal) => {
    h.tap();
    setOpen(medal);
  }, []);
  const close = useCallback(() => setOpen(null), []);

  return (
    <View style={styles.card}>
      <View>
        <Text style={styles.eyebrow}>experimento</Text>
        <Text style={styles.title}>Medallas en 3D</Text>
      </View>

      <Text style={styles.body}>
        Toca una medalla para verla de cerca y girarla con el dedo. Necesita
        conexión: se descarga la primera vez que la abres.
      </Text>

      <View style={styles.grid}>
        {LAB_MEDALS.map((medal) => (
          <PressableFeedback
            key={medal.id}
            onPress={() => show(medal)}
            accessibilityRole="button"
            accessibilityLabel={`Ver medalla ${medal.name} en 3D`}
            style={styles.tile}
          >
            <PressableFeedback.Highlight />
            <Image
              source={medal.thumbnail}
              style={styles.thumb}
              contentFit="contain"
              accessibilityIgnoresInvertColors
            />
            <Text style={styles.tileName} numberOfLines={2}>
              {medal.name}
            </Text>
          </PressableFeedback>
        ))}
      </View>

      <Medalla3DModal medal={open} onClose={close} />
    </View>
  );
}

const THUMB = 112;

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 460,
    padding: spacing.lg,
    borderRadius: radii.xl,
    backgroundColor: 'rgba(38, 26, 4, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(245, 200, 90, 0.55)',
    gap: spacing.md,
  },
  eyebrow: {
    ...typography.overline,
    color: 'rgba(245, 200, 90, 0.95)',
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
  },
  tile: {
    width: THUMB + spacing.md * 2,
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
  },
  tileName: {
    ...typography.caption,
    color: '#fff',
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
});
