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
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Medalla3DModal } from '@/components/medallas/Medalla3DModal';
import type { LabMedal } from '@/components/medallas/labMedals';
import {
  Panuelo3D,
  type Panuelo3DHandle,
} from '@/components/panuelo/Panuelo3D';
import { PanueloCollectionStrip } from '@/components/panuelo/PanueloCollectionStrip';
import {
  PanueloItemDetail,
  type PanueloDetailAction,
} from '@/components/panuelo/PanueloItemDetail';
import { PanueloRedeemSheet } from '@/components/panuelo/PanueloRedeemSheet';
import { MaterialIcons } from '@/components/ui/icons';
import { durations } from '@/constants/animations';
import { PanueloColors, themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii, shadows } from '@/constants/uiStyles';
import { useAuth } from '@/contexts/AuthContext';
import { usePreviewChannel } from '@/contexts/PreviewChannelContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { usePanuelo } from '@/hooks/usePanuelo';
import { usePanueloAvailable } from '@/hooks/usePanueloAvailable';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import {
  PANUELO_COLORS,
  type PanueloColor,
  type PanueloCommand,
  type PanueloEvent,
} from '@/types/panuelo';
import { trackEvent } from '@/utils/analytics';
import { h } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { sharePanueloSnapshot } from '@/utils/panueloShare';
import {
  COLOR_LABEL,
  DEFAULT_PANUELO_COLOR,
  buildCollection,
  summarizePanuelo,
  toViewerState,
  type PanueloCollectionEntry,
} from '@/utils/panuelo';

