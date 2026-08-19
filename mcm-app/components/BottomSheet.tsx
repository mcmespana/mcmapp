import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Modal,
  Platform,
  PanResponder,
  Pressable,
  View,
  Text,
  Animated,
  StyleSheet,
  Dimensions,
  Keyboard,
  useAnimatedValue,
  useWindowDimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UIColors, Colors } from '@/constants/colors';
import { radii } from '@/constants/uiStyles';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useEscapeToClose } from '@/hooks/useEscapeToClose';

// ⚠️ Estas animaciones van con el `Animated` de React Native A PROPÓSITO, NO
// con Reanimated. Dentro de un `Modal` TRANSPARENTE de RN los estilos animados
// de Reanimated 4 no se aplican (comprobado con una vista de prueba que anima
// su opacidad de 0 a 1 y se queda invisible; en un Modal opaco, como el del
// escáner de QR, sí funcionan). Aquí eso era fatal: la hoja se quedaba en su
// posición inicial —fuera de pantalla, con el fondo a opacidad 0— y el callback
// de la animación de cierre, que es quien desmonta el `Modal`, no se disparaba
// nunca. Resultado: un modal invisible a pantalla completa que se comía todos
// los toques y dejaba la pestaña muerta hasta reiniciar (calendarios, sugerir
// canción, multimedia, calendario de evangelios…). Si alguien vuelve a migrar
// esto a Reanimated, hay que comprobar ANTES que la hoja aparece de verdad.
//
// Y por eso mismo el arrastre sigue con `PanResponder` en vez de con
// `Gesture.Pan()` de gesture-handler, que es lo que pediría la skill
// `animate-expo`: el gesto solo tiene sentido moviendo la MISMA
// `Animated.Value` que la animación de entrada/salida, y esa no puede ser un
// shared value de Reanimated mientras el Modal transparente siga sin aplicar
// sus estilos. Lo que sí se ha traído de la skill —umbral por velocidad,
// resistencia elástica arriba, velocidad arrastrada al muelle, háptica en el
// commit— está abajo y no depende del hilo en el que corra.
const nativeDriver = Platform.OS !== 'web';

// Sitio de partida/salida de la hoja. Se mide una vez al cargar el módulo, así
// que en horizontal puede quedar más grande que la pantalla: sobrar da igual
// (la hoja acaba fuera de vista), faltar dejaría la hoja asomando.
const OFF_SCREEN = Dimensions.get('window').height;
const DURATION = 300;

/** Arrastrar la hoja más de esto hacia abajo y soltar la cierra. */
const CLOSE_THRESHOLD = 80;
/**
 * Umbral de velocidad para cerrar de un flick, **en px/ms** — que son las
 * unidades del `vy` de `PanResponder`, no px/s.
 *
 * Aquí decía `400`, o sea 400 px/ms = 400.000 px/s: inalcanzable con un dedo
 * humano, así que la rama de velocidad era código muerto y solo cerraba el
 * umbral de distancia. Efecto para el usuario: un flick corto y rápido hacia
 * abajo —el gesto natural para descartar una hoja— no cerraba nada y la hoja
 * volvía a su sitio. Un flick de verdad va sobre 1–3 px/ms; 0,5 deja fuera el
 * arrastre lento (que es el que sí quiere el umbral de distancia).
 */
const VELOCITY_THRESHOLD = 0.5;
/**
 * Cuánto "cede" la hoja al tirar hacia ARRIBA, donde no hay nada que
 * descubrir. Antes se ignoraba el movimiento hacia arriba por completo: el
 * dedo se movía y la hoja se quedaba clavada, que es lo que se siente como
 * que la app se ha colgado. Con resistencia elástica sigue el dedo un poco y
 * se nota que el tope es un tope.
 */
const UPWARD_RESISTANCE = 0.2;

/**
 * ¿Cierra el gesto al soltar? Velocidad **o** distancia: un flick es
 * suficiente aunque haya recorrido poco.
 *
 * @param dy desplazamiento vertical acumulado, px (positivo = hacia abajo)
 * @param vy velocidad vertical al soltar, px/ms (positiva = hacia abajo)
 */
