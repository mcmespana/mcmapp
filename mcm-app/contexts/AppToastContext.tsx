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
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

const VARIANT_STYLES: Record<
  ToastVariant,
  { bg: string; text: string; action: string }
> = {
  default: { bg: '#253883', text: '#FFFFFF', action: '#95d2f2' },
  success: { bg: '#5A8E1A', text: '#FFFFFF', action: '#D4F0A0' },
  danger: { bg: '#B91C1C', text: '#FFFFFF', action: '#FCA5A5' },
  warning: { bg: '#B45309', text: '#FFFFFF', action: '#FDE68A' },
};

function ToastItem({
  toast: t,
  onHide,
}: {
  toast: ToastState;
  onHide: () => void;
}) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 16,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(onHide);
  }, [opacity, translateY, onHide]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        tension: 90,
        friction: 9,
        useNativeDriver: true,
      }),
    ]).start();

    const duration = t.duration ?? (t.actionLabel ? 5000 : 3200);
    timerRef.current = setTimeout(hide, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const colors = VARIANT_STYLES[t.variant ?? 'default'];
  const bottomOffset = Math.max(insets.bottom + 8, 20);

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: colors.bg, marginBottom: bottomOffset },
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <Text style={[styles.label, { color: colors.text }]} numberOfLines={3}>
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
          activeOpacity={0.7}
        >
          <Text style={[styles.actionText, { color: colors.action }]}>
            {t.actionLabel}
          </Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
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
          <View
            style={styles.overlay}
            pointerEvents="box-none"
          >
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
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
    maxWidth: 480,
    width: '100%',
  },
  label: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 21,
    letterSpacing: 0.1,
  },
  actionButton: {
    marginLeft: 14,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
