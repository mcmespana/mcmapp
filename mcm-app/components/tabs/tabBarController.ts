// Controlador compartido de la barra de pestañas flotante.
//
// Sustituye a `createCompactTabBarController()` de la librería. Se escribió
// propio porque hacían falta tres cosas que aquel no daba:
//
//   1. **Compactar sin retraso.** El de la librería recorta el offset a >= 0,
//      así que en las pantallas con header grande (`contentInsetAdjustmentBehavior
//      = "automatic"`) el offset arranca en `-inset` y se queda pegado a 0
//      durante todo el recorrido del header: la barra tardaba un mundo en
//      compactarse. Aquí se trabaja con el offset REAL.
//   2. **Volver a la raíz al re-tapear el tab.** Con la barra del navegador
//      oculta ya no se dispara el evento `tabPress`, que es el que usaban los
//      tabs con stack (cantoral, más, visitapapa) para hacer `popToTop()`.
//      Ahora la barra emite `reselect` y esos tabs se suscriben.
//   3. **Subir por encima del header.** El scroll-arriba tiene que llegar a
//      `-contentInset.top`, no a 0, o el principio de la lista queda tapado por
//      el header. El inset se aprende de los propios eventos de scroll.
//
// Es un SINGLETON a propósito: la barra vive en el layout de tabs y los
// scrollers que la gobiernan están repartidos por media app.

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type { ScrollView } from 'react-native';
import {
  runOnJS,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';

import { ARM_AT, collapseStep } from '@/components/tabs/collapseRule';

type Scrollable = {
  scrollTo: (opts: { y: number; animated?: boolean }) => void;
};

/** Handler de re-tap. Devuelve `true` si ya ha gestionado el gesto. */
export type ReselectHandler = () => boolean;

let compact = false;
/** Forzada a compacta por la pantalla actual (p.ej. el detalle de canción). */
let forced = false;

const listeners = new Set<() => void>();
const scrollRefs = new Map<string, { current: Scrollable | null }>();
/** `contentInset.top` aprendido de los eventos de scroll, por tab. */
const insetTops = new Map<string, number>();
const reselectHandlers = new Map<string, Set<ReselectHandler>>();
/**
 * Copias de `compact` en shared values, para que los worklets de scroll sepan
 * el estado actual SIN suscribir a re-render a la pantalla entera (que es lo
 * que pasaría con `useCompact()`: cada colapso repintaría la lista completa).
 * Se escriben desde el hilo de JS, que es donde vive el estado de verdad.
 */
const compactMirrors = new Set<{ value: boolean }>();

function notify() {
  listeners.forEach((listener) => listener());
}

function setCompact(next: boolean) {
  if (next === compact) return;
  compact = next;
  compactMirrors.forEach((mirror) => {
    mirror.value = next;
  });
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Estado que pinta la barra: compacta si lo pide el scroll O la pantalla. */
export function useCompact(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => compact || forced,
    () => false,
  );
}

export function expand() {
  setCompact(false);
}

/**
 * Fuerza el estado compacto mientras una pantalla está montada (el detalle de
 * canción, por ejemplo, que quiere toda la altura posible para la letra).
 */
export function useForceCompact(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    forced = true;
    notify();
    return () => {
      forced = false;
      notify();
    };
  }, [enabled]);
}

/**
 * Sube al principio de verdad: hasta `-contentInset.top` si esa pantalla tiene
 * header grande, así el primer elemento no queda debajo de la cabecera.
 */
export function scrollToTop(tabName: string, animated = true): boolean {
  setCompact(false);
  const scroller = scrollRefs.get(tabName)?.current;
  if (!scroller) return false;
  scroller.scrollTo({ y: -(insetTops.get(tabName) ?? 0), animated });
  return true;
}

/**
 * Registra qué hacer cuando se re-tapea un tab que ya está activo. Lo usan los
 * tabs con stack interno para volver a su pantalla raíz.
 *
 * El handler devuelve `true` si ha hecho algo (p.ej. había pantallas que
 * cerrar). Si nadie lo gestiona, la barra hace scroll-arriba.
 */
export function useTabReselect(tabName: string, handler: ReselectHandler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const stable: ReselectHandler = () => handlerRef.current();
    let set = reselectHandlers.get(tabName);
    if (!set) {
      set = new Set();
      reselectHandlers.set(tabName, set);
    }
    set.add(stable);
    return () => {
      set?.delete(stable);
    };
  }, [tabName]);
}

/**
 * Re-tap del tab activo: primero se deja que el stack vuelva a su raíz; si no
 * había nada que cerrar, se sube el scroll.
 */
export function handleReselect(tabName: string) {
  setCompact(false);
  const handlers = reselectHandlers.get(tabName);
  if (handlers) {
    for (const handler of handlers) {
      if (handler()) return;
    }
  }
  scrollToTop(tabName, true);
}

