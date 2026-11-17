import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { rubberBand, shouldCommitGesture } from '@/utils/gesturePhysics';
import { radii } from '@/constants/uiStyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { MaterialIcons } from '@/components/ui/icons';
import { h } from '@/utils/haptics';
import {
  durations,
  motionEasings,
  reaEasings,
  springs,
} from '@/constants/animations';

/** Distancia y velocidad (px, px/s) que bastan para quitar el toast. */
const SWIPE_DISTANCE = 80;
const SWIPE_VELOCITY = 600;
/** Hasta dónde se va al quitarlo de lado. */
const SWIPE_FLY = 420;
/** Lo que le queda al soltarlo sin quitarlo. */
const TOAST_RESUME_MS = 2500;

type ToastVariant = 'default' | 'success' | 'danger' | 'warning';

export interface ToastOptions {
  label: string;
  variant?: ToastVariant;
  actionLabel?: string;
  onActionPress?: (params: { hide: () => void }) => void;
  duration?: number;
}

interface ToastState extends ToastOptions {
  id: number;
}

interface ToastContextValue {
  toast: {
    show: (options: ToastOptions) => void;
  };
}

const ToastContext = createContext<ToastContextValue>({
  toast: { show: () => {} },
});

export function useToast() {
  return useContext(ToastContext);
}

type VariantStyle = {
  /** Solid background fallback (Android/web) and tint behind the BlurView on iOS. */
  tint: string;
  /** Icon foreground color (rendered inside the leading badge). */
  iconColor: string;
  /** Background of the leading icon badge. */
  iconBg: string;
  /** Main label color. */
  text: string;
  /** Action button label color. */
  action: string;
  /** Icon glyph for the leading badge. */
  icon: keyof typeof MaterialIcons.glyphMap;
};

const VARIANT_STYLES: Record<ToastVariant, VariantStyle> = {
  default: {
    tint: 'rgba(20, 24, 40, 0.78)',
    iconColor: '#FFFFFF',
    iconBg: 'rgba(149, 210, 242, 0.22)',
    text: '#FFFFFF',
    action: '#9FD3F5',
    icon: 'info',
  },
  success: {
    tint: 'rgba(20, 56, 18, 0.82)',
    iconColor: '#FFFFFF',
    iconBg: 'rgba(163, 189, 49, 0.32)',
    text: '#FFFFFF',
    action: '#D4F0A0',
    icon: 'check-circle',
  },
  danger: {
    tint: 'rgba(80, 12, 18, 0.84)',
    iconColor: '#FFFFFF',
    iconBg: 'rgba(255, 107, 122, 0.28)',
    text: '#FFFFFF',
    action: '#FFB0B7',
    icon: 'error',
  },
  warning: {
    tint: 'rgba(78, 44, 6, 0.82)',
    iconColor: '#FFFFFF',
    iconBg: 'rgba(252, 210, 0, 0.28)',
    text: '#FFFFFF',
    action: '#FDE68A',
    icon: 'warning',
  },
};

/** `h` ya ignora web y se traga los fallos del módulo nativo. */
function triggerHaptic(variant: ToastVariant) {
  switch (variant) {
    case 'success':
      h.success();
      break;
    case 'danger':
      h.error();
      break;
    case 'warning':
      // `limit` es la notificación Warning de iOS (y Reject en Android).
      h.limit();
      break;
    default:
      h.select();
      break;
  }
}

/** Parar y reanudar la cuenta atrás del toast mientras se arrastra. */
function useToastPause(
  timerRef: React.RefObject<ReturnType<typeof setTimeout> | null>,
  hide: () => void,
) {
  const pause = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, [timerRef]);
  const resume = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(hide, TOAST_RESUME_MS);
  }, [timerRef, hide]);
  return { pause, resume };
}

