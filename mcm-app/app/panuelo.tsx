// El pañuelo virtual: tu pañuelo en 3D, con las chapas, pines, cintas, parches
// y medallas que has ido juntando.
//
// **Hoy solo se llega desde el Laboratorio Alpha** (`global.panuelo` en
// `alpha`, ver `utils/panueloGate.ts`). Quien entra por un enlace sin tenerlo
// disponible vuelve a Inicio.
//
// Documentación: `docs/funcionalidades/PANUELO.md`.

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight, useNavigation } from 'expo-router/react-navigation';

import { Medalla3DModal } from '@/components/medallas/Medalla3DModal';
import type { LabMedal } from '@/components/medallas/labMedals';
import {
  Panuelo3D,
  type Panuelo3DHandle,
} from '@/components/panuelo/Panuelo3D';
import { PanueloCollectionFilter } from '@/components/panuelo/PanueloCollectionFilter';
import { PanueloHistorySheet } from '@/components/panuelo/PanueloHistorySheet';
import {
  PanueloItemDetail,
  moveScreenReaderFocus,
  type PanueloDetailAction,
} from '@/components/panuelo/PanueloItemDetail';
import {
  PanueloMemoryBar,
  PanueloMemoryPanel,
  memoryName,
} from '@/components/panuelo/PanueloMemoryView';
import { PanueloRedeemSheet } from '@/components/panuelo/PanueloRedeemSheet';
import {
  PanueloColorSwatches,
  PanueloStagePill,
} from '@/components/panuelo/PanueloColorSwatches';
import { PanueloStageBurst } from '@/components/panuelo/PanueloStageBurst';
import {
  PanueloTutorial,
  PanueloTutorialHeader,
} from '@/components/panuelo/PanueloTutorial';
import { PanueloStageSheet } from '@/components/panuelo/PanueloStageSheet';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { MaterialIcons } from '@/components/ui/icons';
import { durations } from '@/constants/animations';
import { themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii, shadows } from '@/constants/uiStyles';
import { usePreviewChannel } from '@/contexts/PreviewChannelContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import useLargeText from '@/hooks/useLargeText';
import { usePanuelo } from '@/hooks/usePanuelo';
import { usePanueloAvailable } from '@/hooks/usePanueloAvailable';
import { usePanueloScarf } from '@/hooks/usePanueloScarf';
import { usePanueloStage } from '@/hooks/usePanueloStage';
import { usePanueloTutorial } from '@/hooks/usePanueloTutorial';
import { usePanueloTutorialStage } from '@/hooks/usePanueloTutorialStage';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import {
  type PanueloCommand,
  type PanueloEvent,
  type PanueloMemory,
} from '@/types/panuelo';
import { trackEvent } from '@/utils/analytics';
import { confirmAsync } from '@/utils/confirmDialog';
import { h } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { clampToFlap } from '@/utils/panueloPlacement';
import { sharePanueloSnapshot } from '@/utils/panueloShare';
import {
  COLOR_LABEL,
  DEFAULT_PANUELO_COLOR,
  buildCollection,
  buildMemoryCollection,
  memoryToViewerState,
  summarizePanuelo,
  toViewerState,
  type CollectionFilter,
  type PanueloCollectionEntry,
} from '@/utils/panuelo';

/** Lo que tarda la vuelta de entrada del pañuelo: antes no se presenta nada. */
const INTRO_MS = 1700;
/** Grados que gira una pieza con cada toque del botón. */
const ROTATE_STEP = 15;
/** Ancho de la columna de la colección en pantalla ancha. */
const SIDE_PANEL_WIDTH = 400;
/** Con letra grande, lo más que ocupa el panel de abajo (el resto es del 3D). */
const PANEL_MAX_SHARE = 0.55;
/** Lo que lee el lector del «?» de la cabecera. */
const HELP_LABEL = 'Cómo funciona tu pañuelo';

export default function PanueloRoute() {
  const { available, settled } = usePanueloAvailable();
  if (!settled) return null;
  if (!available) return <Redirect href="/" />;
  return <PanueloScreen />;
}

