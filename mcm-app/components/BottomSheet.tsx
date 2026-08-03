import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  PanResponder,
  Pressable,
  View,
  Text,
  StyleSheet,
  Dimensions,
  Keyboard,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UIColors, Colors } from '@/constants/colors';
import { radii } from '@/constants/uiStyles';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useEscapeToClose } from '@/hooks/useEscapeToClose';

// `tension: 180, friction: 20` de RN Animated → el mismo muelle en Reanimated.
const SPRING_BACK = { stiffness: 180, damping: 20, mass: 1 } as const;

const OFF_SCREEN = Dimensions.get('window').height;
const DURATION = 300;
// Swipe down threshold to trigger close
const CLOSE_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 400;

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
  // animación de salida: por eso no basta con `visible`. Se enciende durante el
  // render (el patrón que documenta React para "cambiar estado cuando cambia
  // una prop") y se apaga en el callback de la animación de cierre.
  const [modalVisible, setModalVisible] = useState(visible);
  const [lastVisible, setLastVisible] = useState(visible);
  if (visible !== lastVisible) {
    setLastVisible(visible);
    if (visible) setModalVisible(true);
  }

  const [kbHeight, setKbHeight] = useState(0);
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get('window').height;
  // Altura máxima de la hoja: siempre deja sitio para el safe-area superior y,
  // si el teclado está abierto, para el teclado. Así la hoja nunca se sale por
  // arriba al subir, y el ScrollView interno scrollea al campo enfocado.
  const sheetMaxHeight = screenHeight - insets.top - kbHeight - 8;

  // Los gestos siguen siendo `PanResponder` (ver abajo por qué), pero escriben
  // en shared values: el muelle de vuelta y el deslizamiento corren ya en el
  // hilo de UI. El arrastre en sí iba por JS también antes (`useNativeDriver`
  // estaba a false para poder usar `setValue`), así que no se pierde nada.
  const slide = useSharedValue(OFF_SCREEN);
  const opacity = useSharedValue(0);
  const drag = useSharedValue(0);
  // Desplazamiento por teclado: negativo sube la hoja. Va aparte de `translateY`
  // porque se anima desde los eventos de `Keyboard`, no desde el gesto.
  const keyboardOffset = useSharedValue(0);

  // Android / Web: se llama directamente — no hay secuencia nativa que respetar.
  // iOS: dispara `onDismiss` del Modal, después de que UIKit confirme que el
  // view controller ya no está. Llamarlo aquí en iOS lo agruparía con
  // `setModalVisible(false)`, haciendo aparecer el Modal nuevo en el mismo ciclo
  // de render — cosa que iOS rechaza en silencio.
  const finishClose = useCallback(() => {
    setModalVisible(false);
    if (Platform.OS !== 'ios') {
      onCloseCompleteRef.current?.();
    }
  }, []);

  useEffect(() => {
    if (visible) {
      drag.value = 0;
      keyboardOffset.value = 0;
      slide.value = withTiming(0, { duration: DURATION });
      opacity.value = withTiming(1, { duration: DURATION });
    } else {
      opacity.value = withTiming(0, { duration: DURATION });
      slide.value = withTiming(OFF_SCREEN, { duration: DURATION }, () => {
        'worklet';
        runOnJS(finishClose)();
      });
    }
  }, [visible, slide, opacity, drag, keyboardOffset, finishClose]);

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
        keyboardOffset.value = withTiming(-e.endCoordinates.height, {
          duration: e.duration ?? 250,
        });
      },
    );
    const hideSub = Keyboard.addListener(
      'keyboardWillHide',
      (e: { duration: number }) => {
        setKbHeight(0);
        keyboardOffset.value = withTiming(0, { duration: e.duration ?? 250 });
      },
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardOffset]);

  // El gesto sigue en `PanResponder` A PROPÓSITO. Este sheet lo comparten una
  // decena de modales y muchos llevan un ScrollView dentro; pasarlo a
  // gesture-handler cambiaría cómo compiten los dos por el toque, que es
  // justo lo delicado aquí. Lo que sí gana Reanimated es la ANIMACIÓN: el
  // muelle de vuelta ya no depende de que JS vaya suelto.
  const onDragMove = useCallback(
    (dy: number) => {
      if (dy > 0) drag.value = dy;
    },
    [drag],
  );

  const onDragEnd = useCallback(
    (dy: number, vy: number) => {
      if (dy > CLOSE_THRESHOLD || vy > VELOCITY_THRESHOLD) {
        onCloseRef.current();
      } else {
        drag.value = withSpring(0, SPRING_BACK);
      }
    },
    [drag],
  );

  const onDragCancel = useCallback(() => {
    drag.value = withSpring(0, SPRING_BACK);
  }, [drag]);

  const headerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, { dy }) => onDragMove(dy),
      onPanResponderRelease: (_, { dy, vy }) => onDragEnd(dy, vy),
      onPanResponderTerminate: onDragCancel,
    }),
  ).current;

  const contentPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dy, dx }) =>
        Math.abs(dy) > Math.abs(dx) && dy > 5,
      onPanResponderMove: (_, { dy }) => onDragMove(dy),
      onPanResponderRelease: (_, { dy, vy }) => onDragEnd(dy, vy),
      onPanResponderTerminate: onDragCancel,
    }),
  ).current;

  const handleColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)';

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const positionerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: keyboardOffset.value }],
  }));
  // El deslizamiento de entrada y el arrastre se suman (antes,
  // `Animated.add(slideAnim, dragAnim)`).
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slide.value + drag.value }],
  }));

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
      onDismiss={() => onCloseCompleteRef.current?.()}
    >
      {/* Backdrop */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: UIColors.modalOverlay },
          backdropStyle,
        ]}
        pointerEvents="none"
      />

      {/* Tap-to-close area behind the sheet */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      {/* Outer: keyboard avoidance — moves the whole sheet up via transform */}
      <Animated.View style={[styles.sheetPositioner, positionerStyle]}>
        {/* Inner: slide-in / drag animation */}
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: bgColor,
              paddingBottom: 8,
              maxHeight: sheetMaxHeight,
              ...(height !== undefined && { height }),
            },
            sheetStyle,
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
