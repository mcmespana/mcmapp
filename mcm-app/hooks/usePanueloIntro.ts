// El modo a pantalla completa del pañuelo: el TUTORIAL o el DESVELADO, con
// un mismo componente (`PanueloTutorial`) y el mismo visor. La pantalla solo
// pregunta a `usePanueloIntro` si está abierto, qué pinta el visor y qué
// props llevan la cabecera y las páginas.
//
// El DESVELADO: las piezas que te han llegado por ir a una actividad (te han
// pasado lista) se presentan al abrir el pañuelo, una a una, con «Siguiente»;
// al acabar, «Colocarlas» abre el modo decorar con ellas esperando en la caja.
//
// No es otra pantalla ni otro visor: es el MISMO modo a pantalla completa del
// tutorial (`PanueloTutorial`, `usePanueloTutorialStage`) con otras páginas
// (`newPiecesSections`) y el pañuelo de la persona de fondo, con la pieza
// cosida de mentira mientras se presenta.
//
// Va después del tutorial y antes que todo lo demás (canje, intercambio por
// enlace, cambio de etapa): mientras espera o dura, `busy`.
//
// Aquí vive también el aviso discreto de lo retirado («Ya no tienes…»), una
// sola vez, cuando la pantalla está libre.
//
// Documentación: `docs/funcionalidades/PANUELO.md` («Piezas por asistencia»).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useToast } from 'heroui-native';

import type { PanueloValue } from '@/hooks/usePanuelo';
import type { usePanueloTutorial } from '@/hooks/usePanueloTutorial';
import { usePanueloTutorialStage } from '@/hooks/usePanueloTutorialStage';
import type { PanueloCommand } from '@/types/panuelo';
import type { CollectionFilter } from '@/utils/panuelo';
import { h } from '@/utils/haptics';
import {
  newPieceReason,
  newPiecesQueue,
  newPiecesSections,
  pieceAccent,
} from '@/utils/panuelo';

type Args = {
  panuelo: Pick<
    PanueloValue,
    | 'ready'
    | 'catalog'
    | 'state'
    | 'unseen'
    | 'markSeen'
    | 'revokedNotice'
    | 'dismissRevokedNotice'
  >;
  /**
   * Puede empezar: el tutorial ya se resolvió y no se está viendo un pañuelo
   * anterior.
   */
  free: boolean;
  viewerReady: boolean;
  sendToViewer: (command: PanueloCommand) => void;
  /** «Colocarlas»: modo decorar, filtro «Sin poner» y esta pieza abierta. */
  onPlace: (firstId: string) => void;
};