function PanueloScreen() {
  const isDark = useColorScheme() === 'dark';
  const t = themeColors(isDark);
  const insets = useSafeAreaInsets();
  const { isWide } = useResponsiveLayout();
  // En iOS la cabecera puede ser translúcida y la pantalla empieza DEBAJO de
  // ella (y del notch): los botones de arriba quedaban tapados. Se mide dónde
  // empieza de verdad la pantalla y se baja solo lo que la cabecera tape; con
  // una cabecera opaca (Android, web) no se añade nada.
  const headerHeight = useHeaderHeight();
  const rootRef = useRef<React.ComponentRef<typeof View>>(null);
  const [underHeader, setUnderHeader] = useState(0);
  const measureTop = useCallback(() => {
    rootRef.current?.measureInWindow((_x, y) => {
      if (!Number.isFinite(y)) return;
      setUnderHeader(Math.max(0, Math.round(headerHeight - y)));
    });
  }, [headerHeight]);
  const large = useLargeText();
  const { height: windowHeight } = useWindowDimensions();
  const params = useLocalSearchParams<{ codigo?: string; demo?: string }>();
  const { enabled: testerMode } = usePreviewChannel();
  const panuelo = usePanuelo();
  const { catalog, state, unseen, markSeen, history } = panuelo;
  const tutorial = usePanueloTutorial();
  const scarf = usePanueloScarf();
  const [tutorialStep, setTutorialStep] = useState(0);

  const viewerRef = useRef<Panuelo3DHandle>(null);
  const sendToViewer = useCallback((command: PanueloCommand) => {
    viewerRef.current?.send(command);
  }, []);
  const [viewerReady, setViewerReady] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  /** La pieza cuya ficha está abierta (enfocada, seleccionada o en la caja). */
  const [activeId, setActiveId] = useState<string | null>(null);
  /** La pieza que se está presentando por primera vez. */
  const [revealing, setRevealing] = useState<string | null>(null);
  // Un enlace `/panuelo?codigo=…` abre la hoja con el código ya escrito.
  const linkedCode = typeof params.codigo === 'string' ? params.codigo : '';
  const [redeemOpen, setRedeemOpen] = useState(linkedCode !== '');
  const [medal, setMedal] = useState<LabMedal | null>(null);
  /** El filtro del cajón: se recuerda mientras la pantalla está abierta. */
  const [filter, setFilter] = useState<CollectionFilter>('all');
  const [historyOpen, setHistoryOpen] = useState(false);
  /** El pañuelo anterior que se está viendo (`at`), solo para mirar. */
  const [viewingAt, setViewingAt] = useState<number | null>(null);
  const memory: PanueloMemory | null =
    history.find((m) => m.at === viewingAt) ?? null;

  // El tutorial usa ESTE visor con otro estado y sus propias órdenes.
  const tutorialStage = usePanueloTutorialStage({
    open: tutorial.open,
    step: tutorialStep,
    viewerReady,
    sendToViewer,
  });
  const tutorialExample = tutorialStage.example;
  const tutorialState = tutorialStage.state;
  const viewerState = useMemo(
    () =>
      tutorialState ??
      (memory
        ? memoryToViewerState(catalog, memory)
        : toViewerState(catalog, state)),
    [catalog, state, memory, tutorialState],
  );
  const memoryCollection = useMemo(
    () => (memory ? buildMemoryCollection(catalog, state, memory) : []),
    [catalog, state, memory],
  );
  const collection = useMemo(
    () => buildCollection(catalog, state),
    [catalog, state],
  );
  const summary = useMemo(
    () => summarizePanuelo(catalog, state),
    [catalog, state],
  );
  const active =
    (memory ? memoryCollection : collection).find(
      (e) => e.item.id === activeId,
    ) ?? null;
  const color = state.color ?? DEFAULT_PANUELO_COLOR;
  /** El color que se ve ahora: el del recuerdo, si se está viendo uno. */
  const shownColor = memory?.color ?? color;

  useEffect(() => {
    trackEvent('panuelo_abierto');
  }, []);

  // Al cerrarse la ficha desaparece el elemento que tenía el foco del lector
  // de pantalla: se lleva al título de la colección.
  const collectionTitleRef = useRef<React.ComponentRef<typeof Text>>(null);
  const hadActive = useRef(false);
  const hasActive = active !== null;
  useEffect(() => {
    if (hadActive.current && !hasActive) {
      moveScreenReaderFocus(collectionTitleRef.current);
    }
    hadActive.current = hasActive;
  }, [hasActive]);

  // Los mandos del Laboratorio Alpha llegan por la ruta (`?demo=todas|cero`):
  // así el estado del pañuelo tiene un solo dueño, esta pantalla.
  const demo = typeof params.demo === 'string' ? params.demo : '';
  const demoDone = useRef(false);
  const { ready, grantDemo, reset } = panuelo;
  useEffect(() => {
    if (!ready || !testerMode || demoDone.current || !demo) return;
    demoDone.current = true;
    if (demo === 'todas') grantDemo(Object.keys(catalog));
    else if (demo === 'cero') reset();
  }, [ready, testerMode, demo, catalog, grantDemo, reset]);

  useEffect(() => {
    if (!viewerReady) return;
    const timer = setTimeout(() => setIntroDone(true), INTRO_MS);
    return () => clearTimeout(timer);
  }, [viewerReady]);

  /** La pieza ha vuelto al pañuelo (o se ha cerrado su ficha). */
  const settle = useCallback(() => {
    setActiveId(null);
    setRevealing((current) => {
      if (current) markSeen(current);
      return null;
    });
  }, [markSeen]);

  const stage = usePanueloStage({
    panuelo,
    scarf,
    mode,
    busy: tutorial.busy || redeemOpen || viewingAt !== null,
    sendToViewer,
    settle,
  });

  const onViewerEvent = useCallback(
    (event: PanueloEvent) => {
      switch (event.type) {
        case 'ready':
          setViewerReady(true);
          break;
        case 'focus':
          if (!tutorial.open) setActiveId(event.id);
          break;
        case 'blur':
          settle();
          break;
        case 'select':
          if (!tutorial.open) setActiveId(event.id);
          break;
        case 'pickup':
          h.select();
          break;
        case 'drop':
          if (tutorial.open) break;
          h.tap();
          panuelo.move(event.id, event.u, event.v);
          break;
        case 'haptic':
          if (event.kind === 'select') h.select();
          else h.tap();
          break;
        case 'snapshot':
          sharePanueloSnapshot(event.dataUrl).catch((err) =>
            logger.warn('[Pañuelo] no se pudo compartir la foto:', err),
          );
          break;
      }
    },
    [panuelo, settle, tutorial.open],
  );

  // Presentación de las piezas recién conseguidas, de una en una: cada una
  // espera a que se cierre la anterior.
  const nextUnseen = unseen.find((id) => state.layout[id]) ?? null;
  useEffect(() => {
    if (
      !introDone ||
      mode !== 'view' ||
      redeemOpen ||
      viewingAt !== null ||
      tutorial.busy
    ) {
      return;
    }
    if (revealing || activeId || !nextUnseen) return;
    const timer = setTimeout(() => {
      setRevealing(nextUnseen);
      setActiveId(nextUnseen);
      sendToViewer({ type: 'reveal', id: nextUnseen });
      h.success();
    }, durations.slow);
    return () => clearTimeout(timer);
  }, [
    introDone,
    mode,
    redeemOpen,
    viewingAt,
    tutorial.busy,
    revealing,
    activeId,
    nextUnseen,
    sendToViewer,
  ]);

  const closeDetail = useCallback(() => {
    sendToViewer(
      mode === 'edit' ? { type: 'select', id: null } : { type: 'blur' },
    );
    settle();
  }, [mode, sendToViewer, settle]);

  const toggleMode = useCallback(() => {
    h.toggle();
    settle();
    AccessibilityInfo.announceForAccessibility(
      mode === 'view'
        ? 'Modo decorar. Elige una pieza de la colección para ponerla, quitarla o moverla.'
        : 'Has terminado de decorar.',
    );
    setMode((m) => (m === 'view' ? 'edit' : 'view'));
  }, [mode, settle]);

  const selectFromStrip = useCallback(
    (entry: PanueloCollectionEntry) => {
      const id = entry.item.id;
      h.tap();
      if (id === activeId) {
        closeDetail();
        return;
      }
      if (revealing) markSeen(revealing);
      setRevealing(null);
      if (!entry.owned || !entry.placed) {
        // No está en el pañuelo: solo la ficha.
        sendToViewer(
          mode === 'edit' ? { type: 'select', id: null } : { type: 'blur' },
        );
        setActiveId(id);
        return;
      }
      sendToViewer(
        mode === 'edit' ? { type: 'select', id } : { type: 'focus', id },
      );
      setActiveId(id);
    },
    [activeId, closeDetail, markSeen, mode, revealing, sendToViewer],
  );

  const placeActive = useCallback(
    (id: string) => {
      h.add();
      markSeen(id);
      panuelo.place(id);
      setActiveId(null);
    },
    [markSeen, panuelo],
  );
  const unplaceActive = useCallback(
    (id: string) => {
      h.remove();
      sendToViewer(
        mode === 'edit' ? { type: 'select', id: null } : { type: 'blur' },
      );
      settle();
      panuelo.unplace(id);
    },
    [mode, panuelo, sendToViewer, settle],
  );
  const rotateActive = useCallback(
    (id: string, degrees: number) => {
      h.select();
      panuelo.rotate(id, degrees);
    },
    [panuelo],
  );

  const { layout } = state;
  const moveActive = useCallback(
    (id: string, du: number, dv: number) => {
      const current = layout[id];
      if (!current) return;
      const [u, v] = clampToFlap(current.u + du, current.v + dv);
      if (u === current.u && v === current.v) {
        AccessibilityInfo.announceForAccessibility(
          'No se puede mover más en esa dirección.',
        );
        return;
      }
      h.tap();
      panuelo.move(id, u, v);
      AccessibilityInfo.announceForAccessibility('Pieza movida.');
    },
    [layout, panuelo],
  );

  const actions = useMemo<PanueloDetailAction[]>(() => {
    if (!active?.owned) return [];
    const { id, name, origin, look } = active.item;
    if (!active.placed) {
      return [
        {
          key: 'place',
          label: 'Ponérmela',
          icon: 'push-pin',
          onPress: () => placeActive(id),
        },
      ];
    }
    const glbUrl = look.kind === 'medalla' ? look.glb : undefined;
    const rotate: PanueloDetailAction[] =
      mode === 'edit'
        ? [
            {
              key: 'rotate-left',
              label: 'Girar',
              accessibilityLabel: 'Girar a la izquierda',
              icon: 'rotate-left',
              onPress: () => rotateActive(id, -ROTATE_STEP),
            },
            {
              key: 'rotate-right',
              label: 'Girar',
              accessibilityLabel: 'Girar a la derecha',
              icon: 'rotate-right',
              onPress: () => rotateActive(id, ROTATE_STEP),
            },
          ]
        : [];
    const closeup: PanueloDetailAction[] =
      mode === 'view' && glbUrl
        ? [
            {
              key: 'closeup',
              label: 'Verla de cerca',
              icon: '3d-rotation',
              onPress: () =>
                setMedal({
                  id,
                  name,
                  subtitle: origin ?? '',
                  glbUrl,
                  thumbnail: 0,
                }),
            },
          ]
        : [];
    // Un pañuelo anterior es solo para verlo: ni quitar ni girar.
    if (memory) return closeup;
    return [
      ...rotate,
      ...closeup,
      {
        key: 'unplace',
        label: 'Quitar',
        accessibilityLabel: 'Quitar del pañuelo',
        icon: 'inventory-2',
        onPress: () => unplaceActive(id),
      },
    ];
  }, [active, mode, memory, placeActive, rotateActive, unplaceActive]);

  const sharePhoto = useCallback(() => {
    h.tap();
    // Si hay una pieza en primer plano, vuelve al pañuelo: la foto es de él.
    if (activeId) closeDetail();
    setTimeout(
      () => sendToViewer({ type: 'snapshot', background: t.backgroundSunken }),
      activeId ? durations.slow * 2 : 0,
    );
  }, [activeId, closeDetail, sendToViewer, t.backgroundSunken]);

  const { show: openTutorial } = tutorial;
  const showTutorial = useCallback(() => {
    h.tap();
    setMode('view');
    setViewingAt(null);
    sendToViewer({ type: 'blur' });
    settle();
    setTutorialStep(0);
    openTutorial();
  }, [sendToViewer, settle, openTutorial]);

  // Cabecera nativa: el «?» a la derecha (en iOS lo pone `Stack.Toolbar`, más
  // abajo; en Android y web, una vista normal) y, mientras dura el tutorial a
  // pantalla completa, fuera: el tutorial lleva su propia cabecera con la X.
  const navigation = useNavigation();
  const linkTint = t.link;
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: !tutorial.open,
      ...(Platform.OS === 'ios'
        ? {}
        : {
            headerRight: () => (
              <PressableFeedback
                onPress={showTutorial}
                hitSlop={10}
                style={styles.headerButton}
                accessibilityRole="button"
                accessibilityLabel={HELP_LABEL}
              >
                <IconSymbol
                  name="questionmark.circle"
                  size={22}
                  color={linkTint}
                />
              </PressableFeedback>
            ),
          }),
    });
  }, [navigation, tutorial.open, showTutorial, linkTint]);

  // «Recolocar» deshace la colocación a mano: se pregunta antes.
  const arrange = useCallback(async () => {
    const ok = await confirmAsync({
      title: '¿Recolocar las piezas?',
      message:
        'Se repartirán solas por el pañuelo y se perderá cómo las habías colocado.',
      confirmLabel: 'Recolocar',
    });
    if (!ok) return;
    h.add();
    sendToViewer({ type: 'select', id: null });
    settle();
    panuelo.arrange();
    AccessibilityInfo.announceForAccessibility('Piezas recolocadas.');
  }, [panuelo, sendToViewer, settle]);

  const openMemory = useCallback(
    (picked: PanueloMemory) => {
      h.tap();
      setHistoryOpen(false);
      setMode('view');
      sendToViewer({ type: 'blur' });
      settle();
      setViewingAt(picked.at);
      AccessibilityInfo.announceForAccessibility(
        `Viendo tu ${memoryName(picked)}. Solo para verlo: se puede girar y tocar sus piezas.`,
      );
    },
    [sendToViewer, settle],
  );
  const leaveMemory = useCallback(() => {
    h.tap();
    sendToViewer({ type: 'blur' });
    settle();
    setViewingAt(null);
    AccessibilityInfo.announceForAccessibility('Has vuelto a tu pañuelo.');
  }, [sendToViewer, settle]);

  if (!panuelo.ready) return null;

  const shown = memory ? memoryCollection.length : summary.placed;
  const placedCount =
    shown === 0
      ? 'No lleva ninguna pieza.'
      : `${memory ? 'Llevaba' : 'Lleva'} ${shown} ${shown === 1 ? 'pieza' : 'piezas'}.`;
  const viewerLabel = tutorialExample
    ? `Pañuelo de ejemplo del tutorial, ${COLOR_LABEL[tutorialStage.state?.color ?? tutorialExample.color].name.toLowerCase()}.`
    : memory
      ? `Tu ${memoryName(memory)}, ${COLOR_LABEL[shownColor].stage}. Recuerdo, solo para verlo. ${placedCount}`
      : `Pañuelo ${COLOR_LABEL[color].name.toLowerCase()}, ${COLOR_LABEL[color].stage}. ${placedCount}`;
  const viewerHint =
    'Se gira arrastrando con el dedo. Para ver, poner, quitar o mover una pieza, usa la colección que hay debajo.';

  const detail = active ? (
    <PanueloItemDetail
      entry={active}
      isDark={isDark}
      isNew={revealing === active.item.id}
      actions={actions}
      note={
        memory
          ? `Lo llevabas en tu pañuelo ${COLOR_LABEL[memory.color].name.toLowerCase()}.`
          : undefined
      }
      onMove={
        mode === 'edit' && active?.owned && active.placed
          ? moveActive
          : undefined
      }
      onClose={closeDetail}
    />
  ) : null;
  const collectionView = memory ? (
    <PanueloMemoryPanel
      isDark={isDark}
      memory={memory}
      entries={memoryCollection}
      activeId={activeId}
      grid={isWide}
      titleRef={collectionTitleRef}
      onSelect={selectFromStrip}
    />
  ) : (
    <>
      <View style={[styles.panelHead, large && styles.panelHeadLarge]}>
        <View style={styles.panelTitles}>
          <Text
            ref={collectionTitleRef}
            style={[styles.panelTitle, { color: t.text }]}
            accessibilityRole="header"
          >
            Tu colección
          </Text>
          <Text style={[styles.panelMeta, { color: t.textSecondary }]}>
            {summary.owned} de {summary.total} · {summary.placed} en el pañuelo
          </Text>
        </View>
        {history.length > 0 ? (
          <PressableFeedback
            onPress={() => {
              h.tap();
              setHistoryOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Mis pañuelos"
            accessibilityHint="Los pañuelos que dejaste al cambiar de etapa"
            style={[
              styles.historyButton,
              { backgroundColor: t.backgroundSunken },
            ]}
          >
            <PressableFeedback.Highlight />
            <MaterialIcons name="history" size={20} color={t.link} />
          </PressableFeedback>
        ) : null}
        <PressableFeedback
          onPress={() => {
            h.tap();
            setRedeemOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Canjear un código"
          style={[styles.redeem, { backgroundColor: t.backgroundSunken }]}
        >
          <PressableFeedback.Highlight />
          <MaterialIcons name="redeem" size={18} color={t.link} />
          <Text style={[styles.modeLabel, { color: t.link }]}>Canjear</Text>
        </PressableFeedback>
      </View>
      <PanueloCollectionFilter
        entries={collection}
        filter={filter}
        onFilterChange={setFilter}
        activeId={activeId}
        isDark={isDark}
        onSelect={selectFromStrip}
        grid={isWide}
      />
    </>
  );
  const panelScroll = (children: React.ReactNode) => (
    <ScrollView
      style={
        isWide
          ? styles.panelScroll
          : { maxHeight: windowHeight * PANEL_MAX_SHARE }
      }
      contentContainerStyle={styles.panelScrollContent}
    >
      {children}
    </ScrollView>
  );
  const tutorialView = (
    <PanueloTutorial
      isDark={isDark}
      index={tutorialStep}
      onIndex={setTutorialStep}
      onFinish={tutorial.finish}
    />
  );
  // El tutorial cabe en una columna con scroll: el visor se queda con el resto.
  const panelBody = tutorial.open
    ? panelScroll(tutorialView)
    : active
      ? large || isWide
        ? panelScroll(detail)
        : detail
      : large && !isWide
        ? panelScroll(collectionView)
        : collectionView;

  const topLeft = tutorial.open ? null : memory ? (
    <PanueloMemoryBar isDark={isDark} memory={memory} onBack={leaveMemory} />
  ) : stage.locked ? (
    <PanueloStagePill
      isDark={isDark}
      color={color}
      pending={stage.pending}
      onPending={stage.reopen}
    />
  ) : (
    <PanueloColorSwatches isDark={isDark} color={color} onPick={stage.pick} />
  );
  const topRight =
    tutorial.open || memory ? null : (
      <View style={styles.stageActions}>
        {mode === 'view' && viewerReady ? (
          <PressableFeedback
            onPress={sharePhoto}
            accessibilityRole="button"
            accessibilityLabel="Compartir una foto de mi pañuelo"
            style={[styles.iconButton, { backgroundColor: t.card }]}
          >
            <PressableFeedback.Highlight />
            <MaterialIcons name="ios-share" size={20} color={t.link} />
          </PressableFeedback>
        ) : null}
        {mode === 'edit' && stage.layoutCount > 0 ? (
          <PressableFeedback
            onPress={arrange}
            accessibilityRole="button"
            accessibilityLabel="Recolocar las piezas"
            accessibilityHint="Las reparte solas por el pañuelo sin que se pisen"
            style={[styles.modeButton, { backgroundColor: t.card }]}
          >
            <PressableFeedback.Highlight />
            <MaterialIcons name="auto-fix-high" size={18} color={t.link} />
            <Text style={[styles.modeLabel, { color: t.link }]}>Recolocar</Text>
          </PressableFeedback>
        ) : null}
        <PressableFeedback
          onPress={toggleMode}
          accessibilityRole="button"
          accessibilityLabel={
            mode === 'edit'
              ? 'Listo, terminar de decorar'
              : 'Decorar el pañuelo'
          }
          style={[styles.modeButton, { backgroundColor: t.card }]}
        >
          <PressableFeedback.Highlight />
          <MaterialIcons
            name={mode === 'edit' ? 'check' : 'edit'}
            size={18}
            color={t.link}
          />
          <Text style={[styles.modeLabel, { color: t.link }]}>
            {mode === 'edit' ? 'Listo' : 'Decorar'}
          </Text>
        </PressableFeedback>
      </View>
    );

  return (
    <View
      ref={rootRef}
      onLayout={measureTop}
      style={[
        styles.root,
        isWide && styles.rootWide,
        {
          backgroundColor: t.backgroundSunken,
          // A pantalla completa no hay cabecera nativa a la que esquivar.
          paddingTop: tutorial.open ? 0 : underHeader,
        },
      ]}
    >
      <View style={styles.stage}>
        <Panuelo3D
          ref={viewerRef}
          state={viewerState}
          mode={tutorial.open ? tutorialStage.mode : memory ? 'view' : mode}
          onEvent={onViewerEvent}
          tintColor={t.textSecondary}
          accessibilityLabel={viewerLabel}
          accessibilityHint={viewerHint}
          style={StyleSheet.absoluteFill}
        />

        {tutorial.open ? (
          <PanueloTutorialHeader isDark={isDark} onClose={tutorial.finish} />
        ) : (
          <View style={styles.stageTop} pointerEvents="box-none">
            {topLeft}
            {topRight}
          </View>
        )}

        {active || tutorial.open || stage.locked ? null : (
          <Text
            style={[styles.stageLabel, { color: t.textSecondary }]}
            pointerEvents="none"
            // Ya lo dice la etiqueta del visor.
            importantForAccessibility="no"
            accessibilityElementsHidden
          >
            {COLOR_LABEL[shownColor].name} · {COLOR_LABEL[shownColor].stage}
          </Text>
        )}

        <PanueloStageBurst color={stage.burst} onDone={stage.clearBurst} />
      </View>

      <View
        style={[
          styles.panel,
          isWide ? styles.panelWide : styles.panelBottom,
          {
            backgroundColor: t.card,
            paddingBottom: insets.bottom + spacing.md,
          },
        ]}
      >
        {panelBody}
      </View>

      <PanueloRedeemSheet
        visible={redeemOpen && !tutorial.busy}
        isDark={isDark}
        initialCode={linkedCode}
        onClose={() => setRedeemOpen(false)}
        onRedeem={panuelo.redeem}
      />
      {stage.target ? (
        <PanueloStageSheet
          visible={stage.open}
          isDark={isDark}
          to={stage.target}
          placedCount={stage.layoutCount}
          detected={stage.detected}
          onClose={stage.close}
          onConfirm={stage.confirm}
        />
      ) : null}
      <PanueloHistorySheet
        visible={historyOpen}
        isDark={isDark}
        catalog={catalog}
        history={history}
        onClose={() => setHistoryOpen(false)}
        onSelect={openMemory}
      />
      <Medalla3DModal medal={medal} onClose={() => setMedal(null)} />
      {Platform.OS === 'ios' && !tutorial.open ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon="questionmark.circle"
            tintColor={t.link}
            accessibilityLabel={HELP_LABEL}
            onPress={showTutorial}
          />
        </Stack.Toolbar>
      ) : null}
    </View>
  );
}

const TOUCH = 44;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  rootWide: {
    flexDirection: 'row',
  },
  stage: {
    flex: 1,
  },
  stageTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    rowGap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  stageActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconButton: {
    width: TOUCH,
    height: TOUCH,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadows.card,
  },
  stageLabel: {
    ...typography.caption,
    paddingHorizontal: spacing.md + spacing.sm,
    paddingTop: spacing.xs,
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: TOUCH,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pillFull,
    overflow: 'hidden',
    ...shadows.card,
  },
  modeLabel: {
    ...typography.button,
  },
  headerButton: {
    minWidth: TOUCH,
    minHeight: TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  panelScroll: {
    flex: 1,
  },
  panelScrollContent: {
    gap: spacing.sm,
  },
  panelBottom: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    ...shadows.raised,
  },
  panelWide: {
    width: SIDE_PANEL_WIDTH,
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  panelHeadLarge: {
    flexWrap: 'wrap',
  },
  panelTitles: {
    flex: 1,
  },
  historyButton: {
    width: TOUCH,
    height: TOUCH,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  panelTitle: {
    ...typography.h3,
  },
  panelMeta: {
    ...typography.caption,
  },
  redeem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: TOUCH,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
});
