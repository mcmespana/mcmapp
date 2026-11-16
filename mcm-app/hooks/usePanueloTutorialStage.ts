// Lo que hace el visor mientras se lee un paso del tutorial. Es el MISMO visor
// de la pantalla (un solo contexto 3D): cada paso le pone el estado de ejemplo
// y le manda las órdenes que ilustran lo que cuenta (enfocar una pieza,
// seleccionarla en modo decorar, presentarla, cambiar el color de la tela).
//
// Lo usa también el DESVELADO de las piezas nuevas (`usePanueloNewPieces`):
// sus páginas, el catálogo de verdad y, como base, el pañuelo de la persona.

import { useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

import { EXAMPLE_PANUELO_CATALOG } from '@/constants/panueloCatalog';
import {
  PANUELO_TUTORIAL,
  type PanueloTutorialExample,
  type PanueloTutorialSection,
} from '@/constants/panueloTutorial';
import { durations } from '@/constants/animations';
import type {
  PanueloCatalog,
  PanueloCommand,
  PanueloUserState,
  PanueloViewerState,
} from '@/types/panuelo';
import { exampleViewerState } from '@/utils/panuelo';

/** Lo que tarda el visor en tener las piezas pintadas antes de las órdenes. */
const SETTLE_MS = durations.slow * 2;
/** Cuánto se espera antes de cambiar de color la tela. */
const COLOR_MS = durations.hero + durations.slow;

type Args = {
  open: boolean;
  step: number;
  viewerReady: boolean;
  sendToViewer: (command: PanueloCommand) => void;
  /** Las páginas. Por defecto, las del tutorial. */
  sections?: readonly PanueloTutorialSection[];
  /** De dónde salen las piezas del ejemplo. Por defecto, las de ejemplo. */
  catalog?: PanueloCatalog;
  /** Las piezas del ejemplo se cosen sobre este pañuelo (el de la persona). */
  base?: PanueloUserState;
};

export function usePanueloTutorialStage({
  open,
  step,
  viewerReady,
  sendToViewer,
  sections = PANUELO_TUTORIAL,
  catalog = EXAMPLE_PANUELO_CATALOG,
  base,
}: Args): {
  example: PanueloTutorialExample | undefined;
  /** El estado de ejemplo para el visor; `undefined` con el tutorial cerrado. */
  state: PanueloViewerState | undefined;
  mode: 'view' | 'edit';
} {
  const example = open ? sections[step]?.example : undefined;
  // Con «reducir movimiento», la pieza que se presenta aparece sin giro.
  const still = useReducedMotion();
  /** El paso en el que la tela ya ha cambiado de color. */
  const [changedAt, setChangedAt] = useState<number | null>(null);
  const changed = changedAt === step;

  const color = example
    ? changed && example.toColor
      ? example.toColor
      : example.color
    : null;
  const pieces = example?.pieces;
  const state = useMemo(
    () =>
      color
        ? exampleViewerState(catalog, color, pieces ?? [], base)
        : undefined,
    [catalog, color, pieces, base],
  );

  useEffect(() => {
    if (!example || !viewerReady) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) =>
      timers.push(setTimeout(fn, ms));
    if (example.focus) {
      const id = example.focus;
      later(() => sendToViewer({ type: 'focus', id }), SETTLE_MS);
    }
    if (example.select) {
      const id = example.select;
      later(() => sendToViewer({ type: 'select', id }), SETTLE_MS);
    }
    if (example.reveal) {
      const id = example.reveal;
      later(() => sendToViewer({ type: 'reveal', id, still }), SETTLE_MS);
    }
    if (example.toColor) later(() => setChangedAt(step), COLOR_MS);
    return () => {
      timers.forEach(clearTimeout);
      setChangedAt((at) => (at === step ? null : at));
      sendToViewer({ type: 'blur' });
      sendToViewer({ type: 'select', id: null });
    };
  }, [example, step, viewerReady, sendToViewer, still]);

  return { example, state, mode: example?.mode ?? 'view' };
}
