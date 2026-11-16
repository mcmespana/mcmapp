import React, { useCallback, useEffect, useState } from 'react';
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
import {
  clearSimulation,
  simulateAttendance,
  simulateCorrection,
  simulatedAttended,
  simulatedEvents,
} from '@/services/panueloAwards';
import { confirmAsync } from '@/utils/confirmDialog';
import { h } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { sortCatalog } from '@/utils/panuelo';

/** Las piezas que asoman en la cabecera del panel, de adorno. */
const SHOWCASE = sortCatalog(DEFAULT_PANUELO_CATALOG).slice(0, 5);
/** Los eventos cuya asistencia se puede simular (servidor falso de Comunica). */
const SIM_EVENTS = simulatedEvents();

/**
 * El pañuelo virtual en el Laboratorio Alpha: la puerta de entrada mientras no
 * tenga sitio propio en la app.
 *
 * El panel NO guarda ni toca el pañuelo: solo navega. «Con las piezas de
 * muestra» y «Empezar de cero» viajan como parámetro de la ruta
 * (`/panuelo?demo=…`) y los ejecuta la pantalla, que es la única dueña del
 * estado (`hooks/usePanuelo.ts`).
 *
 * La excepción es la SIMULACIÓN de las piezas por asistencia: hasta que haya
 * servidor, escribe en el sustituto local que luego sustituirá
 * `/panueloAwards` (`services/panueloAwards.ts`) y abre el pañuelo, que la
 * lee al montar como leerá la de verdad.
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

  // Qué eventos «tienen marca» ahora en la simulación.
  const [attended, setAttended] = useState<string[]>([]);
  useEffect(() => {
    let mounted = true;
    simulatedAttended().then((ids) => {
      if (mounted) setAttended(ids);
    });
    return () => {
      mounted = false;
    };
  }, []);
  const simulate = useCallback(
    async (run: () => Promise<unknown>) => {
      try {
        await run();
      } catch (err) {
        logger.warn('[Pañuelo] la simulación no se pudo guardar:', err);
        return;
      }
      open();
    },
    [open],
  );

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
      <Text style={styles.stat}>
        Mientras se prueba, te llevas todas las piezas al abrirlo.
      </Text>

      <LabButton label="Abrir mi pañuelo" onPress={() => open()} />
      <LabButton
        label="Abrir con las piezas de muestra"
        onPress={() => open('todas')}
      />
      <LabButton label="Empezar de cero" onPress={confirmReset} subtle />

      <View style={styles.simulation}>
        <Text style={styles.eyebrow}>simulación</Text>
        <Text style={styles.stat}>
          Piezas por asistencia, como si te pasaran lista (o lo corrigieran). Se
          guarda solo en este móvil hasta que exista el servidor.
        </Text>
        {SIM_EVENTS.map((event) =>
          attended.includes(event.id) ? (
            <LabButton
              key={event.id}
              label={`Simular que la quitan: ${event.name}`}
              onPress={() => simulate(() => simulateCorrection(event.id))}
              subtle
            />
          ) : (
            <LabButton
              key={event.id}
              label={`Simular asistencia a ${event.name}`}
              onPress={() => simulate(() => simulateAttendance(event.id))}
            />
          ),
        )}
        <LabButton
          label="Borrar la simulación"
          onPress={() => simulate(clearSimulation)}
          subtle
        />
      </View>
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
  simulation: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
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