interface CollapsingScrollOptions {
  /**
   * Clave con la que se registra el scroller. Es el `name` del tab. Las
   * pantallas ANIDADAS de un tab pasan la MISMA clave: el último scroller
   * montado gana, que es justo el que el usuario está viendo.
   */
  tabName: string | null;
}

/**
 * Handler de scroll que compacta y expande la barra, más el registro del
 * scroller para el scroll-arriba del re-tap.
 */
export function useCollapsingScroll({ tabName }: CollapsingScrollOptions) {
  const scrollRef = useRef<Scrollable | null>(null);
  /** Punto desde el que se mide el recorrido. Persigue al extremo alcanzado. */
  const anchor = useSharedValue(0);
  /** Espejo de `compact` (ver `compactMirrors`). */
  const isCompact = useSharedValue(false);
  /**
   * ¿Ha arrastrado el usuario en ESTA pantalla? Mientras sea `false` no se
   * aplica la regla de "arriba del todo siempre expandida": al entrar en una
   * pantalla anidada (una canción del cantoral, un item de Más…) el scroller
   * nuevo emite su primer evento en el offset inicial, y esa regla expandía la
   * barra sola. El estado compacto se hereda entre pantallas.
   */
  const interacted = useSharedValue(false);

  useEffect(() => {
    if (!tabName) return;
    const entry = scrollRef as { current: Scrollable | null };
    scrollRefs.set(tabName, entry);
    return () => {
      if (scrollRefs.get(tabName) === entry) scrollRefs.delete(tabName);
    };
  }, [tabName]);

  useEffect(() => {
    isCompact.value = compact;
    compactMirrors.add(isCompact);
    return () => {
      compactMirrors.delete(isCompact);
    };
  }, [isCompact]);

  const rememberInset = useCallback(
    (top: number) => {
      if (tabName) insetTops.set(tabName, top);
    },
    [tabName],
  );

  const onScroll = useAnimatedScrollHandler({
    onBeginDrag: (event) => {
      interacted.value = true;
      anchor.value = event.contentOffset.y;
    },
    onScroll: (event) => {
      // OJO: se usa el offset TAL CUAL, sin recortarlo a 0. En las pantallas
      // con header grande arranca en negativo, y recortarlo era justo lo que
      // hacía que la barra tardara tanto en compactarse.
      const insetTop = event.contentInset?.top ?? 0;
      if (insetTop > 0) runOnJS(rememberInset)(insetTop);

      // Límites REALES del recorrido, para que `collapseStep` pueda descartar
      // el rebote elástico de los extremos.
      const contentHeight = event.contentSize?.height ?? 0;
      const viewportHeight = event.layoutMeasurement?.height ?? 0;
      const next = collapseStep(
        {
          anchor: anchor.value,
          compact: isCompact.value,
          interacted: interacted.value,
        },
        {
          y: event.contentOffset.y,
          minY: -insetTop,
          maxY:
            contentHeight > 0
              ? contentHeight -
                viewportHeight +
                (event.contentInset?.bottom ?? 0)
              : null,
        },
      );

      anchor.value = next.anchor;
      if (next.compact !== isCompact.value) {
        // Se actualiza el espejo YA, sin esperar al salto al hilo de JS: si no,
        // los siguientes fotogramas seguirían decidiendo con el estado viejo.
        isCompact.value = next.compact;
        runOnJS(setCompact)(next.compact);
      }
    },
  });

  return { scrollRef: scrollRef as React.RefObject<ScrollView>, onScroll };
}

/** Lo que hace falta del evento de scroll del WebView. */
export interface WebViewScrollMetrics {
  y: number;
  /** Alto total del documento, para recortar el rebote del final. */
  contentHeight?: number;
  /** Alto visible del WebView. */
  viewportHeight?: number;
}

/**
 * Handler de scroll para vistas que NO son un scroller de React Native, como el
 * WebView de Comunica: llega por el hilo de JS (no es un worklet) y sin
 * `contentInset`, pero por lo demás sigue exactamente las mismas reglas que
 * `useCollapsingScroll` (umbrales asimétricos, ancla con histéresis y recorte
 * del rebote).
 */
export function useWebViewCollapse() {
  const anchor = useRef(0);
  const interacted = useRef(false);

  return useCallback(
    ({ y, contentHeight = 0, viewportHeight = 0 }: WebViewScrollMetrics) => {
      // El WebView no avisa del inicio del arrastre, así que el "ha
      // interactuado" se deduce del propio offset: si se ha movido del origen,
      // alguien lo ha movido.
      if (y > ARM_AT) interacted.current = true;

      const next = collapseStep(
        { anchor: anchor.current, compact, interacted: interacted.current },
        {
          y,
          minY: 0,
          maxY: contentHeight > 0 ? contentHeight - viewportHeight : null,
        },
      );

      anchor.current = next.anchor;
      setCompact(next.compact);
    },
    [],
  );
}

export const tabBarController = {
  useCompact,
  expand,
  scrollToTop,
  handleReselect,
  useCollapsingScroll,
};
