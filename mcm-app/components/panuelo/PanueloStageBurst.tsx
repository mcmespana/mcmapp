import React, { useEffect, useMemo } from 'react';

import CelebrationBurst from '@/components/ui/CelebrationBurst';
import { durations } from '@/constants/animations';
import { PanueloColors } from '@/constants/colors';
import type { PanueloColor } from '@/types/panuelo';

/** Lo que dura el confeti antes de desmontarse. */
const BURST_MS = durations.hero + durations.slow;
/** Adónde vuela cada trocito, desde el centro del visor. */
const OFFSETS = [
  { tx: -70, ty: -80 },
  { tx: 70, ty: -80 },
  { tx: -100, ty: -20 },
  { tx: 100, ty: -20 },
  { tx: -80, ty: 60 },
  { tx: 80, ty: 60 },
  { tx: 0, ty: -100 },
  { tx: -50, ty: 90 },
  { tx: 50, ty: 90 },
  { tx: -110, ty: 30 },
  { tx: 110, ty: 30 },
  { tx: 0, ty: 110 },
];

type Props = {
  /** El color del pañuelo NUEVO; `null` = sin confeti. */
  color: PanueloColor | null;
  /** Ya ha pasado el confeti: quien manda lo apaga. */
  onDone: () => void;
};

/**
 * El confeti del cambio de pañuelo: todo del color de la tela nueva. Sin emoji
 * en el centro (el burst lo admite vacío). Quien lo monta decide si lo hay:
 * con «reducir movimiento» no se monta.
 */
export function PanueloStageBurst({ color, onDone }: Props) {
  useEffect(() => {
    if (!color) return;
    const timer = setTimeout(onDone, BURST_MS);
    return () => clearTimeout(timer);
  }, [color, onDone]);

  const particles = useMemo(
    () =>
      OFFSETS.map((o) => ({
        ...o,
        c: PanueloColors.cloth[color ?? 'green'],
      })),
    [color],
  );
  return (
    <CelebrationBurst visible={color !== null} particles={particles} emoji="" />
  );
}
