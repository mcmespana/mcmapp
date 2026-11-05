// El hero de la portada (`.stic-welcome-hero` del plugin): un BLOQUE de marca
// con el degradado diagonal y su brillo, título grande y una línea de cuerpo.
// Con `onClose` lleva la × de siempre (44 × 44 pt): un bloque que se puede
// cerrar es el único que puede ir seguido de otro (`design.md` §2).
//
// Dos capas por la sombra: fuera la sombra, el radio y un fondo (en Android la
// `elevation` solo existe con `backgroundColor` en la misma vista); dentro el
// recorte `overflow: 'hidden'` con el degradado. Con una sola capa, iOS
// recortaría la sombra.
//
// Quien lo pinte decide ANTES del primer pintado si se ve (`useGreetingHidden`
// y su `ready`): un bloque ocultable que aparece y desaparece parpadea mucho.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii, shadows } from '@/constants/uiStyles';
import { hexAlpha } from '@/utils/colorUtils';
import BrandGradient from './BrandGradient';
import { useComunicaTheme } from './useComunicaTheme';

/** Lado del botón de cierre: el mínimo táctil. */
const CLOSE_SIZE = 44;

interface Props {
  title: string;
  body?: string;
  /** Con él sale la ×; sin él el hero no se puede cerrar. */
  onClose?: () => void;
  /** Lo que lee el lector de pantalla en la × («Ocultar el saludo…»). */
  closeLabel?: string;
}

export default function AreaHero({
  title,
  body,
  onClose,
  closeLabel = 'Cerrar',
}: Props) {
  const t = useComunicaTheme();
  return (
    <View
      style={[styles.outer, shadows.raised, { backgroundColor: t.accentFill }]}
    >
      <View style={styles.clip}>
        <BrandGradient variant="block" sheen />
        <View style={[styles.content, onClose ? styles.withClose : null]}>
          <Text
            accessibilityRole="header"
            maxFontSizeMultiplier={1.3}
            style={[styles.title, { color: t.onGradient }]}
          >
            {title}
          </Text>
          {body ? (
            <Text
              maxFontSizeMultiplier={1.3}
              style={[styles.body, { color: hexAlpha('#fff', 'F2') }]}
            >
              {body}
            </Text>
          ) : null}
        </View>
        {onClose ? (
          <PressableFeedback
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
            style={styles.close}
          >
            <IconSymbol name="xmark" size={16} color={t.onGradient} />
          </PressableFeedback>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { borderRadius: radii.xl },
  clip: { borderRadius: radii.xl, overflow: 'hidden' },
  content: { padding: spacing.lg, gap: spacing.sm },
  // El texto no se mete debajo de la ×.
  withClose: { paddingRight: spacing.lg + CLOSE_SIZE - spacing.sm },
  title: { ...typography.h1 },
  body: { ...typography.body },
  close: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: CLOSE_SIZE,
    height: CLOSE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