export function usePanueloNewPieces({
  panuelo,
  free,
  viewerReady,
  sendToViewer,
  onPlace,
}: Args) {
  const { ready, catalog, state, unseen, markSeen } = panuelo;
  const reducedMotion = useReducedMotion();
  const { toast } = useToast();
  /** Las piezas de esta tanda, fijas mientras dura (marcarlas no las mueve). */
  const [ids, setIds] = useState<string[] | null>(null);
  const [index, setIndex] = useState(0);
  /** Ya se cerró en esta apertura: lo que quede sale la próxima vez. */
  const [done, setDone] = useState(false);
  /** La página cuyo confeti ya terminó. */
  const [burstDone, setBurstDone] = useState<string | null>(null);

  const queue = useMemo(
    () => newPiecesQueue(catalog, state, unseen),
    [catalog, state, unseen],
  );
  const open = ids !== null;
  const waiting = !open && !done && ready && queue.length > 0;

  // Se abre en cuanto puede (durante el render, no en un efecto: así ni el
  // canje ni el cambio de etapa llegan a asomar un fotograma antes).
  if (waiting && free) {
    setIndex(0);
    setIds(queue);
  }

  // Las páginas: sin visor (WebGL no arrancó), la pieza dibujada en plano.
  const sections = useMemo(
    () =>
      ids
        ? newPiecesSections(catalog, state, ids).map((s) =>
            viewerReady || !s.example
              ? s
              : { ...s, example: { ...s.example, art: s.example.pieces } },
          )
        : [],
    [ids, catalog, state, viewerReady],
  );
  const stage = usePanueloTutorialStage({
    open,
    step: index,
    viewerReady,
    sendToViewer,
    sections,
    catalog,
    base: state,
  });

  // Cada página: queda vista, se anuncia y, si se puede, confeti del color
  // de la pieza. La primera, además, con el háptico de celebración (el de
  // pasar de página lo pone el propio `PanueloTutorial`).
  const current = ids?.[index];
  const presented = useRef<string | null>(null);
  useEffect(() => {
    // Solo al cambiar de página: ni el catálogo ni lo visto la repiten.
    if (!current || !ids || presented.current === current) return;
    presented.current = current;
    const item = catalog[current];
    markSeen(current);
    if (!item) return;
    if (index === 0) h.formSuccess();
    AccessibilityInfo.announceForAccessibility(
      `Pieza nueva, ${index + 1} de ${ids.length}: ${item.name}. ${newPieceReason(item)}`,
    );
  }, [current, ids, index, catalog, markSeen]);
  // Confeti del color de la pieza, una vez por página (sin él con «reducir
  // movimiento»).
  const burstItem =
    current && !reducedMotion && burstDone !== current
      ? catalog[current]
      : undefined;
  const burst = burstItem ? (pieceAccent(burstItem.look) ?? null) : null;
  const clearBurst = useCallback(
    () => setBurstDone(current ?? null),
    [current],
  );

  const close = useCallback(() => {
    setIds(null);
    setDone(true);
  }, []);
  const place = useCallback(() => {
    const first = ids?.find((id) => state.items[id] && !state.layout[id]);
    close();
    if (first) onPlace(first);
    AccessibilityInfo.announceForAccessibility(
      'Modo decorar. Tus piezas nuevas están en «Sin poner».',
    );
  }, [ids, state, close, onPlace]);

  // Lo retirado se avisa una vez, sin sonido ni háptica, con la pantalla
  // libre (después del tutorial y del desvelado).
  const { revokedNotice, dismissRevokedNotice } = panuelo;
  useEffect(() => {
    if (!revokedNotice || !free || open || waiting) return;
    toast.show({ label: revokedNotice });
    AccessibilityInfo.announceForAccessibility(revokedNotice);
    dismissRevokedNotice();
  }, [revokedNotice, free, open, waiting, toast, dismissRevokedNotice]);

  const count = sections.length;
  return {
    open,
    /** Espera o dura: nada más se presenta. */
    busy: open || waiting,
    /** El estado del visor mientras dura (el pañuelo con la pieza). */
    viewerState: stage.state,
    /** Confeti del color de la pieza que se presenta, o `null`. */
    burst,
    clearBurst,
    header: {
      title: count === 1 ? 'Pieza nueva' : 'Piezas nuevas',
      closeLabel: 'Cerrar',
      onClose: close,
      onBack: index > 0 ? () => setIndex((i) => i - 1) : undefined,
    },
    panel: {
      sections,
      catalog,
      index,
      onIndex: setIndex,
      onFinish: place,
      nextLabel: 'Siguiente',
      finishLabel: count === 1 ? 'Colocarla' : 'Colocarlas',
      secondaryLabel: 'Ahora no',
      onSecondary: close,
      pageLabel: (i: number, n: number) => `Pieza ${i + 1} de ${n}`,
    },
  };
}

type IntroArgs = Omit<Args, 'onPlace'> & {
  tutorial: ReturnType<typeof usePanueloTutorial>;
  /** El paso del tutorial (lo guarda la pantalla: el «?» lo vuelve a 0). */
  step: number;
  setStep: (update: (step: number) => number) => void;
  /** Lo que hace «Colocarlas» en la pantalla. */
  setMode: (mode: 'view' | 'edit') => void;
  setFilter: (filter: CollectionFilter) => void;
  setActiveId: (id: string | null) => void;
};

/**
 * El tutorial y el desvelado, juntos: primero el tutorial (si toca); al
 * cerrarse, el desvelado (si hay piezas nuevas). Lo que la pantalla necesita
 * para pintar cualquiera de los dos.
 */
export function usePanueloIntro({
  tutorial,
  step,
  setStep,
  setMode,
  setFilter,
  setActiveId,
  free,
  ...args
}: IntroArgs) {
  const tutorialStage = usePanueloTutorialStage({
    open: tutorial.open,
    step,
    viewerReady: args.viewerReady,
    sendToViewer: args.sendToViewer,
  });
  const onPlace = useCallback(
    (id: string) => {
      setMode('edit');
      setFilter('boxed');
      setActiveId(id);
    },
    [setMode, setFilter, setActiveId],
  );
  const news = usePanueloNewPieces({
    ...args,
    free: free && !tutorial.busy,
    onPlace,
  });
  const tutorialHeader = {
    onClose: tutorial.finish,
    onBack: step > 0 ? () => setStep((i) => i - 1) : undefined,
  };
  const tutorialPanel = {
    index: step,
    onIndex: (i: number) => setStep(() => i),
    onFinish: tutorial.finish,
  };
  return {
    /** A pantalla completa: el tutorial o el desvelado. */
    open: tutorial.open || news.open,
    /** Mientras se resuelven, nada más se presenta (canje, etapa…). */
    busy: tutorial.busy || news.busy,
    /** El paso del tutorial, para la etiqueta del visor (no el desvelado). */
    example: tutorialStage.example,
    /** Lo que pinta el visor mientras dura; `undefined` si no. */
    state: tutorialStage.state ?? news.viewerState,
    mode: tutorialStage.mode,
    header: news.open ? news.header : tutorialHeader,
    panel: news.open ? news.panel : tutorialPanel,
    burst: news.burst,
    clearBurst: news.clearBurst,
  };
}