/** Lo que tarda la vuelta de entrada del pañuelo: antes no se presenta nada. */
const INTRO_MS = 1700;
/** Grados que gira una pieza con cada toque del botón. */
const ROTATE_STEP = 15;
/** Ancho de la columna de la colección en pantalla ancha. */
const SIDE_PANEL_WIDTH = 400;

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
  const { user } = useAuth();
  const params = useLocalSearchParams<{ codigo?: string; demo?: string }>();
  const { enabled: testerMode } = usePreviewChannel();
  const panuelo = usePanuelo();
  const { catalog, state, unseen, markSeen } = panuelo;

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

  const viewerState = useMemo(
    () => toViewerState(catalog, state),
    [catalog, state],
  );
  const collection = useMemo(
    () => buildCollection(catalog, state),
    [catalog, state],
  );
  const summary = useMemo(
    () => summarizePanuelo(catalog, state),
    [catalog, state],
  );
  const active = collection.find((e) => e.item.id === activeId) ?? null;
  const color = state.color ?? DEFAULT_PANUELO_COLOR;

  useEffect(() => {
    trackEvent('panuelo_abierto');
  }, []);

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

  const onViewerEvent = useCallback(
    (event: PanueloEvent) => {
      switch (event.type) {
        case 'ready':
          setViewerReady(true);
          break;
        case 'focus':
          setActiveId(event.id);
          break;
        case 'blur':
          settle();
          break;
        case 'select':
          setActiveId(event.id);
          break;
        case 'pickup':
          h.select();
          break;
        case 'drop':
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
    [panuelo, settle],
  );

  // Presentación de las piezas recién conseguidas, de una en una: cada una
  // espera a que se cierre la anterior.
  const nextUnseen = unseen.find((id) => state.layout[id]) ?? null;
  useEffect(() => {
    if (!introDone || mode !== 'view' || redeemOpen) return;
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
    setMode((m) => (m === 'view' ? 'edit' : 'view'));
  }, [settle]);

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
  }, [active, mode, placeActive, rotateActive, unplaceActive]);

  const sharePhoto = useCallback(() => {
    h.tap();
    // Si hay una pieza en primer plano, vuelve al pañuelo: la foto es de él.
    if (activeId) closeDetail();
    setTimeout(
      () => sendToViewer({ type: 'snapshot', background: t.backgroundSunken }),
      activeId ? durations.slow * 2 : 0,
    );
  }, [activeId, closeDetail, sendToViewer, t.backgroundSunken]);

  const changeColor = useCallback(
    (next: PanueloColor) => {
      if (next === color) return;
      h.select();
      panuelo.setColor(next);
    },
    [color, panuelo],
  );

  if (!panuelo.ready) return null;

  const hint =
    mode === 'edit'
      ? 'Arrastra una pieza para moverla. Toca una de tu colección para ponerla.'
      : summary.placed === 0
        ? 'Arrastra para girarlo. Las piezas que consigas irán aquí.'
        : 'Arrastra para girarlo. Toca una pieza para verla de cerca.';

  return (
    <View
      style={[
        styles.root,
        isWide && styles.rootWide,
        { backgroundColor: t.backgroundSunken },
      ]}
    >
      <View style={styles.stage}>
        <Panuelo3D
          ref={viewerRef}
          state={viewerState}
          mode={mode}
          onEvent={onViewerEvent}
          tintColor={t.textSecondary}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.stageTop} pointerEvents="box-none">
          <View
            style={[styles.swatches, { backgroundColor: t.card }]}
            accessibilityRole="radiogroup"
            accessibilityLabel="Color del pañuelo"
          >
            {PANUELO_COLORS.map((c) => (
              <PressableFeedback
                key={c}
                onPress={() => changeColor(c)}
                accessibilityRole="radio"
                accessibilityState={{ selected: c === color }}
                accessibilityLabel={`Pañuelo ${COLOR_LABEL[c].name.toLowerCase()}: ${COLOR_LABEL[c].stage}`}
                style={styles.swatchTarget}
              >
                <View
                  style={[
                    styles.swatch,
                    { backgroundColor: PanueloColors.cloth[c] },
                    c === color && [
                      styles.swatchSelected,
                      { borderColor: t.text },
                    ],
                  ]}
                />
              </PressableFeedback>
            ))}
          </View>

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
            <PressableFeedback
              onPress={toggleMode}
              accessibilityRole="button"
              accessibilityLabel={
                mode === 'edit' ? 'Terminar de decorar' : 'Decorar el pañuelo'
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
        </View>

        <Text
          style={[styles.stageLabel, { color: t.textSecondary }]}
          pointerEvents="none"
        >
          {COLOR_LABEL[color].name} · {COLOR_LABEL[color].stage}
        </Text>

        {active ? null : (
          <Text
            style={[styles.hint, { color: t.textSecondary }]}
            pointerEvents="none"
          >
            {hint}
          </Text>
        )}
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
        {active ? (
          <PanueloItemDetail
            entry={active}
            isDark={isDark}
            isNew={revealing === active.item.id}
            actions={actions}
            onClose={closeDetail}
          />
        ) : (
          <>
            <View style={styles.panelHead}>
              <View style={styles.panelTitles}>
                <Text
                  style={[styles.panelTitle, { color: t.text }]}
                  accessibilityRole="header"
                >
                  Tu colección
                </Text>
                <Text style={[styles.panelMeta, { color: t.textSecondary }]}>
                  {summary.owned} de {summary.total} · {summary.placed} en el
                  pañuelo
                </Text>
              </View>
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
                <Text style={[styles.modeLabel, { color: t.link }]}>
                  Canjear
                </Text>
              </PressableFeedback>
            </View>
            <PanueloCollectionStrip
              entries={collection}
              activeId={activeId}
              isDark={isDark}
              onSelect={selectFromStrip}
            />
            {!user ? (
              <Text style={[styles.notice, { color: t.textSecondary }]}>
                Sin sesión iniciada, tu pañuelo solo se guarda en este móvil.
              </Text>
            ) : null}
          </>
        )}
      </View>

      <PanueloRedeemSheet
        visible={redeemOpen}
        isDark={isDark}
        initialCode={linkedCode}
        onClose={() => setRedeemOpen(false)}
        onRedeem={panuelo.redeem}
      />
      <Medalla3DModal medal={medal} onClose={() => setMedal(null)} />
    </View>
  );
}

const TOUCH = 44;
const SWATCH = 24;

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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  swatches: {
    flexDirection: 'row',
    borderRadius: radii.pillFull,
    paddingHorizontal: spacing.xs,
    ...shadows.card,
  },
  swatchTarget: {
    width: TOUCH - spacing.sm,
    height: TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: radii.pillFull,
  },
  swatchSelected: {
    borderWidth: 3,
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
    height: TOUCH,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pillFull,
    overflow: 'hidden',
    ...shadows.card,
  },
  modeLabel: {
    ...typography.button,
  },
  hint: {
    ...typography.caption,
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.sm,
    textAlign: 'center',
  },
  panel: {
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  panelBottom: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    ...shadows.raised,
  },
  panelWide: {
    width: SIDE_PANEL_WIDTH,
    justifyContent: 'center',
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  panelTitles: {
    flex: 1,
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
    height: TOUCH,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  notice: {
    ...typography.caption,
    paddingHorizontal: spacing.md,
  },
});