export function shouldCloseOnRelease(dy: number, vy: number): boolean {
  return dy > CLOSE_THRESHOLD || vy > VELOCITY_THRESHOLD;
}

/** Posición de la hoja para un arrastre de `dy` px, con tope elástico arriba. */
export function dragOffsetFor(dy: number): number {
  return dy > 0 ? dy : dy * UPWARD_RESISTANCE;
}

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  height?: number;
  title?: string;
  headerLeft?: React.ReactNode;
  headerRight?: React.ReactNode;
  /** Called after the close animation finishes and the Modal is unmounted.
   *  Use this to present a second Modal or call Share.share() — iOS cannot
   *  show two Modals simultaneously, so actions must wait for full dismissal. */
  onCloseComplete?: () => void;
  paddingHorizontal?: number;
  dragFromContent?: boolean;
}

export default function BottomSheet({
  visible,
  onClose,
  children,
  height,
  title,
  headerLeft,
  headerRight,
  onCloseComplete,
  paddingHorizontal = 16,
  dragFromContent = false,
}: BottomSheetProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const bgColor = Colors[scheme ?? 'light'].background;

  useEscapeToClose(visible, onClose);

  // Ref so the animation callback always calls the latest version of the prop
  // without needing it in the useEffect dependency array.
  const onCloseCompleteRef = useRef(onCloseComplete);
  onCloseCompleteRef.current = onCloseComplete;

  // Igual con `onClose`: los `PanResponder` se crean UNA vez, así que sin este
  // ref se quedarían con el `onClose` del primer render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // El `Modal` de RN tiene que seguir MONTADO mientras se reproduce la
  // animación de salida: por eso no basta con `visible`.
  //
  // `modalVisible` es DERIVADO —`visible || closing`— y no un estado que se
  // encendía con un setState EN FASE DE RENDER. Ese patrón fallaba en pantallas
  // que a su vez hacen su propio setState en fase de render (el detalle de
  // canción, sin ir más lejos): el `setModalVisible(true)` se perdía por el
  // camino, la hoja se quedaba con `visible` a true pero sin `Modal` montado, y
  // no aparecía hasta que algo ajeno forzaba otro render. Derivado no se puede
  // perder: en el mismo render en que `visible` es true, el Modal se monta.
  const [closing, setClosing] = useState(false);
  const modalVisible = visible || closing;

  const [kbHeight, setKbHeight] = useState(0);
  const insets = useSafeAreaInsets();
  // `useWindowDimensions` y no `Dimensions.get(...)`: leído a pelo en el render
  // no se recalcula al girar el dispositivo, y la hoja se quedaba con el tope
  // de altura del portrait estando en horizontal.
  const { height: screenHeight } = useWindowDimensions();
  // Altura máxima de la hoja: siempre deja sitio para el safe-area superior y,
  // si el teclado está abierto, para el teclado. Así la hoja nunca se sale por
  // arriba al subir, y el ScrollView interno scrollea al campo enfocado.
  const sheetMaxHeight = screenHeight - insets.top - kbHeight - 8;
  const slideAnim = useAnimatedValue(OFF_SCREEN);
  const opacityAnim = useAnimatedValue(0);
  const dragAnim = useAnimatedValue(0);
  // Keyboard offset: negative value moves the sheet up. Kept separate from
  // translateY so both can use useNativeDriver without a driver conflict.
  const keyboardOffsetAnim = useAnimatedValue(0);

  // `visible` del render anterior: al montar con `visible` a false no hay nada
  // que cerrar, así que no se dispara la animación de salida (que además
  // encendería `closing` y montaría el Modal para nada).
  const prevVisible = useRef(visible);

  // `onCloseComplete` se llama UNA sola vez por cierre, venga de donde venga
  // (el `onDismiss` de iOS o el temporizador de respaldo). Sin este pestillo,
  // una acción diferida podría ejecutarse dos veces.
  const completePendingRef = useRef(false);
  const dismissFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fireCloseComplete = useCallback(() => {
    if (dismissFallbackRef.current) {
      clearTimeout(dismissFallbackRef.current);
      dismissFallbackRef.current = null;
    }
    if (!completePendingRef.current) return;
    completePendingRef.current = false;
    onCloseCompleteRef.current?.();
  }, []);

  // Al desmontar, ni temporizador vivo ni callback a destiempo.
  useEffect(
    () => () => {
      if (dismissFallbackRef.current) clearTimeout(dismissFallbackRef.current);
    },
    [],
  );

  useEffect(() => {
    const wasVisible = prevVisible.current;
    prevVisible.current = visible;

    if (visible) {
      setClosing(false);
      dragAnim.setValue(0);
      keyboardOffsetAnim.setValue(0);
      slideAnim.setValue(OFF_SCREEN);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: DURATION,
          useNativeDriver: nativeDriver,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: DURATION,
          useNativeDriver: nativeDriver,
        }),
      ]).start();
      return;
    }

    if (!wasVisible) return;

    completePendingRef.current = true;
    setClosing(true);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: OFF_SCREEN,
        duration: DURATION,
        useNativeDriver: nativeDriver,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: DURATION,
        useNativeDriver: nativeDriver,
      }),
    ]).start(() => {
      setClosing(false);
      // Android / Web: call directly — no native sequencing concern.
      // iOS: lo normal es que lo dispare `onDismiss` del Modal, cuando UIKit
      // confirma que el view controller ya no está; llamarlo aquí lo agruparía
      // con desmontar el Modal y el modal nuevo aparecería en el mismo ciclo de
      // render, cosa que iOS rechaza en silencio. Pero NO se puede depender solo
      // de `onDismiss`: si no llega, la acción pendiente se pierde sin ruido —y
      // es justo el caso del menú "..." del cantoral, donde cada opción es
      // "cierra la hoja y abre otra cosa", así que sin callback el menú entero
      // parece muerto. De ahí la red de seguridad de abajo.
      if (Platform.OS !== 'ios') {
        fireCloseComplete();
        return;
      }
      dismissFallbackRef.current = setTimeout(fireCloseComplete, 400);
    });
  }, [
    visible,
    slideAnim,
    opacityAnim,
    dragAnim,
    keyboardOffsetAnim,
    fireCloseComplete,
  ]);

  // Shift the sheet up when the keyboard appears (iOS only).
  // Uses a separate Animated.Value so it can share the native driver with
  // translateY — mixing useNativeDriver: false and true on one Animated.View
  // crashes React Native.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const showSub = Keyboard.addListener(
      'keyboardWillShow',
      (e: { endCoordinates: { height: number }; duration: number }) => {
        // Guardamos la altura del teclado para CAPAR la altura de la hoja (que
        // quepa encima del teclado) y que su tope no se salga de pantalla al
        // subir. El scroll interno lleva el campo enfocado a la vista.
        setKbHeight(e.endCoordinates.height);
        Animated.timing(keyboardOffsetAnim, {
          toValue: -e.endCoordinates.height,
          duration: e.duration ?? 250,
          useNativeDriver: nativeDriver,
        }).start();
      },
    );
    const hideSub = Keyboard.addListener(
      'keyboardWillHide',
      (e: { duration: number }) => {
        setKbHeight(0);
        Animated.timing(keyboardOffsetAnim, {
          toValue: 0,
          duration: e.duration ?? 250,
          useNativeDriver: nativeDriver,
        }).start();
      },
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardOffsetAnim]);

  // `useMemo` y no `useRef(...).current`: el patrón del ref construía un
  // PanResponder NUEVO en cada render para tirarlo acto seguido. Los handlers
  // solo cierran sobre `dragAnim` (estable) y sobre refs, así que una sola
  // instancia vale para toda la vida del sheet.
  const [headerPanResponder, contentPanResponder] = useMemo(() => {
    // La velocidad del gesto se ARRASTRA al muelle de vuelta (`velocity`): si
    // no, el rebote arranca de cero y se siente como si la hoja se hubiera
    // soltado sola en vez de haberla soltado tú. `velocity` va en px/s, y el
    // `vy` de PanResponder en px/ms.
    const snapBack = (vy = 0) => {
      Animated.spring(dragAnim, {
        toValue: 0,
        useNativeDriver: nativeDriver,
        tension: 180,
        friction: 20,
        velocity: vy * 1000,
      }).start();
    };
    // Soltar arrastrando lo bastante (o rápido) cierra; si no, vuelve a su sitio.
    const onRelease = (dy: number, vy: number) => {
      if (shouldCloseOnRelease(dy, vy)) {
        // Háptica en el instante en que el gesto se compromete, no al acabar la
        // animación: un toque que llega tarde se lee como un fallo, no como
        // respuesta. Y nunca es el único feedback — la hoja se va igual.
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => {},
          );
        }
        onCloseRef.current();
      } else {
        snapBack(vy);
      }
    };
    const shared = {
      onPanResponderMove: (_: unknown, { dy }: { dy: number }) => {
        dragAnim.setValue(dragOffsetFor(dy));
      },
      onPanResponderRelease: (
        _: unknown,
        { dy, vy }: { dy: number; vy: number },
      ) => onRelease(dy, vy),
      onPanResponderTerminate: () => snapBack(),
    };
    return [
      // La cabecera arrastra desde el primer toque: ahí no hay nada que scrollear.
      PanResponder.create({
        ...shared,
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
      }),
      // El contenido solo secuestra el gesto si es claramente vertical y hacia
      // abajo, para no robarle el scroll a la lista de dentro.
      PanResponder.create({
        ...shared,
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, { dy, dx }) =>
          Math.abs(dy) > Math.abs(dx) && dy > 5,
      }),
    ];
  }, [dragAnim]);

  const handleColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)';
  const translateY = Animated.add(slideAnim, dragAnim);

  const hasHeader =
    title !== undefined ||
    headerLeft !== undefined ||
    headerRight !== undefined;

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      onDismiss={fireCloseComplete}
    >
      {/* Backdrop */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: UIColors.modalOverlay, opacity: opacityAnim },
        ]}
        pointerEvents="none"
      />

      {/* Tap-to-close area behind the sheet */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      {/* Outer: keyboard avoidance — moves the whole sheet up via transform */}
      <Animated.View
        style={[
          styles.sheetPositioner,
          { transform: [{ translateY: keyboardOffsetAnim }] },
        ]}
      >
        {/* Inner: slide-in / drag animation */}
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: bgColor,
              paddingBottom: 8,
              transform: [{ translateY }],
              maxHeight: sheetMaxHeight,
              ...(height !== undefined && { height }),
            },
          ]}
        >
          {/* Handle capsule serves as a drag target */}
          <View style={styles.handleWrap} {...headerPanResponder.panHandlers}>
            <View style={[styles.handle, { backgroundColor: handleColor }]} />
          </View>

          {/* Unified Premium Header Container serves as a drag target */}
          {hasHeader && (
            <View
              style={styles.headerContainer}
              {...headerPanResponder.panHandlers}
            >
              {headerLeft && (
                <View style={styles.headerLeft}>{headerLeft}</View>
              )}
              {title && (
                <Text
                  style={[
                    styles.titleText,
                    { color: Colors[scheme ?? 'light'].text },
                  ]}
                  numberOfLines={1}
                >
                  {title}
                </Text>
              )}
              {headerRight && (
                <View style={styles.headerRight}>{headerRight}</View>
              )}
            </View>
          )}

          {/* onStartShouldSetResponder absorbs touches on empty areas so they
              don't fall through to the backdrop Pressable behind the sheet. */}
          <View
            style={[
              { backgroundColor: bgColor, paddingHorizontal },
              // Con teclado abierto (o altura fija), el área de contenido se
              // acota (flex:1) para que el ScrollView interno scrollee dentro de
              // la hoja capada, en vez de empujar la hoja fuera de pantalla.
              (height !== undefined || kbHeight > 0) && { flex: 1 },
            ]}
            onStartShouldSetResponder={() => true}
            {...(dragFromContent ? contentPanResponder.panHandlers : {})}
          >
            {children}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetPositioner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    overflow: 'hidden',
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  headerContainer: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 54, // Ensure title text doesn't overlap absolute buttons
    position: 'relative',
  },
  headerLeft: {
    position: 'absolute',
    left: 16,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  headerRight: {
    position: 'absolute',
    right: 16,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  titleText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
});
