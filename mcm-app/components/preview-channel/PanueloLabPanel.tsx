import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { router } from 'expo-router';

import { PanueloItemArt } from '@/components/panuelo/PanueloItemArt';
import { durations } from '@/constants/animations';
import { DEFAULT_PANUELO_CATALOG } from '@/constants/panueloCatalog';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { usePreviewChannel } from '@/contexts/PreviewChannelContext';
import { confirmAsync } from '@/utils/confirmDialog';
import { h } from '@/utils/haptics';
import { sortCatalog } from '@/utils/panuelo';

/** Las piezas que asoman en la cabecera del panel, de adorno. */
const SHOWCASE = sortCatalog(DEFAULT_PANUELO_CATALOG).slice(0, 5);

/** Códigos del catálogo de muestra (`firebase-seed/panuelo.json`). */
const DEMO_CODES = 'CONSOLACION · PASCUA27 · CAMINO · VERANO';

/**
 * El pañuelo virtual en el Laboratorio Alpha: la puerta de entrada mientras no
 * tenga sitio propio en la app.
 *
 * El panel NO guarda ni toca el pañuelo: solo navega. «Con las piezas de
 * muestra» y «Empezar de cero» viajan como parámetro de la ruta
 * (`/panuelo?demo=…`) y los ejecuta la pantalla, que es la única dueña del
 * estado (`hooks/usePanuelo.ts`).
 */
export function PanueloLabPanel() {
  const { closeSecretMenu } = usePreviewChannel();

  // Salir del laboratorio primero: el Modal tapa la navegación que hay debajo.
  const open = useCallback(
    (demo?: 'todas' | 'cero') => {
      h.navigate();
      closeSecretMenu();
      setTimeout(
        () => router.push(demo ? `/panuelo?demo=${demo}` : '/panuelo'),
        durations.slow,
      );
    },
    [closeSecretMenu],
  );

  const confirmReset = useCallback(async () => {
    const ok = await confirmAsync({
      title: '¿Empezar el pañuelo de cero?',
      message:
        'Se quitan todas las piezas y su colocación, en este móvil y en tu cuenta.',
      confirmLabel: 'Borrar',
      destructive: true,
    });
    if (ok) open('cero');
  }, [open]);

  return (
    <View style={styles.card}>
      <View>
        <Text style={styles.eyebrow}>experimento</Text>
        <Text style={styles.title}>Pañuelo virtual</Text>
      </View>

      <View style={styles.showcase}>
        {SHOWCASE.map((item) => (
          <PanueloItemArt key={item.id} look={item.look} size={48} />
        ))}
      </View>

      <Text style={styles.body}>
        Tu pañuelo en 3D, con las chapas, pines, cintas, parches y medallas que
        se reparten en las actividades. Gíralo, toca una pieza para verla de
        cerca y, en «Decorar», colócalas a tu gusto.
      </Text>
      <Text style={styles.stat}>Códigos de prueba: {DEMO_CODES}</Text>

      <LabButton label="Abrir mi pañuelo" onPress={() => open()} />
      <LabButton
        label="Abrir con las piezas de muestra"
        onPress={() => open('todas')}
      />
      <LabButton label="Empezar de cero" onPress={confirmReset} subtle />
    </View>
  );
}

function LabButton({
  label,
  onPress,
  subtle,
}: {
  label: string;
  onPress: () => void;
  subtle?: boolean;
}) {
  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.button, subtle && styles.buttonSubtle]}
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
    backgroundColor: 'rgba(10, 20, 54, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(149, 210, 242, 0.55)',
    gap: spacing.md,
  },
  eyebrow: {
    ...typography.overline,
    color: 'rgba(149, 210, 242, 0.95)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.h3,
    color: '#fff',
  },
  showcase: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  body: {
    ...typography.subhead,
    color: 'rgba(255,255,255,0.9)',
  },
  stat: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.75)',
  },
  button: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: 'rgba(149, 210, 242, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(149, 210, 242, 0.6)',
    overflow: 'hidden',
  },
  buttonSubtle: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.25)',
  },
  buttonText: {
    ...typography.button,
    color: '#fff',
  },
});
