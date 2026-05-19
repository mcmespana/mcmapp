import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

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

function triggerHaptic(variant: ToastVariant) {
  if (Platform.OS === 'web') return;
  try {
    switch (variant) {
      case 'success':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'danger':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      case 'warning':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      default:
        Haptics.selectionAsync();
        break;
    }
  } catch {
    // Haptics unavailable on this device — silently ignore.
  }
}

function ToastItem({
  toast: t,
  onHide,
}: {
  toast: ToastState;
  onHide: () => void;
}) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(28)).current;
  const scale = useRef(new Animated.Value(0.96)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 20,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.97,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(onHide);
  }, [opacity, translateY, scale, onHide]);

  useEffect(() => {
    triggerHaptic(t.variant ?? 'default');
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        tension: 110,
        friction: 11,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 130,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();

    const duration = t.duration ?? (t.actionLabel ? 5200 : 3400);
    timerRef.current = setTimeout(hide, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const v = VARIANT_STYLES[t.variant ?? 'default'];
  // Extra breathing room above the tab bar / home indicator — much more
  // than the previous build, which felt glued to the edge on iOS.
  const bottomOffset =
    Platform.OS === 'ios'
      ? Math.max(insets.bottom + 18, 36)
      : Math.max(insets.bottom + 12, 24);

  const useBlur = Platform.OS === 'ios';

  return (
    <Animated.View
      style={[
        styles.toastShadow,
        { marginBottom: bottomOffset },
        { opacity, transform: [{ translateY }, { scale }] },
      ]}
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
    borderRadius: 16,
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