function ToastItem({
  toast: t,
  onHide,
}: {
  toast: ToastState;
  onHide: () => void;
}) {
  const insets = useSafeAreaInsets();
  // Con "reducir movimiento" el toast solo aparece y desaparece: el fundido
  // explica igual de bien que ha pasado algo, y es la traslación lo que marea.
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(reducedMotion ? 0 : 28);
  const scale = useSharedValue(reducedMotion ? 1 : 0.96);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    // Salida: se va de pantalla, así que aquí sí vale acelerar.
    const exit = { duration: durations.base, easing: reaEasings.exit };
    if (!reducedMotion) {
      translateY.set(withTiming(20, exit));
      scale.set(withTiming(0.97, exit));
    }
    opacity.set(
      withTiming(0, exit, () => {
        'worklet';
        scheduleOnRN(onHide);
      }),
    );
  }, [opacity, translateY, scale, onHide, reducedMotion]);

  useEffect(() => {
    triggerHaptic(t.variant ?? 'default');
    // Un aviso funcional entra sin rebote: el `bouncy` es para celebrar
    // (design.md §6). Antes eran muelles a mano con ζ≈0,5.
    opacity.set(
      withTiming(1, { duration: durations.base, easing: motionEasings.out }),
    );
    if (!reducedMotion) {
      translateY.set(withSpring(0, springs.settle));
      scale.set(withSpring(1, springs.settle));
    }

    const duration = t.duration ?? (t.actionLabel ? 5200 : 3400);
    timerRef.current = setTimeout(hide, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deslizar para quitarlo: a los lados o hacia abajo. Mientras el dedo está
  // encima no se va solo; si se suelta sin llegar, vuelve y sigue su cuenta.
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const { pause: pauseTimer, resume: restartTimer } = useToastPause(
    timerRef,
    hide,
  );
  const dismissBySwipe = useCallback(() => {
    pauseTimer();
    h.tap();
    onHide();
  }, [onHide, pauseTimer]);
  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(6)
        .onStart(() => {
          scheduleOnRN(pauseTimer);
        })
        .onUpdate((e) => {
          dragX.set(e.translationX);
          // Hacia abajo, 1:1; hacia arriba no hay adónde ir: cede.
          dragY.set(
            e.translationY > 0 ? e.translationY : rubberBand(e.translationY),
          );
        })
        .onEnd((e) => {
          const sideways = Math.abs(e.translationX) > Math.abs(e.translationY);
          const out = sideways
            ? shouldCommitGesture(
                e.translationX,
                e.velocityX,
                SWIPE_DISTANCE,
                SWIPE_VELOCITY,
              )
            : e.translationY > 0 &&
              shouldCommitGesture(
                e.translationY,
                e.velocityY,
                SWIPE_DISTANCE / 2,
                SWIPE_VELOCITY,
              );
          if (out) {
            const exit = { duration: durations.quick, easing: reaEasings.exit };
            if (sideways)
              dragX.set(
                withTiming(Math.sign(e.translationX) * SWIPE_FLY, exit),
              );
            else dragY.set(withTiming(SWIPE_FLY / 3, exit));
            opacity.set(
              withTiming(0, exit, () => {
                'worklet';
                scheduleOnRN(dismissBySwipe);
              }),
            );
            return;
          }
          dragX.set(withSpring(0, { ...springs.snap, velocity: e.velocityX }));
          dragY.set(withSpring(0, { ...springs.snap, velocity: e.velocityY }));
          scheduleOnRN(restartTimer);
        }),
    [dragX, dragY, opacity, pauseTimer, restartTimer, dismissBySwipe],
  );

  const toastStyle = useAnimatedStyle(() => {
    const x = Math.abs(dragX.get());
    return {
      // Al irse de lado se va apagando: se ve que se está quitando.
      opacity: opacity.get() * Math.max(0.2, 1 - x / SWIPE_FLY),
      transform: [
        { translateX: dragX.get() },
        { translateY: translateY.get() + dragY.get() },
        { scale: scale.get() },
      ],
    };
  });

  const v = VARIANT_STYLES[t.variant ?? 'default'];
  // El overlay del toast se pinta por ENCIMA de todo (zIndex alto) anclado a
  // `bottom: 0`, así que el offset debe librar la ALTURA de la tab bar, no solo
  // el home indicator. Alturas reales de la barra (app/(tabs)/_layout.tsx):
  //   · iOS (NativeTabs)      ≈ 49 + insets.bottom
  //   · Android (Tabs custom)  = 80 + insets.bottom
  //   · Web (Tabs)             = 60 + insets.bottom
  // Sumamos ~12px de aire. En pantallas sin tab bar (fullscreen, onboarding)
  // el toast queda algo más arriba de lo estrictamente necesario; es un
  // trade-off asumible porque la mayoría de toasts salen en pantallas con tabs.
  const bottomOffset =
    Platform.OS === 'ios'
      ? Math.max(insets.bottom + 61, 77)
      : Platform.OS === 'web'
        ? Math.max(insets.bottom + 72, 84)
        : Math.max(insets.bottom + 92, 100);

  const useBlur = Platform.OS === 'ios';

  return (
    <GestureDetector gesture={swipe}>
      <Animated.View
        style={[styles.toastShadow, { marginBottom: bottomOffset }, toastStyle]}
        accessibilityHint="Desliza para quitarlo"
      >
        <View style={styles.toastClip}>
          {useBlur ? (
            <BlurView
              tint="dark"
              intensity={70}
              style={[StyleSheet.absoluteFill, { backgroundColor: v.tint }]}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: solidTint(v.tint) },
              ]}
            />
          )}
          <View style={styles.toastContent}>
            <View style={[styles.iconBadge, { backgroundColor: v.iconBg }]}>
              <MaterialIcons name={v.icon} size={18} color={v.iconColor} />
            </View>
            <Text style={[styles.label, { color: v.text }]} numberOfLines={3}>
              {t.label}
            </Text>
            {t.actionLabel && (
              <TouchableOpacity
                onPress={() => {
                  if (t.onActionPress) {
                    t.onActionPress({ hide });
                  } else {
                    hide();
                  }
                }}
                style={styles.actionButton}
                hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Text style={[styles.actionText, { color: v.action }]}>
                  {t.actionLabel}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * Converts the iOS translucent tint (e.g. "rgba(20, 24, 40, 0.78)") into an
 * opaque-enough solid for Android/web where we don't render a BlurView.
 */
function solidTint(rgba: string): string {
  // Replace the trailing alpha with 0.96 to keep contrast on platforms
  // without a real blur primitive.
  return rgba.replace(/,\s*[\d.]+\)$/, ', 0.96)');
}

export function AppToastProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<ToastState | null>(null);
  const idRef = useRef(0);

  const show = useCallback((options: ToastOptions) => {
    setCurrent({ ...options, id: ++idRef.current });
  }, []);

  const hide = useCallback(() => setCurrent(null), []);

  return (
    <ToastContext.Provider value={{ toast: { show } }}>
      <View style={styles.root}>
        {children}
        {current !== null && (
          <View style={styles.overlay} pointerEvents="box-none">
            <ToastItem key={current.id} toast={current} onHide={hide} />
          </View>
        )}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  toastShadow: {
    marginHorizontal: 18,
    maxWidth: 520,
    width: '92%',
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.28,
        shadowRadius: 22,
      },
      android: {
        elevation: 14,
      },
      default: {
        // @ts-ignore - web only
        boxShadow: '0px 10px 30px rgba(0, 0, 0, 0.28)',
      },
    }),
  },
  toastClip: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 56,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  label: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 21,
    letterSpacing: 0.1,
  },
  actionButton: {
    marginLeft: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
