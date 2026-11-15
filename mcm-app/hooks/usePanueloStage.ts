// El cambio de pañuelo (de etapa) de la pantalla del pañuelo: la hoja que
// pregunta qué hacer con las piezas, la celebración y la detección de que
// Comunica dice otro color (`decideScarfStage`).
//
// Dos caminos a la misma hoja:
//  · a mano, tocando un color (solo si Comunica no da pañuelo);
//  · detectado: Comunica dice un color distinto del guardado. Se abre sola
//    UNA vez por apertura de la pantalla, cuando no hay nada más delante
//    (tutorial, canje, un recuerdo). «Luego» no cambia nada; se vuelve a
//    preguntar la próxima vez que se abra, y mientras tanto se puede reabrir
//    desde el aviso del pañuelo.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import type { PanueloValue } from '@/hooks/usePanuelo';
import type { PanueloColor, PanueloCommand } from '@/types/panuelo';
import { h } from '@/utils/haptics';
import {
  COLOR_LABEL,
  DEFAULT_PANUELO_COLOR,
  decideScarfStage,
  type ScarfDecision,
} from '@/utils/panuelo';

type Args = {
  panuelo: PanueloValue;
  /** `mcm.scarf` de Comunica (`null`: sin dato). */
  scarf: string | null;
  mode: 'view' | 'edit';
  /** Hay algo delante que va primero (tutorial, canje, un recuerdo). */
  busy: boolean;
  sendToViewer: (command: PanueloCommand) => void;
  /** Cierra la ficha abierta y suelta lo que se estaba presentando. */
  settle: () => void;
};

export function usePanueloStage({
  panuelo,
  scarf,
  mode,
  busy,
  sendToViewer,
  settle,
}: Args) {
  const { state, ready, setColor, changeStage } = panuelo;
  const reducedMotion = useReducedMotion();
  const color = state.color ?? DEFAULT_PANUELO_COLOR;
  const layoutCount = Object.keys(state.layout).length;

  const [target, setTarget] = useState<PanueloColor | null>(null);
  const [open, setOpen] = useState(false);
  const [detected, setDetected] = useState(false);
  /** Confeti del cambio: el color del pañuelo nuevo. */
  const [burst, setBurst] = useState<PanueloColor | null>(null);
  const asked = useRef(false);

  const decision: ScarfDecision = useMemo(
    () => decideScarfStage(scarf, state),
    [scarf, state],
  );
  /** Comunica manda: los colores no se eligen a mano. */
  const locked = decision.kind !== 'manual';
  /** Comunica dice otro color y aún no se ha cambiado. */
  const pending = decision.kind === 'change' ? decision.color : null;

  // Nunca se eligió color: se asigna el de Comunica sin preguntar ni celebrar.
  useEffect(() => {
    if (ready && decision.kind === 'assign') setColor(decision.color);
  }, [ready, decision, setColor]);

  const openFor = useCallback((to: PanueloColor, isDetected: boolean) => {
    setTarget(to);
    setDetected(isDetected);
    setOpen(true);
  }, []);

  // Etapa nueva detectada: se pregunta una vez por apertura.
  useEffect(() => {
    if (!ready || busy || open || asked.current || !pending) return;
    asked.current = true;
    openFor(pending, true);
  }, [ready, busy, open, pending, openFor]);

  /** Tocar un color a mano. */
  const pick = useCallback(
    (next: PanueloColor) => {
      if (next === color || locked) return;
      h.select();
      openFor(next, false);
    },
    [color, locked, openFor],
  );
  /** Volver a preguntar por el cambio detectado. */
  const reopen = useCallback(() => {
    if (!pending) return;
    h.select();
    openFor(pending, true);
  }, [pending, openFor]);

  const close = useCallback(() => setOpen(false), []);
  const clearBurst = useCallback(() => setBurst(null), []);

  const confirm = useCallback(
    (keepPieces: boolean) => {
      if (!target) return;
      const to = target;
      setOpen(false);
      if (!keepPieces) {
        sendToViewer(
          mode === 'edit' ? { type: 'select', id: null } : { type: 'blur' },
        );
      }
      settle();
      changeStage(to, keepPieces);
      h.formSuccess();
      // Con «reducir movimiento» el cambio se queda sin confeti.
      if (!reducedMotion) setBurst(to);
      AccessibilityInfo.announceForAccessibility(
        `Ahora llevas el pañuelo ${COLOR_LABEL[to].name.toLowerCase()}, ${COLOR_LABEL[to].stage}. ${
          layoutCount === 0
            ? ''
            : keepPieces
              ? 'El anterior queda en Mis pañuelos y tus piezas siguen cosidas.'
              : 'El anterior queda en Mis pañuelos y las piezas han vuelto a la colección.'
        }`.trim(),
      );
    },
    [
      target,
      mode,
      layoutCount,
      changeStage,
      reducedMotion,
      sendToViewer,
      settle,
    ],
  );

  return {
    target,
    open,
    detected,
    burst,
    clearBurst,
    locked,
    pending,
    layoutCount,
    pick,
    reopen,
    close,
    confirm,
  };
}
